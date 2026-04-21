import React, { useState } from 'react';
import { MailCheck, RefreshCcw, LogOut } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth as fbAuth } from '../../config/firebase';
import { api } from '../../services/api';
import { authSuccess, emailVerificationRequired, logout } from '../../redux/slice/authSlice';
import { type RootState } from '../../redux/store';

const VerifyEmailPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { statusMessage } = useSelector((state: RootState) => state.auth);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentEmail = fbAuth.currentUser?.email || '';

  const handleResend = async () => {
    if (!fbAuth.currentUser) {
      setMessage('Không tìm thấy phiên đăng nhập để gửi lại email. Vui lòng đăng nhập lại.');
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await sendEmailVerification(fbAuth.currentUser);
      setMessage('Đã gửi lại email xác thực. Kiểm tra hộp thư và thư rác.');
      dispatch(emailVerificationRequired('Email chưa được xác thực. Vui lòng kiểm tra hộp thư.'));
    } catch (error: any) {
      setMessage(error?.message || 'Không thể gửi lại email xác thực.');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckNow = async () => {
    if (!fbAuth.currentUser) {
      setMessage('Không tìm thấy phiên đăng nhập.');
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await fbAuth.currentUser.reload();
      const token = await fbAuth.currentUser.getIdToken(true);
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
    } catch (error: any) {
      const errorMessage = error?.message || 'Tài khoản vẫn chưa được xác thực.';
      setMessage(errorMessage);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut(fbAuth);
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <div className="auth-shell">
      <div className="auth-card p-4 p-md-5 text-center">
        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-info bg-opacity-10 text-info mb-3" style={{ width: 64, height: 64 }}>
          <MailCheck size={32} />
        </div>
        <h1 className="h3 fw-bold text-light mb-2">Xác thực tài khoản</h1>
        <p className="auth-muted mb-3">
          {statusMessage || 'Chúng tôi đã gửi email xác thực. Hãy mở hộp thư để kích hoạt tài khoản trước khi đăng nhập.'}
        </p>
        {currentEmail && <p className="small text-secondary mb-4">Email: {currentEmail}</p>}

        {message && <div className="alert alert-info py-2 small text-start">{message}</div>}

        <div className="d-grid gap-2">
          <button className="btn btn-info fw-semibold text-dark" onClick={handleCheckNow} disabled={busy}>
            {busy ? 'Đang kiểm tra...' : 'Tôi đã xác thực'}
          </button>
          <button className="btn btn-outline-light fw-semibold" onClick={handleResend} disabled={busy}>
            <RefreshCcw size={16} className="me-2" /> Gửi lại email xác thực
          </button>
          <button className="btn btn-link text-secondary fw-semibold text-decoration-none" onClick={handleLogout} disabled={busy}>
            <LogOut size={16} className="me-2" /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;