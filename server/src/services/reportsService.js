import { getDb } from '../db/init.js';

export const reportsService = {
  /**
   * Generate a full report for a specific category.
   */
  generateCategoryReport(eventId, categoryId) {
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

    return {
      category: { id: category.id, name: category.name, display_order: category.display_order, is_locked: !!category.is_locked },
      criteria,
      judges,
      contestants,
      scores,
      rankings,
    };
  },

  /**
   * Generate a cross-category consolidation report.
   * Aggregates ranks across multiple categories using rank-sum logic.
   *
   * @param {number} eventId
   * @param {{ categoryIds: number[], aggregation_type?: 'rank_sum' | 'score_sum', report_title?: string }} config
   * @returns {object|null}
   */
  generateCrossCategoryReport(eventId, { categoryIds, aggregation_type = 'rank_sum', report_title }) {
    const db = getDb();

    if (!categoryIds || categoryIds.length === 0) return null;

    // Verify all categories belong to this event
    const categories = db
      .prepare(
        `SELECT id, name, display_order FROM categories WHERE id IN (${categoryIds.join(',')}) AND event_id = ? ORDER BY display_order`
      )
      .all(eventId);

    if (categories.length !== categoryIds.length) return null;

    const contestants = db
      .prepare('SELECT id, number, name FROM contestants WHERE event_id = ? AND status = ? ORDER BY number')
      .all(eventId, 'active');

    if (contestants.length === 0) return { title: report_title || 'Cross-Category Report', categories, contestants: [], rankings: [] };

    // Build rank matrix: for each category, rank contestants by total score
    const categoryRanks = {};
    const catIdList = categoryIds.join(',');

    // Use window functions to calculate per-category ranks
    // First get total scores per contestant per category
    const categoryScores = db
      .prepare(
        `SELECT contestant_id, category_id, SUM(score) as total_score
         FROM scores
         WHERE category_id IN (${catIdList})
         GROUP BY contestant_id, category_id`
      )
      .all();

    // Group by category and calculate ranks
    const byCategory = {};
    for (const row of categoryScores) {
      if (!byCategory[row.category_id]) byCategory[row.category_id] = [];
      byCategory[row.category_id].push(row);
    }

    // Calculate ranks within each category
    for (const catId of categoryIds) {
      const entries = (byCategory[catId] || [])
        .sort((a, b) => b.total_score - a.total_score);

      // Assign ranks with ties
      let currentRank = 1;
      for (let i = 0; i < entries.length; i++) {
        if (i > 0 && entries[i].total_score < entries[i - 1].total_score) {
          currentRank = i + 1;
        }
        entries[i].rank = currentRank;
      }

      categoryRanks[catId] = entries;
    }

    // Build contestant matrix: contestant → { categoryId: rank }
    const contestantData = {};
    for (const c of contestants) {
      contestantData[c.id] = {
        id: c.id,
        number: c.number,
        name: c.name,
        category_ranks: {},
        total_rank: 0,
      };
    }

    // Fill in ranks per category
    for (const catId of categoryIds) {
      for (const entry of categoryRanks[catId] || []) {
        if (contestantData[entry.contestant_id]) {
          contestantData[entry.contestant_id].category_ranks[catId] = entry.rank;
        }
      }
    }

    // Calculate total rank (sum of all category ranks)
    for (const c of contestants) {
      const data = contestantData[c.id];
      let totalRank = 0;
      let categoriesWithRank = 0;
      for (const catId of categoryIds) {
        if (data.category_ranks[catId] !== undefined) {
          totalRank += data.category_ranks[catId];
          categoriesWithRank++;
        }
      }
      data.total_rank = totalRank;
      data.categories_scored = categoriesWithRank;
    }

    // Rank contestants by total_rank (lower = better)
    const ranked = Object.values(contestantData)
      .filter(c => c.categories_scored > 0)
      .sort((a, b) => {
        if (a.total_rank !== b.total_rank) return a.total_rank - b.total_rank;
        return a.number - b.number; // Tie-break by contestant number
      });

    // Assign final overall ranks
    let currentRank = 1;
    for (let i = 0; i < ranked.length; i++) {
      if (i > 0 && ranked[i].total_rank > ranked[i - 1].total_rank) {
        currentRank = i + 1;
      }
      ranked[i].overall_rank = currentRank;
    }

    return {
      title: report_title || 'Cross-Category Consolidation Report',
      categories: categories.map(c => ({ id: c.id, name: c.name, display_order: c.display_order })),
      contestants: ranked,
    };
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
