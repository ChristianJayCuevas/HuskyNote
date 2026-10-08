import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

/** The theme actually applied to the page. */
export type ThemeMode = 'dark' | 'light';
/** What the user chose. 'system' follows the operating system setting. */
export type ThemePreference = ThemeMode | 'system';

export interface Point {
  x: number;
  y: number;
}

interface ThemeContextType {
  /** Resolved theme ('dark' | 'light'), never 'system' */
  theme: ThemeMode;
  isDark: boolean;
  /** Stored choice, including 'system' */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Sets an explicit light or dark theme. The circular reveal only runs when an origin point is passed. */
  setTheme: (theme: ThemeMode, origin?: Point) => void;
  toggleTheme: (origin?: Point) => void;
}

const STORAGE_KEY = 'huskynote_theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const ThemeContext = createContext<ThemeContextType | null>(null);

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function systemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function writePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* storage unavailable; the choice lasts for this page only */
  }
}

function applyThemeToDOM(theme: ThemeMode): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === 'undefined' ? 'system' : readPreference()
  );
  const [system, setSystem] = useState<ThemeMode>(systemTheme);
  const theme: ThemeMode = preference === 'system' ? system : preference;

  // Tracks the theme being switched to, so rapid toggles don't read a stale render
  const themeRef = useRef<ThemeMode>(theme);
  themeRef.current = theme;

  // Follow the operating system while the preference is 'system'
  useEffect(() => {
    if (preference !== 'system' || !window.matchMedia) return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    onChange();
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, [preference]);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  /** Applies a new preference, with the circular reveal when an origin is given and the resolved theme changes. */
  const commit = useCallback((next: ThemePreference, origin?: Point) => {
    const nextTheme: ThemeMode = next === 'system' ? systemTheme() : next;
    const changesTheme = nextTheme !== themeRef.current;
    themeRef.current = nextTheme;

    const apply = () => {
      setPreferenceState(next);
      if (next === 'system') setSystem(nextTheme);
      writePreference(next);
      applyThemeToDOM(nextTheme);
    };

    const canAnimate =
      origin &&
      changesTheme &&
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canAnimate) {
      apply();
      return;
    }

    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    const cleanup = () => root.classList.remove('theme-transitioning');
    const startX = origin.x;
    const startY = origin.y;
    const endRadius = Math.hypot(
      Math.max(startX, window.innerWidth - startX),
      Math.max(startY, window.innerHeight - startY)
    );

    try {
      const transition = (document as any).startViewTransition(() => {
        apply();
      });
      transition.ready.then(() => {
        const animation = root.animate(
          {
            clipPath: [
              `circle(0px at ${startX}px ${startY}px)`,
              `circle(${endRadius}px at ${startX}px ${startY}px)`,
            ],
          },
          {
            duration: 500,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
        animation.onfinish = cleanup;
        animation.oncancel = cleanup;
      });
      transition.finished.finally(cleanup);
    } catch {
      cleanup();
      apply();
    }
  }, []);

  const setPreference = useCallback((next: ThemePreference) => commit(next), [commit]);
  const setTheme = useCallback((next: ThemeMode, origin?: Point) => commit(next, origin), [commit]);
  const toggleTheme = useCallback(
    (origin?: Point) => commit(themeRef.current === 'dark' ? 'light' : 'dark', origin),
    [commit]
  );

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      preference,
      setPreference,
      setTheme,
      toggleTheme,
    }),
    [theme, preference, setPreference, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
