import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useTheme } from '../../../theme/ThemeContext';

interface TransactionHeaderProps {
  children: React.ReactNode;
}

const TransactionHeader: React.FC<TransactionHeaderProps> = ({ children }) => {
  const { colors, isDarkMode } = useTheme();

  return (
    <div className="d-flex align-items-center justify-content-between mb-4 px-2">
      <div className="d-flex align-items-center gap-3">
        <div
          className="d-flex align-items-center justify-content-center rounded-circle shadow-sm"
          style={{
            width: '42px',
            height: '42px',
            backgroundColor: isDarkMode ? colors.primaryGlow : `${colors.primary}15`,
            border: `1px solid ${colors.primary}33`,
          }}
        >
          <ClipboardCheck size={20} style={{ color: colors.primary }} />
        </div>
        <h1 className="h4 fw-bold m-0" style={{ letterSpacing: '-0.02em', color: colors.textPrimary }}>
          Điểm danh
        </h1>
      </div>

      <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
        {children}
      </div>
    </div>
  );
};

export default TransactionHeader;
