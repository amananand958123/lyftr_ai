import { useState, useEffect } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lyftr-theme');
        if (saved) return saved === 'dark';
      } catch {
        // localStorage may be disabled in private browsing
      }
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
    }
    return true;
  });

  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('lyftr-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('lyftr-theme', 'light');
      }
    } catch {
      // ignore storage write errors in private mode
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return { isDark, toggleTheme };
}
