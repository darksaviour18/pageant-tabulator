import { useState } from 'react';
import { Crown, LogOut, ChevronDown } from 'lucide-react';
import { clearAdminSession } from '../pages/AdminLogin';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { useEvent } from '../context/EventContext';

export default function Header() {
  const handleLogout = () => {
    clearAdminSession();
    window.location.href = '/admin/login';
  };

  const { isDark } = useTheme();
  const eventContext = useEvent();
  
  // Safety check - if not in EventProvider, return null
  if (!eventContext) return null;
  
  const { events, selectedEvent, setSelectedEventId } = eventContext;
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
            {events.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-cta)] transition-colors text-sm"
                  aria-haspopup="listbox"
                  aria-expanded={dropdownOpen}
                >
                  <span className="max-w-[150px] truncate">{selectedEvent?.name || 'Select Event'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
                    {events.map(event => (
                      <button
                        key={event.id}
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-bg-subtle)] first:rounded-t-lg last:rounded-b-lg transition-colors
                          ${selectedEvent?.id === event.id ? 'text-[var(--color-cta)] font-medium' : 'text-[var(--color-text)]'}`}
                      >
                        <span className="flex items-center justify-between">
                          {event.name}
                          {event.status === 'active' && (
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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