import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const getSystemDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export const ThemeProvider = ({ children }) => {
  // 'light' (Warm Light + Dark Studio Contrast, default) | 'dark' (Soft Twilight Night) | 'auto'
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('opic_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    return 'light';
  });

  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolvedTheme = themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('opic_theme_mode', themeMode);
    localStorage.setItem('opic_theme', resolvedTheme);
  }, [themeMode, resolvedTheme]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'auto' : 'light'));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        themeMode,
        setTheme: setThemeMode,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
