import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from '../redux/store';
import { type RoleId, getFallbackPathForRole, hasRoleAccess } from '../auth/rbac';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: readonly RoleId[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles = [] }) => {
  const { user, roleId } = useSelector((state: RootState) => state.auth);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !hasRoleAccess(roleId, allowedRoles)) {
    const fallbackPath = getFallbackPathForRole(roleId);

    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
