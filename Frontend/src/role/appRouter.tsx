import React from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
} from 'react-router-dom';
import type { RootState } from '../redux/store';
import { ROLE_IDS, getFallbackPathForRole } from '../auth/rbac';
import ProtectedRoute from '../components/ProtectedRoute';
import Layout from '../components/Layout';

const Login = React.lazy(() => import('../pages/Register-Login/LoginPage'));
const Register = React.lazy(() => import('../pages/Register-Login/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('../pages/Register-Login/ForgotPasswordPage'));
const SetupOrg = React.lazy(() => import('../pages/Register-Login/SetupOrgPage'));
const Dashboard = React.lazy(() => import('../pages/admin/DashboardPage'));
const TripPage = React.lazy(() => import('../pages/admin/TripPage'));
const RoundPage = React.lazy(() => import('../pages/admin/RoundPage'));
const BusPage = React.lazy(() => import('../pages/admin/BusPage'));
const PassengerPage = React.lazy(() => import('../pages/admin/PassengerPage'));
const UserManagementPage = React.lazy(() => import('../pages/system-admin/UserManagementPage'));
const RoleManagementPage = React.lazy(() => import('../pages/system-admin/RoleManagementPage'));
const TransactionPage = React.lazy(() => import('../pages/bus-management/TransactionPage'));
const UnlockRequestPage = React.lazy(() => import('../pages/bus-management/UnlockRequestPage'));

const SetupOrgGate: React.FC<{ children: React.ReactNode; roleId?: number }> = ({ children, roleId }) => {
  const hasCompletedSetup = sessionStorage.getItem('bustrack-setup-org-complete') === 'true';

  if (roleId !== ROLE_IDS.SYSTEM_ADMIN && !hasCompletedSetup) {
    return <Navigate to="/setup-org" replace />;
  }

  return <>{children}</>;
};

export const createAppRouter = (
  user: RootState['auth']['user'],
  roleId?: number | null,
  tenants: RootState['auth']['tenants'] = [],
  currentTenant: RootState['auth']['currentTenant'] = null,
) => {
  const needsTenantSelection = Boolean(user && roleId !== ROLE_IDS.SYSTEM_ADMIN && tenants.length > 1 && !currentTenant);

  const publicRoutes = createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </>
  );

  const systemAdminRoutes = createRoutesFromElements(
    <>
      <Route path="/setup-org" element={<Navigate to={getFallbackPathForRole(ROLE_IDS.SYSTEM_ADMIN)} replace />} />

      <Route element={<Layout />}>
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.SYSTEM_ADMIN]}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.SYSTEM_ADMIN]}>
              <RoleManagementPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to={getFallbackPathForRole(ROLE_IDS.SYSTEM_ADMIN)} replace />} />
      <Route path="*" element={<Navigate to={getFallbackPathForRole(ROLE_IDS.SYSTEM_ADMIN)} replace />} />
    </>
  );

  const tenantRoutes = createRoutesFromElements(
    <>
      <Route path="/setup-org" element={<SetupOrg />} />

      <Route element={<SetupOrgGate roleId={roleId ?? undefined}><Layout /></SetupOrgGate>}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.ADMIN]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trips"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.ADMIN]}>
              <TripPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trips/:id/rounds"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.ADMIN]}>
              <RoundPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trips/:id/buses"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.ADMIN]}>
              <BusPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/passengers"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.ADMIN]}>
              <PassengerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.BUS_MANAGEMENT]}>
              <TransactionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/unlock-requests"
          element={
            <ProtectedRoute allowedRoles={[ROLE_IDS.BUS_MANAGEMENT]}>
              <UnlockRequestPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to={needsTenantSelection ? '/setup-org' : getFallbackPathForRole(roleId)} replace />} />
      <Route path="*" element={<Navigate to={needsTenantSelection ? '/setup-org' : getFallbackPathForRole(roleId)} replace />} />
    </>
  );

  if (!user) {
    return createBrowserRouter(publicRoutes);
  }

  if (roleId === ROLE_IDS.SYSTEM_ADMIN) {
    return createBrowserRouter(systemAdminRoutes);
  }

  return createBrowserRouter(tenantRoutes);
};
