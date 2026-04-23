import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/* eslint-disable react-refresh/only-export-components */
export const ThemeContext = createContext(null);

const THEME_STORAGE_KEY = 'pageant-theme';

export function ThemeProvider({ children, defaultMode = 'light' }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return defaultMode;
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) return stored;
    return defaultMode;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setThemeMode = useCallback((mode) => {
    setTheme(mode);
  }, []);

  const value = {
    theme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    toggleTheme,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}