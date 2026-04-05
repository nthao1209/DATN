import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import TenantSelector from '../components/TenantSelector';

const SelectTenantPage: React.FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [isOpen] = useState(true); // Modal luôn mở

  if (!token) return null;

  return (
    <TenantSelector
      isOpen={isOpen}
      onClose={() => {}} // Không cho close ở đây
    />
  );
};

export default SelectTenantPage;
