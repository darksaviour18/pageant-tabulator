import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LogOut, Calendar } from 'lucide-react';

/**
 * Utility to get the current judge session from sessionStorage.
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

/**
 * Clear the current judge session.
 */
export function clearJudgeSession() {
  sessionStorage.removeItem('judge_session');
}

export default function JudgeDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const s = getJudgeSession();
    if (!s) {
      navigate('/judge/login');
      return;
    }
    setSession(s);
  }, [navigate]);

  const handleLogout = () => {
    clearJudgeSession();
    navigate('/judge/login');
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {session.judgeName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
            <Calendar className="w-4 h-4" />
            <span>{session.eventName}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Categories Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-400 text-lg">
          Scoring categories will appear here.
        </p>
        <p className="text-slate-400 text-sm mt-1">
          This feature is being built in Phase 6.
        </p>
      </div>
    </div>
  );
}
