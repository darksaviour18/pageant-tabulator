import Header from './Header';
import { useTheme } from '../context/ThemeContext';

export default function Layout({ children }) {
  const { isDark } = useTheme();

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200 bg-[var(--color-bg)]">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 text-[var(--color-text)]">
        {children}
      </main>
      <footer className="border-t py-4 bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          Pageant Tabulator Pro &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}