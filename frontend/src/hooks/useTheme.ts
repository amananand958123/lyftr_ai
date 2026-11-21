import { useState, useEffect } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lyftr-theme');
      if (saved) return saved === 'dark';
      return true;
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lyftr-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lyftr-theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return { isDark, toggleTheme };
}
