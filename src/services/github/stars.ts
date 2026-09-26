import { useState, useEffect, useCallback, useRef } from 'react';

const REPO_OWNER = 'ChristianJayCuevas';
const REPO_NAME = 'HuskyNote';
const CACHE_KEY = `github_stars_${REPO_OWNER}_${REPO_NAME}`;
const CACHE_TIME_KEY = `${CACHE_KEY}_timestamp`;

/**
 * Fetch live stargazers count from GitHub API with Shields.io fallback
 */
export async function fetchLiveGitHubStars(): Promise<number | null> {
  // 1. Try primary GitHub REST API with timestamp cache-buster
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}?t=${Date.now()}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    });

    if (res.ok) {
      const data = await res.json();
      if (typeof data.stargazers_count === 'number') {
        try {
          localStorage.setItem(CACHE_KEY, data.stargazers_count.toString());
          localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        } catch {
          // LocalStorage optional
        }
        return data.stargazers_count;
      }
    }
  } catch (err) {
    console.warn('[HuskyNote] GitHub API stars fetch error:', err);
  }

  // 2. Fallback to Shields.io badge JSON (unthrottled public proxy)
  try {
    const fallbackRes = await fetch(`https://img.shields.io/github/stars/${REPO_OWNER}/${REPO_NAME}.json?t=${Date.now()}`, {
      cache: 'no-cache',
    });
    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      const rawCount = fbData.value ?? fbData.message;
      if (rawCount) {
        const parsed = parseInt(String(rawCount).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed)) {
          try {
            localStorage.setItem(CACHE_KEY, parsed.toString());
            localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
          } catch {
            // LocalStorage optional
          }
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[HuskyNote] Shields fallback stars fetch error:', err);
  }

  // 3. Fallback to cached value in localStorage
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached !== null) {
      const parsed = parseInt(cached, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * React hook to keep GitHub stars synchronized in real time.
 * Automatically updates when the window regains focus (e.g. user returns after starring)
 * and polls periodically in the background.
 */
export function useGitHubStars(): {
  starCount: number | null;
  isSyncing: boolean;
  refreshStars: () => Promise<void>;
} {
  const [starCount, setStarCount] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
      return cached !== null ? parseInt(cached, 10) : null;
    } catch {
      return null;
    }
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isMountedRef = useRef(true);

  const refreshStars = useCallback(async () => {
    setIsSyncing(true);
    try {
      const count = await fetchLiveGitHubStars();
      if (isMountedRef.current && count !== null) {
        setStarCount(count);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Immediately fetch fresh count on mount
    refreshStars();

    // Auto-refresh when user focuses back onto the page (e.g. after clicking Star and returning)
    const handleFocus = () => {
      refreshStars();
    };

    // Auto-refresh when document becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshStars();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic sync every 45 seconds while viewing
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshStars();
      }
    }, 45000);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [refreshStars]);

  return { starCount, isSyncing, refreshStars };
}
