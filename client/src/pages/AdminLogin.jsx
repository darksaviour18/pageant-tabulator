import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, AlertCircle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

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

  useEffect(() => {
    if (checkAdminSession()) {
      navigate('/');
    }
  }, [navigate]);

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
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <ThemeToggle className="fixed top-4 right-4" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-secondary-light)] mb-4 ring-1 ring-[var(--color-primary)]">
            <Shield className="w-10 h-10 text-[var(--color-cta)]" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text)] tracking-tight">
            Pageant Tabulator <span className="text-[var(--color-cta)]">Pro</span>
          </h1>
          <p className="text-[var(--color-text-muted)] mt-2 text-sm">Admin Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-[var(--color-bg-elevated)] backdrop-blur-xl rounded-2xl shadow-xl p-8 border border-[var(--color-border)]">
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">Admin Authentication</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                Admin Secret
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter admin secret"
                className="w-full px-4 py-3 min-h-[48px] border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-cta)]/50 focus:border-[var(--color-cta)] outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)]"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 px-4 py-3 rounded-lg border border-[var(--color-error)]/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !secret.trim()}
              className="w-full py-3 bg-[var(--color-cta)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
