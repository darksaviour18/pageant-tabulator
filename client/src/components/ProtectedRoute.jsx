import { Navigate, useLocation } from 'react-router-dom';

/**
 * ProtectedRoute for admin pages.
 * Redirects to /judge/login if a judge session exists (prevents admin from accessing judge routes accidentally).
 * For true admin protection, this wraps the admin Layout and checks there's no judge session active.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const raw = sessionStorage.getItem('judge_session');

  // If there's an active judge session, redirect to judge portal
  if (raw) {
    try {
      const session = JSON.parse(raw);
      // Session exists — this is a judge's browser, not admin
      return <Navigate to="/judge/dashboard" state={{ from: location }} replace />;
    } catch {
      // Invalid session data — was likely a judge's browser with corrupted state
      sessionStorage.removeItem('judge_session');
      return <Navigate to="/judge/login" state={{ from: location }} replace />;
    }
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
