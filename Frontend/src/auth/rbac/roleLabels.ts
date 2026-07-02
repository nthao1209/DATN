const ROLE_DISPLAY_LABELS: Record<string, string> = {
  admin: 'Trưởng đoàn',
  busmanagement: 'Trưởng xe',
};

export const getRoleDisplayName = (roleName?: string | null) => {
  if (!roleName) return 'N/A';
  const normalized = roleName.trim().toLowerCase();
  return ROLE_DISPLAY_LABELS[normalized] || roleName;
};
