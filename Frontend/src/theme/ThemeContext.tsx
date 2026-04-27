import React, { createContext, useContext, type ReactNode } from 'react';
import { colors } from './colors';
import { effects } from './effects';


const theme = {
  colors,
  effects,
};

type ThemeType = typeof theme;

const ThemeContext = createContext<ThemeType>(theme);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeContext.Provider value={theme}>
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