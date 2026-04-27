import React from 'react';
import { useTheme } from '../theme/ThemeContext';

interface StatCardProps {
  title: string;
  value: number | string;
  color?: string;
  icon: React.ReactNode;
  trend?: string | React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color = "bg-secondary", icon, trend }) => {
  const { colors } = useTheme();

  return (
    <div 
      className={`card shadow-sm border-0 ${color} h-100 d-flex align-items-center justify-content-center p-4`}
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
    >
      <div className="text-center">
        <div className="mb-2">{icon}</div>
        <h5 style={{ color: colors.textSecondary, fontStyle: 'italic', marginBottom: '0.5rem' }}>{title}</h5>
        <h3 style={{ fontWeight: 'bold', margin: '0', color: colors.success, fontSize: '1.75rem' }}>{value}</h3>
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