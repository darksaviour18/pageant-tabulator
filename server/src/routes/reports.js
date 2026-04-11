import { Router } from 'express';
import { reportsService } from '../services/reportsService.js';
import { getDb } from '../db/init.js';

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

    return res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reports/save
 * Save a report configuration for later reference.
 */
router.post('/save', (req, res, next) => {
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

    return res.status(201).json(saved);
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

export default router;
