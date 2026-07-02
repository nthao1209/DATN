import React from 'react';
import './StatCard.css';

interface StatCardProps {
  title: string;
  value: number | string;
  color?: string;
  icon: React.ReactNode;
  trend?: string | React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color = 'var(--bs-primary)', icon, trend }) => {
  return (
    <div 
      className="stat-card card shadow-sm border-0 h-100 d-flex align-items-center justify-content-center p-4"
      style={{ '--stat-card-accent': color } as React.CSSProperties}
    >
      <div className="text-center">
        <div className="stat-card-icon mb-2">{icon}</div>
        <h5 className="stat-card-title">{title}</h5>
        <h3 className="stat-card-value">{value}</h3>
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
