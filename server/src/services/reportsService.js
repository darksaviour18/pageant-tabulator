import { getDb } from '../db/init.js';

export const reportsService = {
  /**
   * Generate a full report for a specific category.
   *
   * Aggregates all judges' scores, applies criterion weights,
   * calculates weighted totals per contestant, and ranks them.
   *
   * @param {number} eventId
   * @param {number} categoryId
   * @returns {{ category, criteria, judges, contestants, scores, rankings }}
   */
  generateCategoryReport(eventId, categoryId) {
    const db = getDb();

    // Verify event and category belong together
    const category = db
      .prepare('SELECT * FROM categories WHERE id = ? AND event_id = ?')
      .get(categoryId, eventId);

    if (!category) {
      return null;
    }

    // Get criteria for this category
    const criteria = db
      .prepare('SELECT id, name, weight, min_score, max_score FROM criteria WHERE category_id = ? ORDER BY display_order')
      .all(categoryId);

    // Get judges for this event
    const judges = db
      .prepare('SELECT id, seat_number, name FROM judges WHERE event_id = ? ORDER BY seat_number')
      .all(eventId);

    // Get active contestants for this event
    const contestants = db
      .prepare('SELECT id, number, name FROM contestants WHERE event_id = ? AND status = ? ORDER BY number')
      .all(eventId, 'active');

    // Get all scores for this category (all judges)
    const scores = db
      .prepare(
        'SELECT contestant_id, judge_id, criteria_id, score FROM scores WHERE category_id = ? AND score IS NOT NULL'
      )
      .all(categoryId);

    // Calculate weighted totals and rankings
    const rankings = this._calculateRankings(contestants, criteria, scores);

    return {
      category: {
        id: category.id,
        name: category.name,
        display_order: category.display_order,
        is_locked: !!category.is_locked,
      },
      criteria,
      judges,
      contestants,
      scores,
      rankings,
    };
  },

  /**
   * Calculate weighted scores and rank contestants.
   *
   * Formula: For each contestant, for each criterion:
   *   weighted_score = (sum of all judges' scores for that criterion) / (number of judges who scored it) * weight
   *   total = sum of all weighted_scores
   *
   * @param {Array} contestants
   * @param {Array} criteria
   * @param {Array} scores
   * @returns {Array<{ contestant_id, contestant_number, contestant_name, total_score, rank }>}
   */
  _calculateRankings(contestants, criteria, scores) {
    if (!contestants.length || !criteria.length) return [];

    // Build score lookup: scoresByContestantCriterion[contestantId][criteriaId] = [scores...]
    const scoresByContestantCriterion = {};
    for (const s of scores) {
      const key = `${s.contestant_id}:${s.criteria_id}`;
      if (!scoresByContestantCriterion[key]) {
        scoresByContestantCriterion[key] = [];
      }
      scoresByContestantCriterion[key].push(s.score);
    }

    const rankings = contestants.map((contestant) => {
      let totalScore = 0;

      for (const criterion of criteria) {
        const key = `${contestant.id}:${criterion.id}`;
        const judgeScores = scoresByContestantCriterion[key] || [];

        if (judgeScores.length === 0) continue;

        // Average score across judges for this criterion
        const avgScore = judgeScores.reduce((sum, s) => sum + s, 0) / judgeScores.length;

        // Apply weight (weight is 0-1, representing 0%-100%)
        totalScore += avgScore * criterion.weight;
      }

      return {
        contestant_id: contestant.id,
        contestant_number: contestant.number,
        contestant_name: contestant.name,
        total_score: Math.round(totalScore * 1000) / 1000, // Round to 3 decimal places
      };
    });

    // Sort by total_score descending, then by contestant_number ascending for ties
    rankings.sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return a.contestant_number - b.contestant_number;
    });

    // Assign ranks (tied scores get the same rank)
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
