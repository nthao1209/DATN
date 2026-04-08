import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { registerRequest } from '../../redux/slice/authSlice';
import { type RootState } from '../../redux/store';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const { loading, error, statusMessage } = useSelector((state: RootState) => state.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.password.length < 6) {
      setFormError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Mật khẩu nhập lại không khớp.');
      return;
    }

    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, formData.email.trim());
      if (signInMethods.length > 0) {
        setFormError('Email này đã được sử dụng. Vui lòng dùng email khác.');
        return;
      }
    } catch {
      setFormError('Không thể kiểm tra email lúc này. Vui lòng thử lại.');
      return;
    }

    const payload = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
    };

    dispatch(registerRequest(payload));
  };

  if (statusMessage) {
    return (
      <div className="auth-shell">
        <div className="auth-card p-4 p-md-5 text-center">
          <h2 className="h4 fw-bold text-success mb-3">Đăng ký thành công</h2>
          <p className="auth-muted mb-4">{statusMessage}</p>
          <Link to="/login" className="btn btn-outline-info fw-semibold px-4">
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card p-4 p-md-5">
        <div className="mb-4 text-center">
          <h1 className="h3 fw-bold text-light mb-2">Tạo tài khoản mới</h1>
          <p className="auth-muted mb-0">Bắt đầu hệ thống quản lý cho tổ chức của bạn.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label auth-muted">Họ và tên</label>
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
            <label className="form-label auth-muted">Mật khẩu</label>
            <input
              type="password"
              required
              minLength={6}
              className="form-control form-control-lg"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <div className="form-text auth-muted">Tối thiểu 6 ký tự.</div>
          </div>

          <div className="mb-3">
            <label className="form-label auth-muted">Nhập lại mật khẩu</label>
            <input
              type="password"
              required
              minLength={6}
              className="form-control form-control-lg"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>

          {formError && <div className="alert alert-warning py-2 small">{formError}</div>}
          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-info btn-lg w-100 fw-semibold text-dark"
          >
            {loading ? 'Đang xử lý...' : 'Đăng ký'}
          </button>
        </form>

        <p className="mt-4 text-center auth-muted mb-0">
          Đã có tài khoản? <Link to="/login" className="text-info fw-semibold">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;