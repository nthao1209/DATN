import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { type RootState } from '../../redux/store';
import TenantSelector from '../../components/TenantSelector';

const SelectTenantPage: React.FC = () => {
  const { user, loading } = useSelector((state: RootState) => state.auth);
  const [isOpen] = useState(true); 

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <TenantSelector
      isOpen={isOpen}
      onClose={() => {}} 
      showCreateJoin={false}
    />
  );
};

export default SelectTenantPage;
