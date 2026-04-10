import { Crown, LogOut } from 'lucide-react';
import { clearAdminSession } from '../pages/AdminLogin';

export default function Header() {
  const handleLogout = () => {
    clearAdminSession();
    window.location.href = '/admin/login';
  };

  return (
    <header className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Crown className="w-7 h-7 text-amber-400" />
            <h1 className="text-xl font-bold tracking-tight">
              Pageant Tabulator <span className="text-amber-400">Pro</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
