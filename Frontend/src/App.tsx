import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { type RootState } from './redux/store';

// Pages
import Login from '../src/pages/Register-Login/LoginPage';
import Register from '../src/pages/Register-Login/RegisterPage';
import SetupOrg from '../src/pages/Register-Login/SetupOrgPage';
import Dashboard from '../src/pages/DashboardPage'; // Ví dụ một trang chính
import Layout from './components/Layout';
import TripPage from './pages/TripPage';
import RoundPage from './pages/RoundPage';
import BusPage from './pages/BusPage';
import PassengerPage from './pages/PassengerPage';

const App: React.FC = () => {
  const { user, hasTenant, loading } = useSelector((state: RootState) => state.auth);

  if (loading && !user) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* NHÓM 1: CHƯA ĐĂNG NHẬP */}
        {!user ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<div>Trang quên mật khẩu</div>} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          /* NHÓM 2: ĐÃ ĐĂNG NHẬP NHƯNG CHƯA CÓ TENANT */
          !hasTenant ? (
            /* Đã đăng nhập nhưng chưa tạo/tham gia tổ chức -> Chuyển tới SetupOrgPage */
            <>
              <Route path="/setup-org" element={<SetupOrg />} />
              <Route path="/setup" element={<Navigate to="/setup-org" replace />} />
              <Route path="*" element={<Navigate to="/setup-org" />} />
            </>
          ) : (
            /* NHÓM 3: ĐÃ CÓ TENANT -> VÀO APP CHÍNH */
            <>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/trips" element={<TripPage />} />
                <Route path="/trips/:id/rounds" element={<RoundPage />} />
                <Route path="/trips/:id/buses" element={<BusPage />} />
                <Route path="/passengers" element={<PassengerPage />} />
              </Route>
              
              {/* Mặc định vào dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </>
          )
        )}
      </Routes>
    </Router>
  );
};

export default App;