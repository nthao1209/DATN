import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color = "bg-secondary" }) => {
  return (
    <div 
      className={`card shadow-sm border-0 ${color} h-100 d-flex align-items-center justify-content-center p-4`}
      style={{ backgroundColor: '#333333', borderColor: '#444444' }}
    >
      <div className="text-center">
        <h5 style={{ color: '#999999', fontStyle: 'italic', marginBottom: '0.5rem' }}>{title}</h5>
        <h3 style={{ fontWeight: 'bold', margin: '0', color: '#22c55e', fontSize: '1.75rem' }}>{value}</h3>
      </div>
    </div>
  );
};

export default StatCard;