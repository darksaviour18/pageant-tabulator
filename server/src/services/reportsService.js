import { getDb } from '../db/init.js';

const DEFAULT_CACHE_TTL_MS = parseInt(process.env.REPORT_CACHE_TTL_MS, 10) || 5 * 60 * 1000; // 5 minutes

const reportCache = new Map();

function getCacheKey(type, eventId, params) {
  if (type === 'category') {
    return `category:${eventId}:${params.categoryId}`;
  }
  return `cross:${eventId}:${params.categoryIds.sort().join(',')}`;
}

function getFromCache(key) {
  const entry = reportCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > entry.ttl) {
    reportCache.delete(key);
    return null;
  }

  return entry.data;
}

function setToCache(key, data, ttl = DEFAULT_CACHE_TTL_MS) {
  reportCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

export function invalidateReportCache(eventId, categoryId = null) {
  const keysToDelete = [];
  for (const key of reportCache.keys()) {
    if (key.startsWith(`category:${eventId}:`)) {
      if (categoryId === null || key === `category:${eventId}:${categoryId}`) {
        keysToDelete.push(key);
      }
    }
    if (key.startsWith(`cross:${eventId}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => reportCache.delete(key));
}

export const reportsService = {
  DEFAULT_CACHE_TTL_MS,

  /**
   * Generate a full report for a specific category.
   * Uses caching to avoid re-computing on each refresh.
   */
  generateCategoryReport(eventId, categoryId) {
    const cacheKey = getCacheKey('category', eventId, { categoryId });
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { ...cached, _cached: true };
    }

    const db = getDb();

    const category = db
      .prepare('SELECT * FROM categories WHERE id = ? AND event_id = ?')
      .get(categoryId, eventId);

    if (!category) return null;

    const criteria = db
      .prepare('SELECT id, name, weight, min_score, max_score FROM criteria WHERE category_id = ? ORDER BY display_order')
      .all(categoryId);

    const judges = db
      .prepare('SELECT id, seat_number, name FROM judges WHERE event_id = ? ORDER BY seat_number')
      .all(eventId);

    const contestants = db
      .prepare('SELECT id, number, name FROM contestants WHERE event_id = ? AND status = ? ORDER BY number')
      .all(eventId, 'active');

    const scores = db
      .prepare(
        'SELECT contestant_id, judge_id, criteria_id, score FROM scores WHERE category_id = ? AND score IS NOT NULL'
      )
      .all(categoryId);

    const rankings = this._calculateRankings(contestants, criteria, scores);

    const report = {
      category: { id: category.id, name: category.name, display_order: category.display_order, is_locked: !!category.is_locked },
      criteria,
      judges,
      contestants,
      scores,
      rankings,
    };

    setToCache(cacheKey, report);

    return report;
  },

  /**
   * Generate a cross-category consolidation report.
   * Aggregates ranks across multiple categories using rank-sum logic.
   * Uses caching to avoid re-computing on each refresh.
   *
   * @param {number} eventId
   * @param {{ categoryIds: number[], aggregation_type?: 'rank_sum' | 'score_sum', report_title?: string }} config
   * @returns {object|null}
   */
  generateCrossCategoryReport(eventId, { categoryIds, aggregation_type = 'rank_sum', report_title }) {
    const cacheKey = getCacheKey('cross', eventId, { categoryIds });
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { ...cached, _cached: true };
    }

    const db = getDb();

    if (!categoryIds || categoryIds.length === 0) return null;

    // Verify all categories belong to this event
    const categories = db
      .prepare(
        `SELECT id, name, weight, display_order FROM categories WHERE id IN (${categoryIds.join(',')}) AND event_id = ? ORDER BY display_order`
      )
      .all(eventId);

    if (categories.length !== categoryIds.length) return null;

    const contestants = db
      .prepare('SELECT id, number, name FROM contestants WHERE event_id = ? AND status = ? ORDER BY number')
      .all(eventId, 'active');

    if (contestants.length === 0) return { title: report_title || 'Cross-Category Report', categories, contestants: [], rankings: [] };

    // Calculate total weights for normalization
    const totalWeight = categories.reduce((sum, cat) => sum + (cat.weight || 1), 0);
    const categoryWeightMap = {};
    categories.forEach(cat => {
      categoryWeightMap[cat.id] = cat.weight || 1;
    });

    const catIdList = categoryIds.join(',');

    // Get total scores per contestant per category
    const categoryScores = db
      .prepare(
        `SELECT contestant_id, category_id, SUM(score) as total_score
         FROM scores
         WHERE category_id IN (${catIdList})
         GROUP BY contestant_id, category_id`
      )
      .all();

    // Calculate weighted scores per contestant
    const contestantWeightedScores = {};
    for (const c of contestants) {
      contestantWeightedScores[c.id] = {
        id: c.id,
        number: c.number,
        name: c.name,
        category_scores: {},
        weighted_total: 0,
      };
    }

    for (const row of categoryScores) {
      const weight = categoryWeightMap[row.category_id] || 1;
      const normalizedScore = (row.total_score * weight) / totalWeight;
      
      if (contestantWeightedScores[row.contestant_id]) {
        contestantWeightedScores[row.contestant_id].category_scores[row.category_id] = row.total_score;
        contestantWeightedScores[row.contestant_id].weighted_total += normalizedScore;
      }
    }

    // Rank contestants by weighted total (higher = better)
    const ranked = Object.values(contestantWeightedScores)
      .filter(c => Object.keys(c.category_scores).length > 0)
      .sort((a, b) => {
        if (b.weighted_total !== a.weighted_total) return b.weighted_total - a.weighted_total;
        return a.number - b.number; // Tie-break by contestant number
      });

    // Assign final overall ranks
    let currentRank = 1;
    for (let i = 0; i < ranked.length; i++) {
      if (i > 0 && ranked[i].weighted_total < ranked[i - 1].weighted_total) {
        currentRank = i + 1;
      }
      ranked[i].overall_rank = currentRank;
    }

    const report = {
      title: report_title || 'Cross-Category Consolidation Report',
      categories: categories.map(c => ({ id: c.id, name: c.name, weight: c.weight, display_order: c.display_order })),
      contestants: ranked,
    };

    setToCache(cacheKey, report);

    return report;
  },

  /**
   * Calculate weighted scores and rank contestants for a single category.
   */
  _calculateRankings(contestants, criteria, scores) {
    if (!contestants.length || !criteria.length) return [];

    const scoresByContestantCriterion = {};
    for (const s of scores) {
      const key = `${s.contestant_id}:${s.criteria_id}`;
      if (!scoresByContestantCriterion[key]) scoresByContestantCriterion[key] = [];
      scoresByContestantCriterion[key].push(s.score);
    }

    const rankings = contestants.map((contestant) => {
      let totalScore = 0;
      for (const criterion of criteria) {
        const key = `${contestant.id}:${criterion.id}`;
        const judgeScores = scoresByContestantCriterion[key] || [];
        if (judgeScores.length === 0) continue;
        const avgScore = judgeScores.reduce((sum, s) => sum + s, 0) / judgeScores.length;
        totalScore += avgScore * criterion.weight;
      }
      return {
        contestant_id: contestant.id,
        contestant_number: contestant.number,
        contestant_name: contestant.name,
        total_score: Math.round(totalScore * 1000) / 1000,
      };
    });

    rankings.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.contestant_number - b.contestant_number;
    });

    let currentRank = 1;
    for (let i = 0; i < rankings.length; i++) {
      if (i > 0 && rankings[i].total_score < rankings[i - 1].total_score) {
        currentRank = i + 1;
      }
      rankings[i].rank = currentRank;
    }

    return rankings;
  },
};
