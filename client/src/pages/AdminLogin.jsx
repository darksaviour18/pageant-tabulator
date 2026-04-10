import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, AlertCircle, ArrowLeft } from 'lucide-react';

const ADMIN_SESSION_KEY = 'admin_session';

export function checkAdminSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return !!raw && JSON.parse(raw).authenticated;
  } catch {
    return false;
  }
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem('admin_secret');
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!secret.trim()) {
      setError('Admin secret is required');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/admin', { secret: secret.trim() });
      if (res.data.success) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ authenticated: true }));
        sessionStorage.setItem('admin_secret', secret.trim());
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-4">
            <Shield className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Pageant Tabulator <span className="text-amber-400">Pro</span>
          </h1>
          <p className="text-slate-400 mt-1">Admin Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Admin Authentication</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Admin Secret
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter admin secret"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !secret.trim()}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Judge Portal Link */}
        <div className="text-center mt-6">
          <a
            href="/judge/login"
            className="text-sm text-slate-500 hover:text-amber-400 transition-colors"
          >
            ← Judge Scoring Portal
          </a>
        </div>
      </div>
    </div>
  );
}
