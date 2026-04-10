import { Navigate, useLocation } from 'react-router-dom';
import { checkAdminSession } from '../pages/AdminLogin';

/**
 * ProtectedRoute for admin pages.
 * Redirects to /admin/login if no admin session exists.
 * Also redirects to /judge/dashboard if a judge session exists (prevents crossover).
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const rawJudge = sessionStorage.getItem('judge_session');

  // If there's an active judge session, redirect to judge portal
  if (rawJudge) {
    try {
      JSON.parse(rawJudge);
      return <Navigate to="/judge/dashboard" state={{ from: location }} replace />;
    } catch {
      sessionStorage.removeItem('judge_session');
      return <Navigate to="/judge/login" state={{ from: location }} replace />;
    }
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
  const raw = sessionStorage.getItem('judge_session');

  if (!raw) {
    return <Navigate to="/judge/login" state={{ from: location }} replace />;
  }

  try {
    JSON.parse(raw);
  } catch {
    sessionStorage.removeItem('judge_session');
    return <Navigate to="/judge/login" state={{ from: location }} replace />;
  }

  return children;
}
