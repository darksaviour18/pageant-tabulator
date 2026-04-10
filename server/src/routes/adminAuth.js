import { Router } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123'; // Default for dev, must be overridden in prod

/**
 * POST /api/auth/admin
 * Authenticate admin with a secret/password.
 */
router.post('/', (req, res) => {
  const { secret } = req.body;

  if (!secret) {
    return res.status(400).json({ error: 'secret is required' });
  }

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }

  return res.json({ success: true });
});

export default router;
