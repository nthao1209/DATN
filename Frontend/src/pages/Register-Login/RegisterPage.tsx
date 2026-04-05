import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { registerRequest } from '../../redux/slice/authSlice';
import { type RootState } from '../../redux/store';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const dispatch = useDispatch();
  const { loading, error, statusMessage } = useSelector((state: RootState) => state.auth);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(registerRequest(formData));
  };

  if (statusMessage) {
    return (
      <div className="auth-shell">
        <div className="auth-card p-4 p-md-5 text-center">
          <h2 className="h4 fw-bold text-success mb-3">Dang ky thanh cong</h2>
          <p className="auth-muted mb-4">{statusMessage}</p>
          <Link to="/login" className="btn btn-outline-info fw-semibold px-4">
            Quay lai dang nhap
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card p-4 p-md-5">
        <div className="mb-4 text-center">
          <h1 className="h3 fw-bold text-light mb-2">Tao tai khoan moi</h1>
          <p className="auth-muted mb-0">Bat dau he thong quan ly cho to chuc cua ban.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label auth-muted">Ho va ten</label>
            <input
              type="text"
              required
              className="form-control form-control-lg"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="mb-3">
            <label className="form-label auth-muted">Email</label>
            <input
              type="email"
              required
              className="form-control form-control-lg"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="mb-3">
            <label className="form-label auth-muted">Mat khau</label>
            <input
              type="password"
              required
              className="form-control form-control-lg"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-info btn-lg w-100 fw-semibold text-dark"
          >
            {loading ? 'Dang xu ly...' : 'Dang ky'}
          </button>
        </form>

        <p className="mt-4 text-center auth-muted mb-0">
          Da co tai khoan? <Link to="/login" className="text-info fw-semibold">Dang nhap</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;