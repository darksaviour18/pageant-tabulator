import { Router } from 'express';
import { reportsService, invalidateReportCache } from '../services/reportsService.js';
import { getDb } from '../db/init.js';
import { writeAuditLog } from '../services/auditService.js';
import { verifyAdmin } from './adminAuth.js';

const router = Router({ mergeParams: true });

/**
 * GET /api/reports/:eventId/category/:categoryId
 * Generate a full tabulation report for a specific category.
 */
router.get('/:eventId/category/:categoryId', (req, res, next) => {
  const { eventId, categoryId } = req.params;

  try {
    const report = reportsService.generateCategoryReport(
      parseInt(eventId, 10),
      parseInt(categoryId, 10)
    );

    if (!report) {
      return res.status(404).json({ error: 'Category not found for this event' });
    }

    writeAuditLog(
      parseInt(eventId, 10),
      null,
      'report_generated',
      { report_type: 'category_detail', category_id: parseInt(categoryId, 10), cached: !!report._cached }
    );

    return res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reports/:eventId/cross-category
 * Generate a cross-category consolidation report.
 * Aggregates ranks across multiple categories using rank-sum logic.
 */
router.post('/:eventId/cross-category', (req, res, next) => {
  const { eventId } = req.params;
  const { category_ids, aggregation_type, report_title } = req.body;

  if (!category_ids || !Array.isArray(category_ids) || category_ids.length === 0) {
    return res.status(400).json({ error: 'category_ids array is required and must not be empty' });
  }

  try {
    const report = reportsService.generateCrossCategoryReport(
      parseInt(eventId, 10),
      { categoryIds: category_ids, aggregation_type, report_title }
    );

    if (!report) {
      return res.status(404).json({ error: 'One or more categories not found for this event' });
    }

    writeAuditLog(
      parseInt(eventId, 10),
      null,
      'report_generated',
      { report_type: 'cross_category', category_ids, aggregation_type, report_title, cached: !!report._cached }
    );

    return res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reports/save
 * Save a report configuration for later reference.
 */
router.post('/save', verifyAdmin, (req, res, next) => {
  const { event_id, report_type, report_title, configuration } = req.body;

  if (!event_id || !report_type || !report_title) {
    return res.status(400).json({ error: 'event_id, report_type, and report_title are required' });
  }

  try {
    const db = getDb();
    const result = db
      .prepare(
        'INSERT INTO saved_reports (event_id, report_type, report_title, configuration) VALUES (?, ?, ?, ?)'
      )
      .run(event_id, report_type, report_title, JSON.stringify(configuration));

    const saved = db
      .prepare('SELECT * FROM saved_reports WHERE id = ?')
      .get(result.lastInsertRowid);

    writeAuditLog(
      parseInt(event_id, 10),
      null,
      'report_saved',
      { report_type, report_title, configuration, saved_report_id: saved.id }
    );

    return res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/reports/saved/:id?event_id=X
 * Delete a saved report configuration.
 */
router.delete('/saved/:id', verifyAdmin, (req, res, next) => {
  const { id } = req.params;
  const { event_id } = req.query;

  if (!event_id) {
    return res.status(400).json({ error: 'event_id query parameter is required' });
  }

  try {
    const db = getDb();
    const saved = db.prepare('SELECT * FROM saved_reports WHERE id = ?').get(parseInt(id, 10));

    if (!saved) {
      return res.status(404).json({ error: 'Saved report not found' });
    }

    // Verify report belongs to this event
    if (saved.event_id !== parseInt(event_id, 10)) {
      return res.status(404).json({ error: 'Saved report not found for this event' });
    }

    db.prepare('DELETE FROM saved_reports WHERE id = ?').run(parseInt(id, 10));

    writeAuditLog(
      saved.event_id,
      null,
      'report_deleted',
      { report_type: saved.report_type, report_title: saved.report_title, saved_report_id: saved.id }
    );

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/saved?event_id=X
 * List all saved reports for an event.
 */
router.get('/saved', (req, res, next) => {
  const { event_id } = req.query;

  if (!event_id) {
    return res.status(400).json({ error: 'event_id query parameter is required' });
  }

  try {
    const db = getDb();
    const reports = db
      .prepare('SELECT * FROM saved_reports WHERE event_id = ? ORDER BY created_at DESC')
      .all(event_id);

    return res.json(reports);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/:eventId/category/:categoryId/csv
 * Download category report as CSV file.
 */
router.get('/:eventId/category/:categoryId/csv', (req, res, next) => {
  const { eventId, categoryId } = req.params;

  try {
    const report = reportsService.generateCategoryReport(
      parseInt(eventId, 10),
      parseInt(categoryId, 10)
    );

    if (!report) {
      return res.status(404).json({ error: 'Category not found for this event' });
    }

    const csv = reportToCsv(report, report.category?.name);
    const filename = `${report.category?.name || 'report'}_${eventId}.csv`.replace(/[^a-z0-9_]/gi, '_');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
});

/**
 * Helper: convert report data to CSV format.
 * Iterates report.rankings for contestant-level rows and looks up
 * per-criterion average scores from report.scores.
 */
function reportToCsv(report, categoryName) {
  if (!report || !report.rankings || report.rankings.length === 0) {
    return '';
  }

  // Group scores by contestant_id and criteria_id, compute averages
  const scoreMap = {}; // { contestant_id: { criteria_id: [scores] } }
  for (const s of report.scores) {
    if (!scoreMap[s.contestant_id]) scoreMap[s.contestant_id] = {};
    if (!scoreMap[s.contestant_id][s.criteria_id]) scoreMap[s.contestant_id][s.criteria_id] = [];
    scoreMap[s.contestant_id][s.criteria_id].push(s.score);
  }

  const lines = [];
  const headers = ['Rank', 'Contestant', 'Number', ...report.criteria.map(c => c.name), 'Total'];
  lines.push(headers.map(h => `"${h}"`).join(','));

  for (const ranking of report.rankings) {
    const criteriaScores = report.criteria.map(c => {
      const scores = scoreMap[ranking.contestant_id]?.[c.id];
      if (!scores || scores.length === 0) return '';
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      return Math.round(avg * 100) / 100;
    });
    const line = [
      ranking.rank || '',
      `"${ranking.contestant_name}"`,
      ranking.contestant_number,
      ...criteriaScores,
      ranking.total_score,
    ];
    lines.push(line.join(','));
  }

  return lines.join('\n');
}

export default router;
