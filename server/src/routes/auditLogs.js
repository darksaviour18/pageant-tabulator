import { Router } from 'express';
import { getAuditLogs } from '../services/auditService.js';

const router = Router();

/**
 * GET /api/audit-logs/:eventId
 * Get audit logs for an event.
 */
router.get('/:eventId', (req, res, next) => {
  const { eventId } = req.params;
  const { limit = 100, offset = 0, action } = req.query;

  try {
    const logs = getAuditLogs(parseInt(eventId, 10), {
      limit: parseInt(limit, 10) || 100,
      offset: parseInt(offset, 10) || 0,
      action,
    });
    return res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;