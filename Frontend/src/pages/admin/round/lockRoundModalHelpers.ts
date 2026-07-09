import type React from 'react';

export const getBusName = (buses: any[], busId: number) => {
  const busInfo = buses.find((bus) => Number(bus.id) === Number(busId));
  return busInfo?.busCode || busInfo?.registrationNumber || `Xe ${busId}`;
};

export const getFilteredLocks = ({
  lockStatuses,
  roundId,
  lockType,
}: {
  lockStatuses: any[];
  roundId: number;
  lockType: 'check_in' | 'check_out';
}) => {
  return lockStatuses.filter((status) => {
    if (Number(status.roundId) !== Number(roundId)) return false;
    return lockType === 'check_in'
      ? status.checkInLocked === true
      : status.checkOutLocked === true;
  });
};

export const getCompletedBuses = (lockStatuses: any[], roundId: number) => {
  return lockStatuses.filter(
    (status) => Number(status.roundId) === Number(roundId) && Boolean(status.driverConfirmedBy)
  );
};

export const getPendingUnlockRequests = ({
  unlockRequests,
  roundId,
  lockType,
}: {
  unlockRequests: any[];
  roundId: number;
  lockType: 'check_in' | 'check_out';
}) => {
  return unlockRequests.filter((request) => {
    return (
      Number(request.roundId) === Number(roundId) &&
      request.type === lockType &&
      request.status === 'PENDING'
    );
  });
};

export const getLockModalVars = ({
  colors,
  isDarkMode,
}: {
  colors: any;
  isDarkMode: boolean;
}) => ({
  '--lock-modal-overlay-bg': isDarkMode ? 'rgba(8, 13, 28, 0.8)' : 'rgba(15, 23, 42, 0.6)',
  '--lock-modal-surface': colors.surface,
  '--lock-modal-background': isDarkMode ? colors.background : '#fff',
  '--lock-modal-border': colors.border,
  '--lock-modal-header-bg': isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc',
  '--lock-modal-text-primary': colors.textPrimary,
  '--lock-modal-text-secondary': colors.textSecondary,
  '--lock-modal-close-bg': isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
  '--lock-modal-warning-card-bg': isDarkMode ? 'rgba(245, 158, 11, 0.04)' : '#fffbeb',
  '--lock-modal-warning-card-border': isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
  '--lock-modal-warning-reason-bg': isDarkMode ? 'rgba(245, 158, 11, 0.14)' : '#fff7ed',
  '--lock-modal-warning-reason-border': isDarkMode ? 'rgba(251, 191, 36, 0.42)' : '#fed7aa',
  '--lock-modal-warning-reason-color': isDarkMode ? '#fde68a' : '#7c2d12',
  '--lock-modal-warning-divider': isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fcd34d',
  '--lock-modal-empty-bg': isDarkMode ? 'rgba(255,255,255,0.01)' : '#f8fafc',
  '--lock-modal-locked-bg': isDarkMode ? 'rgba(239, 68, 68, 0.02)' : '#fef2f2',
  '--lock-modal-locked-border': isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
  '--lock-modal-completed-bg': isDarkMode ? 'rgba(16, 185, 129, 0.02)' : '#f0fdf4',
  '--lock-modal-completed-border': isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
}) as React.CSSProperties;
