import Header from './Header';
import { useTheme } from '../context/ThemeContext';

export default function Layout({ children }) {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDark ? 'bg-zinc-950' : 'bg-slate-50'
    }`}>
      <Header />
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 ${
        isDark ? 'text-zinc-100' : ''
      }`}>
        {children}
      </main>
      <footer className={`border-t py-4 ${
        isDark 
          ? 'bg-zinc-900 border-zinc-800 text-zinc-400' 
          : 'bg-slate-100 border-slate-200 text-slate-500'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          Pageant Tabulator Pro &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}