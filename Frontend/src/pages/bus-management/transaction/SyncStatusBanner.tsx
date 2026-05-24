import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useTheme } from '../../../theme/ThemeContext';

interface SyncStatusBannerProps {
  syncBanner: { tone: string; label: string } | null;
}

const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({ syncBanner }) => {
  const { colors } = useTheme();

  if (!syncBanner) return null;

  const getToneColors = () => {
    switch (syncBanner.tone) {
      case 'success': return { bg: `${colors.success}15`, border: `${colors.success}33`, text: colors.success };
      case 'warning': return { bg: `${colors.warning}15`, border: `${colors.warning}33`, text: colors.warning };
      case 'danger': return { bg: `${colors.danger}15`, border: `${colors.danger}33`, text: colors.danger };
      default: return { bg: `${colors.info}15`, border: `${colors.info}33`, text: colors.info };
    }
  };

  const toneColors = getToneColors();

  return (
    <div className="mb-3 px-2">
      <div
        className="d-flex align-items-start gap-2 px-3 py-2 rounded-3"
        style={{
          backgroundColor: toneColors.bg,
          border: `1px solid ${toneColors.border}`,
          color: toneColors.text,
        }}
      >
        <ClipboardCheck size={16} className="mt-1 flex-shrink-0" />
        <div className="small fw-semibold">{syncBanner.label}</div>
      </div>
    </div>
  );
};

export default SyncStatusBanner;