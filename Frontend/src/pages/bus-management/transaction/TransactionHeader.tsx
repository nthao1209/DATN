import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import './TransactionHeader.css';

interface TransactionHeaderProps {
  children: React.ReactNode;
}

const TransactionHeader: React.FC<TransactionHeaderProps> = ({ children }) => {
  return (
    <div className="d-flex align-items-center justify-content-between mb-4 px-2">
      <div className="d-flex align-items-center gap-3">
        <div className="transaction-header-icon d-flex align-items-center justify-content-center rounded-circle shadow-sm">
          <ClipboardCheck size={20} />
        </div>
        <h1 className="transaction-header-title h4 fw-bold m-0">
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
