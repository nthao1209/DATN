import React from 'react';
import { useTheme } from '../theme/ThemeContext';

interface StatCardProps {
  title: string;
  value: number | string;
  color?: string;
  icon: React.ReactNode;
  trend?: string | React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color = 'var(--bs-primary)', icon, trend }) => {
  const { colors } = useTheme();

  return (
    <div 
      className="card shadow-sm border-0 h-100 d-flex align-items-center justify-content-center p-4"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        boxShadow: `0 0 0 1px ${color}22, 0 12px 30px rgba(0, 0, 0, 0.08)`,
        borderTop: `3px solid ${color}`,
      }}
    >
      <div className="text-center">
        <div className="mb-2" style={{ color }}>{icon}</div>
        <h5 style={{ color: colors.textSecondary, fontStyle: 'italic', marginBottom: '0.5rem' }}>{title}</h5>
        <h3 style={{ fontWeight: 'bold', margin: '0', color, fontSize: '1.75rem' }}>{value}</h3>
        {trend && (
          <p className="text-muted small mt-2">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;