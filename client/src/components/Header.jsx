import { Crown, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
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
            <Link
              to="/judge/login"
              className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-amber-400 transition-colors"
            >
              <User className="w-4 h-4" />
              Judge Portal
            </Link>
            <div className="text-sm text-slate-500 hidden sm:block">
              Admin Dashboard
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
