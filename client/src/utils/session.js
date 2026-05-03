/**
 * Judge session management using localStorage.
 * Survives tab/browser close — judges are not logged out by accident.
 */

export function getJudgeSession() {
  try {
    const raw = localStorage.getItem('judge_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearJudgeSession() {
  localStorage.removeItem('judge_session');
}
