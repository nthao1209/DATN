import React from 'react';
import { Phone, MessageCircle } from 'lucide-react';

interface PassengerActionButtonsProps {
  passenger: {
    name: string;
    phone: string;
  };
  compact?: boolean;
}

const PassengerActionButtons: React.FC<PassengerActionButtonsProps> = ({ passenger, compact = false }) => {
  const phone = passenger.phone?.replace(/\s+/g, '').trim();

  if (!phone) return null;

  return (
    <div className={`passenger-action-buttons d-flex ${compact ? 'gap-1' : 'gap-2'} justify-content-start flex-wrap`}>
      <a
        href={`tel:${phone}`}
        className={`btn ${compact ? 'btn-sm' : ''} btn-success d-inline-flex align-items-center gap-1`}
        title={`Gọi ${passenger.name || 'hành khách'}`}
      >
        <Phone size={compact ? 14 : 16} />
        {!compact && <span>Gọi</span>}
      </a>

      <a
        href={`https://zalo.me/${phone}`}
        target="_blank"
        rel="noreferrer"
        className={`btn ${compact ? 'btn-sm' : ''} btn-outline-primary d-inline-flex align-items-center gap-1`}
        title={`Mở Zalo của ${passenger.name || 'hành khách'}`}
      >
        <MessageCircle size={compact ? 14 : 16} />
        {!compact && <span>Zalo</span>}
      </a>
    </div>
  );
};

export default PassengerActionButtons;