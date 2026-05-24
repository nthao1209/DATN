import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { type RootState } from './redux/store';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as fbAuth } from './config/firebase';
import { api } from './services/api';
import { authSuccess, logout } from './redux/slice/authSlice';
import { ThemeProvider } from './theme/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AttendanceMismatchListener } from './components/AttendanceMismatchListener';
import { ROLE_IDS, getFallbackPathForRole } from './auth/rbac';

// Pages
import Login from '../src/pages/Register-Login/LoginPage';
import Register from '../src/pages/Register-Login/RegisterPage';
import ForgotPasswordPage from '../src/pages/Register-Login/ForgotPasswordPage';
import SetupOrg from '../src/pages/Register-Login/SetupOrgPage';
const Dashboard = React.lazy(() => import('./pages/admin/DashboardPage'));
import Layout from './components/Layout';
const TripPage = React.lazy(() => import('./pages/admin/TripPage'));
const RoundPage = React.lazy(() => import('./pages/admin/RoundPage'));
const BusPage = React.lazy(() => import('./pages/admin/BusPage'));
const PassengerPage = React.lazy(() => import('./pages/admin/PassengerPage'));
const UserManagementPage = React.lazy(() => import('./pages/system-admin/UserManagementPage'));
const RoleManagementPage = React.lazy(() => import('./pages/system-admin/RoleManagementPage'));
const TransactionPage = React.lazy(() => import('./pages/bus-management/TransactionPage'));
const UnlockRequestPage = React.lazy(() => import('./pages/bus-management/UnlockRequestPage'));
import ProtectedRoute from './components/ProtectedRoute';
import SyncManager from './components/common/SyncManager';
import { UnsavedChangesProvider } from './components/common/UnsavedChangesContext';

const SETUP_ORG_COMPLETE_KEY = 'bustrack-setup-org-complete';

const SetupOrgGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { roleId } = useSelector((state: RootState) => state.auth);

  if (roleId !== ROLE_IDS.SYSTEM_ADMIN && sessionStorage.getItem(SETUP_ORG_COMPLETE_KEY) !== 'true') {
    return <Navigate to="/setup-org" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { user, loading, roleId } = useSelector((state: RootState) => state.auth);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const lastSyncedUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(fbAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
          dispatch(logout());
          return;
        }

        if (!firebaseUser.emailVerified) {
          sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
          dispatch(logout());
          return;
        }

        const token = await firebaseUser.getIdToken(true);
        if (lastSyncedUserIdRef.current === firebaseUser.uid) {
          setIsBootstrapping(false);
          return;
        }

        const response = await api.getMyStatus(token, { silentOn401: true });
        if (!response) {
          sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
          lastSyncedUserIdRef.current = null;
          dispatch(logout());
          return;
        }

        const status = (response as any)?.data ?? response;
        lastSyncedUserIdRef.current = firebaseUser.uid;

        dispatch(
          authSuccess({
            user: status.user,
            token,
            tenants: status.tenants || [],
            roleId: status.roleId,
          })
        );
      } catch (error) {
        sessionStorage.removeItem(SETUP_ORG_COMPLETE_KEY);
        lastSyncedUserIdRef.current = null;
        dispatch(logout());
      } finally {
        setIsBootstrapping(false);
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  const router = useMemo(() => {
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

        <Route element={<SetupOrgGate><Layout /></SetupOrgGate>}>
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

        <Route path="/" element={<Navigate to={getFallbackPathForRole(roleId)} replace />} />
        <Route path="*" element={<Navigate to={getFallbackPathForRole(roleId)} replace />} />
      </>
    );

    if (!user) {
      return createBrowserRouter(publicRoutes);
    }

    if (roleId === ROLE_IDS.SYSTEM_ADMIN) {
      return createBrowserRouter(systemAdminRoutes);
    }

    return createBrowserRouter(tenantRoutes);
  }, [roleId, user]);

  if (isBootstrapping || (loading && !user)) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <NotificationProvider>
        <UnsavedChangesProvider>
          <AttendanceMismatchListener />
          <SyncManager />
          <Suspense
            fallback={
              <div className="d-flex align-items-center justify-content-center vh-100">
                <div className="spinner-border text-primary" role="status" />
              </div>
            }
          >
            <RouterProvider router={router} />
          </Suspense>
        </UnsavedChangesProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;