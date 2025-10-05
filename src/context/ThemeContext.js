import { createContext, useContext, useState } from 'react';

export const themes = {
  blue: {
    name: 'Blue',
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    secondary: '#1d4ed8',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
  },
  green: {
    name: 'Green',
    primary: '#059669',
    primaryLight: '#10b981',
    secondary: '#047857',
    background: '#ffffff',
    surface: '#f0fdf4',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#d1fae5',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
  },
  orange: {
    name: 'Orange',
    primary: '#ea580c',
    primaryLight: '#f97316',
    secondary: '#c2410c',
    background: '#ffffff',
    surface: '#fff7ed',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#fed7aa',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('blue');

  const changeTheme = (themeName) => {
    setCurrentTheme(themeName);
  };

  const value = {
    theme: themes[currentTheme],
    currentTheme,
    changeTheme,
    availableThemes: Object.keys(themes).map(key => ({
      key,
      name: themes[key].name,
    })),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
