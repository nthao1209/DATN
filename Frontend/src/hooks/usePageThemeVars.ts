import { useMemo, type CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeContext';

type PageThemeVars = CSSProperties & Record<`--page-${string}`, string>;

export const usePageThemeVars = (): PageThemeVars => {
  const { colors, isDarkMode } = useTheme();

  return useMemo(
    () => ({
      '--page-primary': colors.primary,
      '--page-primary-08': `${colors.primary}08`,
      '--page-primary-11': `${colors.primary}11`,
      '--page-primary-15': `${colors.primary}15`,
      '--page-primary-22': `${colors.primary}22`,
      '--page-primary-33': `${colors.primary}33`,
      '--page-primary-66': `${colors.primary}66`,
      '--page-surface': colors.surface,
      '--page-surface-light': colors.surfaceLight,
      '--page-background': colors.background,
      '--page-border': colors.border,
      '--page-border-light': colors.borderLight,
      '--page-text-primary': colors.textPrimary,
      '--page-text-secondary': colors.textSecondary,
      '--page-text-muted': colors.textMuted,
      '--page-warning': colors.warning,
      '--page-success': colors.success,
      '--page-primary-glow': colors.primaryGlow,
      '--page-filter-bg': isDarkMode ? 'rgba(255,255,255,0.05)' : '#ffffff',
      '--page-filter-hover-bg': isDarkMode ? 'rgba(255,255,255,0.08)' : '#f8fafc',
      '--page-table-header-bg': isDarkMode ? colors.surfaceLight : '#f8fafc',
      '--page-table-header-text': isDarkMode ? colors.textSecondary : '#475569',
    }),
    [colors, isDarkMode]
  );
};
