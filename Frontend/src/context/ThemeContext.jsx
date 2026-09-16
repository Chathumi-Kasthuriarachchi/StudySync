import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { updateUserPreferences } from '../services/userService';

const ThemeContext = createContext(null);

const THEME_STORAGE_KEY = 'studysync_theme';

const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * ThemeProvider
 * 
 * Manages application appearance mode: 'light', 'dark', or 'system'.
 * Synchronizes with:
 * 1. document.documentElement ('dark' class)
 * 2. localStorage ('studysync_theme')
 * 3. System prefers-color-scheme media query (when set to 'system')
 * 4. Authenticated user preferences in MongoDB
 */
export const ThemeProvider = ({ children }) => {
  const { user, updateUser } = useAuth();

  // Initialize theme from user preference, or localStorage, or default to 'system'
  const [theme, setThemeState] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      return saved;
    }
    return 'system';
  });

  // Track OS system theme
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  // Derived resolved theme ('light' or 'dark')
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  // Listen for OS system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  // Sync DOM and localStorage whenever resolvedTheme or theme changes
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [resolvedTheme, theme]);

  // Setter that also syncs to backend if syncBackend is true
  const setTheme = useCallback(async (newTheme, syncBackend = true) => {
    if (!['light', 'dark', 'system'].includes(newTheme)) return;

    setThemeState(newTheme);

    if (syncBackend && user) {
      try {
        await updateUserPreferences({ theme: newTheme });
        if (updateUser) {
          updateUser({
            preferences: {
              ...(user.preferences || {}),
              theme: newTheme,
            },
          });
        }
      } catch (err) {
        console.warn('Could not sync theme preference to backend:', err.message);
      }
    }
  }, [user, updateUser]);

  // Quick toggle (used by TopBar sun/moon icon)
  const toggleTheme = useCallback(() => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme, true);
  }, [resolvedTheme, setTheme]);

  const value = {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
