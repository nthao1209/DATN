import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { loginRequest } from '../../redux/slice/authSlice';
import { type RootState } from '../../redux/store';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(loginRequest({ email, password }));
  };

  return (
    <div className="auth-shell">
      <div className="auth-card p-4 p-md-5">
        <div className="mb-4 text-center">
          <h1 className="h3 fw-bold text-light mb-2">Chao mung tro lai</h1>
          <p className="auth-muted mb-0">Dang nhap de quan ly to chuc va chuyen di.</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label auth-muted">Email</label>
            <input
              type="email"
              placeholder="yourname@company.com"
              required
              className="form-control form-control-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label auth-muted">Mat khau</label>
            <input
              type="password"
              placeholder="Nhap mat khau"
              required
              className="form-control form-control-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-info btn-lg w-100 fw-semibold text-dark mt-2"
          >
            {loading ? 'Dang dang nhap...' : 'Dang nhap'}
          </button>
        </form>

        <div className="d-flex justify-content-between align-items-center mt-4 small">
          <Link to="/forgot-password" className="auth-muted">Quen mat khau?</Link>
          <Link to="/register" className="text-info fw-semibold">Tao tai khoan</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;