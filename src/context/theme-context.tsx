import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface Point {
  x: number;
  y: number;
}

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode, origin?: Point) => void;
  toggleTheme: (origin?: Point) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('huskynote_theme') as ThemeMode;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return 'dark'; // Dark mode is default
  });

  // Tracks the theme being switched to, so rapid toggles don't read a stale render
  const themeRef = useRef<ThemeMode>(theme);

  const applyThemeToDOM = useCallback((newTheme: ThemeMode) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, []);

  const setTheme = useCallback(
    (newTheme: ThemeMode, origin?: Point) => {
      themeRef.current = newTheme;
      const apply = () => {
        setThemeState(newTheme);
        if (typeof window !== 'undefined') {
          localStorage.setItem('huskynote_theme', newTheme);
          applyThemeToDOM(newTheme);
        }
      };

      // Native circular view transition with bidirectional sweep
      if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        const root = document.documentElement;
        root.classList.add('theme-transitioning');

        const isSwitchingToDark = newTheme === 'dark';

        // When returning to dark mode: reversal transition from bottom-left to top-right!
        // When switching to light mode: transition from rope position (top-right) expanding to bottom-left!
        const startX = isSwitchingToDark ? 0 : (origin?.x ?? window.innerWidth - 60);
        const startY = isSwitchingToDark ? window.innerHeight : (origin?.y ?? 60);

        const endRadius = Math.hypot(
          Math.max(startX, window.innerWidth - startX),
          Math.max(startY, window.innerHeight - startY)
        );

        const cleanup = () => {
          root.classList.remove('theme-transitioning');
        };

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
                duration: 700,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
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
      } else {
        apply();
      }
    },
    [applyThemeToDOM]
  );

  const toggleTheme = useCallback(
    (origin?: Point) => {
      const nextTheme = themeRef.current === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme, origin);
    },
    [setTheme]
  );

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme, applyThemeToDOM]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
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
