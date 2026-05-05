import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: number[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles = [] }) => {
  const { user, roleId } = useSelector((state: RootState) => state.auth);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(roleId || 0)) {
    const fallbackPath = roleId === 1
      ? '/users'
      : roleId === 3
        ? '/transactions'
        : '/dashboard';

    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
