import { getDb } from '../db/init.js';

const DEFAULT_CACHE_TTL_MS = parseInt(process.env.REPORT_CACHE_TTL_MS, 10) || 5 * 60 * 1000; // 5 minutes

const reportCache = new Map();

// 15.5.4: Periodic cleanup for expired cache entries
const CACHE_CLEANUP_INTERVAL_MS = 60000; // Clean up every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of reportCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      reportCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL_MS);

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

    const eventRow = db.prepare('SELECT scoring_mode FROM events WHERE id = ?').get(eventId);
    const scoring_mode = eventRow?.scoring_mode || 'direct';

    const criteria = db
      .prepare('SELECT id, name, weight, min_score, max_score FROM criteria WHERE category_id = ? ORDER BY display_order')
      .all(categoryId);

    const judges = db
      .prepare('SELECT id, seat_number, name FROM judges WHERE event_id = ? ORDER BY seat_number')
      .all(eventId);

    const categoryRow = db.prepare('SELECT required_round_id FROM categories WHERE id = ?').get(categoryId);

    let contestants;
    if (categoryRow?.required_round_id) {
      contestants = db
        .prepare(
          `SELECT c.id, c.number, c.name
           FROM contestants c
           INNER JOIN round_qualifiers rq ON rq.contestant_id = c.id
           WHERE rq.round_id = ? AND c.event_id = ? AND c.status = 'active'
           ORDER BY c.number`
        )
        .all(categoryRow.required_round_id, eventId);
    } else {
      contestants = db
        .prepare('SELECT id, number, name FROM contestants WHERE event_id = ? AND status = ? ORDER BY number')
        .all(eventId, 'active');
    }

    const scores = db
      .prepare(
        'SELECT contestant_id, judge_id, criteria_id, score FROM scores WHERE category_id = ? AND score IS NOT NULL'
      )
      .all(categoryId);

    const rankings = this._calculateRankings(contestants, criteria, scores, scoring_mode);

    const ranked_contestants = rankings.map(r => ({
      id: r.contestant_id,
      number: r.contestant_number,
      name: r.contestant_name,
      overall_rank: r.rank,
      weighted_total: r.total_score,
    }));

    const report = {
      category: {
        id: category.id,
        name: category.name,
        display_order: category.display_order,
        is_locked: !!category.is_locked,
        required_round_id: categoryRow?.required_round_id ?? null,
      },
      criteria,
      judges,
      contestants,
      scores,
      rankings,
      ranked_contestants,
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

    // Verify all categories belong to this event (fetch with required_round_id)
    const placeholders = categoryIds.map(() => '?').join(',');
    const categories = db
      .prepare(
        `SELECT id, name, weight, display_order, required_round_id
         FROM categories WHERE id IN (${placeholders}) AND event_id = ?
         ORDER BY display_order`
      )
      .all(...categoryIds, eventId);

    if (categories.length !== categoryIds.length) return null;

    // Build the eligible contestant pool as the intersection of all categories' eligible sets.
    // A contestant must be eligible in every selected category to appear in this report.
    // Categories with no required_round_id accept all active contestants.
    const allActive = db
      .prepare(`SELECT id, number, name FROM contestants WHERE event_id = ? AND status = 'active' ORDER BY number`)
      .all(eventId);

    let eligibleIds = new Set(allActive.map(c => c.id));

    for (const cat of categories) {
      if (cat.required_round_id) {
        const qualifiers = db
          .prepare('SELECT contestant_id FROM round_qualifiers WHERE round_id = ?')
          .all(cat.required_round_id);
        const qualifierSet = new Set(qualifiers.map(q => q.contestant_id));
        eligibleIds = new Set([...eligibleIds].filter(id => qualifierSet.has(id)));
      }
    }

    const contestants = allActive.filter(c => eligibleIds.has(c.id));

    if (contestants.length === 0) {
      return {
        title: report_title || 'Cross-Category Report',
        categories: categories.map(c => ({ id: c.id, name: c.name, weight: c.weight, display_order: c.display_order })),
        contestants: [],
        eligible_count: 0,
        total_active_count: allActive.length,
        filtered_by_rounds: categories.filter(c => c.required_round_id).map(c => ({
          category_id: c.id,
          round_id: c.required_round_id,
        })),
      };
    }

    // Calculate total weights for normalization
    const totalWeight = categories.reduce((sum, cat) => sum + (cat.weight || 1), 0);
    const categoryWeightMap = {};
    categories.forEach(cat => {
      categoryWeightMap[cat.id] = cat.weight || 1;
    });

    // Get total scores per contestant per category
    const categoryScores = db
      .prepare(
        `SELECT contestant_id, category_id, SUM(score) as total_score
         FROM scores
         WHERE category_id IN (${placeholders})
         GROUP BY contestant_id, category_id`
      )
      .all(...categoryIds);

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
      categories: categories.map(c => ({
        id: c.id, name: c.name, weight: c.weight, display_order: c.display_order,
      })),
      contestants: ranked,
      eligible_count: contestants.length,
      total_active_count: allActive.length,
      filtered_by_rounds: categories
        .filter(c => c.required_round_id)
        .map(c => ({ category_id: c.id, round_id: c.required_round_id })),
    };

    setToCache(cacheKey, report);

    return report;
  },

  /**
   * Calculate weighted scores and rank contestants for a single category.
   */
  _calculateRankings(contestants, criteria, scores, scoring_mode = 'direct') {
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
        if (scoring_mode === 'weighted') {
          totalScore += avgScore * criterion.weight;
        } else {
          totalScore += avgScore;
        }
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
