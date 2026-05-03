import { Navigate, useLocation } from 'react-router-dom';
import { checkAdminSession } from '../pages/AdminLogin';
import { getJudgeSession, clearJudgeSession } from '../utils/session';

/**
 * ProtectedRoute for admin pages.
 * Redirects to /admin/login if no admin session exists.
 * Also redirects to /judge/dashboard if a judge session exists (prevents crossover).
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const rawJudge = getJudgeSession();

  // If there's an active judge session, redirect to judge portal
  if (rawJudge) {
    return <Navigate to="/judge/dashboard" state={{ from: location }} replace />;
  }

  // Check admin session
  if (!checkAdminSession()) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * JudgeProtectedRoute for judge portal pages.
 * Redirects to /judge/login if no active judge session.
 */
export function JudgeProtectedRoute({ children }) {
  const location = useLocation();
  const raw = getJudgeSession();

  if (!raw) {
    return <Navigate to="/judge/login" state={{ from: location }} replace />;
  }

  return children;
}
