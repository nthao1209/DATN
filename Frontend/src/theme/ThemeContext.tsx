import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { darkColors, lightColors } from './colors';
import { effects } from './effects';


interface ThemeContextType {
  colors: typeof darkColors;
  effects: typeof effects;
  isDarkMode: boolean;
  toggleTheme : () => void;
}


const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  useEffect(() =>{
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if(isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const themeValue = {
    colors: isDarkMode ? darkColors : lightColors,
    effects,
    isDarkMode,
    toggleTheme,
  }
  return (
    <ThemeContext.Provider value={themeValue}>
      <div style={{ 
        backgroundColor: themeValue.colors.background, 
        color: themeValue.colors.textPrimary,
        minHeight: '100vh',
        transition: 'background-color 0.3s ease, color 0.3s ease',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale'
      }}>
      {children}
      </div>
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