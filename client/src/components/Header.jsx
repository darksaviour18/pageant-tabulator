import { Crown, LogOut } from 'lucide-react';
import { clearAdminSession } from '../pages/AdminLogin';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function Header() {
  const handleLogout = () => {
    clearAdminSession();
    window.location.href = '/admin/login';
  };

  const { isDark } = useTheme();

  return (
    <header className="shadow-lg bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Crown className="w-7 h-7 text-[var(--color-cta)]" aria-hidden="true" />
            <h1 className="text-xl font-bold tracking-tight">
              Pageant Tabulator <span className="text-[var(--color-cta)]">Pro</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
              aria-label="Sign out of admin dashboard"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}