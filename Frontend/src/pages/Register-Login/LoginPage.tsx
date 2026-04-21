import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link,  useNavigate } from 'react-router-dom';
import { loginRequest } from '../../redux/slice/authSlice';
import { type RootState } from '../../redux/store';

const LS_EMAIL = "remember_email";
const LS_PASSWORD = "remember_password";
const LS_REMEMBER = "remember_me";

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const remember = localStorage.getItem(LS_REMEMBER) === "1";
    if (remember) {
      setRememberMe(true);
      setEmail(localStorage.getItem(LS_EMAIL) || "");
      setPassword(localStorage.getItem(LS_PASSWORD) || "");
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (rememberMe) {
      localStorage.setItem(LS_REMEMBER, "1");
      localStorage.setItem(LS_EMAIL, email);
      localStorage.setItem(LS_PASSWORD, password);
    } else {
      localStorage.removeItem(LS_REMEMBER);
      localStorage.removeItem(LS_EMAIL);
      localStorage.removeItem(LS_PASSWORD);
    }
    dispatch(loginRequest({ email, password }));
    navigate('/setup-org', { replace: true });
  };

  return (
    <div className="auth-shell">
      <div className="auth-card p-4 p-md-5">
        <div className="mb-4 text-center">
          <h1 className="h3 fw-bold text-light mb-2">Chào mừng trở lại</h1>
          <p className="auth-muted mb-0">Đăng nhập để quản lý tổ chức và chuyến đi.</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label auth-muted">Email</label>
            <input
              type="email"
              placeholder="yourname@company.com"
              autoComplete="email"
              required
              className="form-control form-control-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label auth-muted">Mật khẩu</label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập mật khẩu"
              required
              autoComplete="current-password"
              className="form-control form-control-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="btn btn-outline-secondary"
            >
              {showPassword ? 'Ẩn' : 'Hiển thị'}
            </button>
          </div>

          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Lưu tài khoản và mật khẩu
          </label>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-info btn-lg w-100 fw-semibold text-dark mt-2"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="d-flex justify-content-between align-items-center mt-4 small">
          <Link to="/forgot-password" className="auth-muted">Quên mật khẩu?</Link>
          <Link to="/register" className="text-info fw-semibold">Tạo tài khoản</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;