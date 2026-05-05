export const commonColors = {
  primary: '#2563eb',
  primaryGlow: 'rgba(37, 99, 235, 0.3)',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

export const darkColors = {
  ...commonColors,
  background: '#020617',     
  surface: '#0f172a',        
  surfaceLight: '#1e293b',   
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#1e293b',
  borderLight: '#334155',
};

export const lightColors = {
  ...commonColors,
  background: '#f8fafc',    // Trắng xám nhạt
  surface: '#ffffff',       // Trắng tinh cho Card
  surfaceLight: '#f1f5f9',  // Xám nhạt cho hover
  textPrimary: '#0f172a',   // Chữ đen đậm
  textSecondary: '#475569', // Chữ xám
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};
