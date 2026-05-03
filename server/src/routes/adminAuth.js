import { Router } from 'express';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || ADMIN_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

if (!ADMIN_SECRET) {
  console.error('[Auth] FATAL: ADMIN_SECRET must be set in environment');
  process.exit(1);
}

/**
 * POST /api/auth/admin
 * Authenticate admin with a secret/password, issue JWT in httpOnly cookie.
 */
router.post('/', (req, res) => {
  const { secret } = req.body;

  if (!secret) {
    return res.status(400).json({ error: 'secret is required' });
  }

  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin secret' });
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  res.setHeader('Set-Cookie', cookie.serialize('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  }));

  return res.json({ success: true, token });
});

/**
 * POST /api/auth/admin/logout
 * Clear the admin cookie.
 */
router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', cookie.serialize('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  }));
  return res.json({ success: true });
});

/**
 * Middleware: verify admin JWT from cookie.
 */
export function verifyAdmin(req, res, next) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.admin_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.adminAuth = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Sign a short-lived JWT for an authenticated judge.
 * @param {number} judgeId
 * @returns {string} signed JWT
 */
export function signJudgeToken(judgeId) {
  return jwt.sign({ role: 'judge', judgeId }, JWT_SECRET, { expiresIn: '12h' });
}

/**
 * Middleware: verify judge JWT from Authorization header.
 * Attaches req.judgeAuth = { judgeId } on success.
 */
export function verifyJudge(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Judge authentication required' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'judge') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.judgeAuth = { judgeId: decoded.judgeId };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired judge token' });
  }
}

export default router;
