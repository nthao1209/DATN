import React, { useEffect, useMemo, useState } from 'react';
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

// Pages
import Login from '../src/pages/Register-Login/LoginPage';
import Register from '../src/pages/Register-Login/RegisterPage';
import ForgotPasswordPage from '../src/pages/Register-Login/ForgotPasswordPage';
import SetupOrg from '../src/pages/Register-Login/SetupOrgPage';
import Dashboard from '../src/pages/DashboardPage';
import Layout from './components/Layout';
import TripPage from './pages/TripPage';
import RoundPage from './pages/RoundPage';
import BusPage from './pages/BusPage';
import PassengerPage from './pages/PassengerPage';
import UserManagementPage from './pages/UserManagementPage';
import RoleManagementPage from './pages/RoleManagementPage';
import TransactionPage from './pages/TransactionPage';
import UnlockRequestPage from './pages/UnlockRequestPage';
import ProtectedRoute from './components/ProtectedRoute';
import SyncManager from './components/common/SyncManager';
import { UnsavedChangesProvider } from './components/common/UnsavedChangesContext';

const SETUP_ORG_COMPLETE_KEY = 'bustrack-setup-org-complete';

const SetupOrgGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { roleId } = useSelector((state: RootState) => state.auth);

  if (roleId !== 1 && sessionStorage.getItem(SETUP_ORG_COMPLETE_KEY) !== 'true') {
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

        const token = await firebaseUser.getIdToken();
        if (lastSyncedUserIdRef.current === firebaseUser.uid) {
          setIsBootstrapping(false);
          return;
        }

        const response = await api.getMyStatus(token);
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
        <Route path="/setup-org" element={<Navigate to="/users" replace />} />

        <Route element={<Layout />}>
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={[1]}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <ProtectedRoute allowedRoles={[1]}>
                <RoleManagementPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/users" replace />} />
        <Route path="*" element={<Navigate to="/users" replace />} />
      </>
    );

    const tenantRoutes = createRoutesFromElements(
      <>
        <Route path="/setup-org" element={<SetupOrg />} />

        <Route element={<SetupOrgGate><Layout /></SetupOrgGate>}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={[2]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips"
            element={
              <ProtectedRoute allowedRoles={[2]}>
                <TripPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:id/rounds"
            element={
              <ProtectedRoute allowedRoles={[2]}>
                <RoundPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:id/buses"
            element={
              <ProtectedRoute allowedRoles={[2]}>
                <BusPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passengers"
            element={
              <ProtectedRoute allowedRoles={[2]}>
                <PassengerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute allowedRoles={[3]}>
                <TransactionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/unlock-requests"
            element={
              <ProtectedRoute allowedRoles={[3]}>
                <UnlockRequestPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/setup-org" replace />} />
        <Route path="*" element={<Navigate to="/setup-org" replace />} />
      </>
    );

    if (!user) {
      return createBrowserRouter(publicRoutes);
    }

    if (roleId === 1) {
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
          <RouterProvider router={router} />
        </UnsavedChangesProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default App;