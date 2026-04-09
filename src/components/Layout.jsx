import Header from './Header';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-slate-100 border-t border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
          Pageant Tabulator Pro &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
