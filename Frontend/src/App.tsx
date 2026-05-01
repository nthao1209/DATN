import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { type RootState } from './redux/store';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as fbAuth } from './config/firebase';
import { api } from './services/api';
import { authSuccess, logout } from './redux/slice/authSlice';
import { ThemeProvider } from './theme/ThemeContext';

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
import ProtectedRoute from './components/ProtectedRoute';
import SyncManager from './components/common/SyncManager';

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { user, hasTenant, loading, roleId } = useSelector((state: RootState) => state.auth);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(fbAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          dispatch(logout());
          return;
        }

        if (!firebaseUser.emailVerified) {
          dispatch(logout());
          return;
        }

        const token = await firebaseUser.getIdToken();
        const response = await api.getMyStatus();
        const status = (response as any)?.data ?? response;

        dispatch(
          authSuccess({
            user: status.user,
            token,
            tenants: status.tenants || [],
            roleId: status.roleId,
          })
        );
      } catch (error) {
        dispatch(logout());
      } finally {
        setIsBootstrapping(false);
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  if (isBootstrapping || (loading && !user)) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <SyncManager />
      <Router>
        <Routes>
          {!user ? (
            <>
              <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          /* NHÓM 2: ĐÃ ĐĂNG NHẬP NHƯNG CHƯA CÓ TENANT */
          (!hasTenant && roleId !== 1) ? (
            /* Đã đăng nhập nhưng chưa tạo/tham gia tổ chức -> Chuyển tới SetupOrgPage */
            <>
              <Route path="/setup-org" element={<SetupOrg />} />
              <Route path="*" element={<Navigate to="/setup-org" />} />

            </>
          ) : (
            /* NHÓM 3: ĐÃ CÓ TENANT -> VÀO APP CHÍNH */
            <>
              <Route path="/setup-org" element={<SetupOrg />} />

              <Route element={<Layout />}>
                {/* Dashboard - tất cả roles đều có thể xem */}
                <Route path="/dashboard" element={<Dashboard />} />

                {/* SuperAdmin Routes - Role 1 */}
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

                {/* Admin Routes - Role 2 */}
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

                {/* BusManager Routes - Role 3 */}
                <Route
                  path="/transactions"
                  element={
                    <ProtectedRoute allowedRoles={[3]}>
                      <TransactionPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
              
              {/* Mặc định vào dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </>
          )
        )}
      </Routes>
    </Router>
    </ThemeProvider>
  );
};

export default App;