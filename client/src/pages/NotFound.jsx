import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="text-center py-20">
      <h1 className="text-6xl font-bold text-slate-300 mb-4">404</h1>
      <p className="text-lg text-slate-600 mb-6">Page not found</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Setup
      </Link>
    </div>
  );
}
