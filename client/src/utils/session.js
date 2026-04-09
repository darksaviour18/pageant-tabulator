/**
 * Judge session management using sessionStorage.
 */

export function getJudgeSession() {
  try {
    const raw = sessionStorage.getItem('judge_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearJudgeSession() {
  sessionStorage.removeItem('judge_session');
}
