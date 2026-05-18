import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { type RootState } from '../redux/store';
import { logout } from '../redux/slice/authSlice';
import { 
  LogOut, Building, Bell,ChevronDown,Moon, Sun, ShieldCheck, LockKeyhole, X, CircleAlert
} from 'lucide-react';
import { useMqttBrokerStatus } from '../hooks/useMqttBrokerStatus';
import { useTheme } from '../theme/ThemeContext';
import { auth, signOut } from '../config/firebase';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import {enqueueSnackbar} from 'notistack';
import { useUnsavedChanges } from './common/UnsavedChangesContext';
import { useNotification } from '../contexts/NotificationContext';


const schema = yup.object({
  currentPassword : yup.string().required("Mật khẩu hiện tại không được để trống"),
  newPassword: yup.string()
    .required("Mật khẩu mới không được để trống")
    .min(6, "Mật khẩu mới phải có ít nhất 6 ký tự"),
  confirmPassword: yup.string()
    .required("Vui lòng xác nhận mật khẩu mới")
    .oneOf([yup.ref('newPassword')], "Mật khẩu xác nhận không khớp")
}).required();


const TopBar: React.FC = () => {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentTenant, user } = useSelector((state: RootState) => state.auth);
  const mqttStatus = useMqttBrokerStatus();
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, refreshNotifications } = useNotification();
  const { state: unsavedChanges, clearUnsavedChanges } = useUnsavedChanges();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors , isValid},
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });


  useEffect(() => {
    if (!isChangePasswordOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsChangePasswordOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChangePasswordOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isNotificationOpen || !user?.id) {
      return;
    }

    void refreshNotifications();
  }, [isNotificationOpen, refreshNotifications, user?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const recentNotifications = useMemo(() => [...notifications].slice(0, 8), [notifications]);

  const shortenMessage = (message: string) => {
    const text = message.trim();
    if (!text) return 'Thông báo mới';
    if (text.length <= 72) return text;
    return `${text.slice(0, 72).trimEnd()}...`;
  };

  const statusMeta = {
    connecting: { label: 'Connecting', color: colors.warning, bg: `${colors.warning}15` },
    connected: { label: 'Connected', color: colors.success, bg: `${colors.success}15` },
    reconnecting: { label: 'Reconnecting', color: colors.info, bg: `${colors.info}15` },
    disconnected: { label: 'Disconnected', color: colors.danger, bg: `${colors.danger}15` },
    error: { label: 'Error', color: colors.warning, bg: `${colors.warning}15` },
  }[mqttStatus] || { label: 'Unknown', color: colors.textSecondary, bg: `${colors.textSecondary}15` };

  const handleLogout = () => {
    if (unsavedChanges.isDirty) {
      enqueueSnackbar(unsavedChanges.message || 'Bạn có thay đổi chưa lưu. Hãy lưu trước khi đăng xuất.', { variant: 'warning' });
      return;
    }

    dispatch(logout());
    clearUnsavedChanges();
    navigate('/login');
  };

  const openChangePasswordModal = () => {
    setPasswordError(null);
    resetPasswordForm();
    setIsChangePasswordOpen(true);
  };

  const closeChangePasswordModal = () => {
    if (isSavingPassword) return;
    setPasswordError(null);
    resetPasswordForm();
    setIsChangePasswordOpen(false);
  };

  const handleChangePassword = handlePasswordSubmit(async (formData) => {

    const currentUser = auth.currentUser;

    if (!currentUser?.email) {
      enqueueSnackbar("Không tìm thấy tài khoản", { variant: "error" });
      return;
    }

    setIsSavingPassword(true);

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        formData.currentPassword
      );

      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, formData.newPassword);

      enqueueSnackbar("Đổi mật khẩu thành công", { variant: "success" });

      await signOut(auth);
      dispatch(logout());
      clearUnsavedChanges();
      resetPasswordForm();
      setIsChangePasswordOpen(false);
      navigate('/login');
    } catch (error: any) {
      if (error?.code === 'auth/wrong-password') {
        enqueueSnackbar('Mật khẩu hiện tại không đúng.', { variant: "error" });
      } else if (error?.code === 'auth/requires-recent-login') {
        enqueueSnackbar('Phiên đăng nhập đã cũ. Vui lòng đăng xuất và đăng nhập lại trước khi đổi mật khẩu.', { variant: "error" });
      } else {
        enqueueSnackbar('Không thể đổi mật khẩu lúc này. Vui lòng thử lại sau.', { variant: "error" });
      }
    } finally {
      setIsSavingPassword(false);
    }
  });

  return (
    <>
      <nav className="navbar navbar-expand px-4 sticky-top transition-all" 
        style={{ 
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: isDarkMode ? 'rgba(2, 6, 23, 0.7)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
          height: '64px',
          zIndex: 999
        }}>
        <div className="d-flex align-items-center justify-content-between w-100">
          
          <div className="d-flex align-items-center gap-3">
            <div className="status-badge-container" 
              style={{ 
                border: `1px solid ${statusMeta.color}44`, 
                background: statusMeta.bg,
                padding: '4px 8px'
              }}>
              <span className={`status-dot ${mqttStatus === 'connected' ? 'pulse' : ''}`} 
                    style={{ backgroundColor: statusMeta.color }}></span>
              <span className="status-label d-none d-md-inline" style={{ color: statusMeta.color }}>
                {statusMeta.label}
              </span>
            </div>

            <div className="tenant-badge" style={{ backgroundColor: colors.surfaceLight, border: `1px solid ${colors.border}` }}>
              <Building size={14} className="text-primary" />
              <span  style={{ color: colors.textPrimary }}>
                {currentTenant?.name || 'Hệ thống'}
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            
            {/* Quick Actions Group */}
            <div className="d-flex align-items-center gap-1 border-end pe-3 me-2" style={{ borderColor: colors.border }}>
              <div className="position-relative" ref={notificationRef}>
                <button
                  type="button"
                  className="btn-icon-topbar position-relative"
                  title="Notifications"
                  onClick={() => setIsNotificationOpen((prev) => !prev)}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </button>

                {isNotificationOpen && (
                  <div
                    className="notification-dropdown shadow-lg"
                    style={{
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      color: colors.textPrimary,
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom" style={{ borderColor: colors.border }}>
                      <div>
                        <div className="fw-bold">Thông báo</div>
                        <div className="small" style={{ color: colors.textMuted }}>
                          {unreadCount} thông báo hiện có
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-decoration-none p-0"
                          style={{ color: colors.primary }}
                          onClick={() => markAllNotificationsAsRead()}
                        >
                          Đánh dấu tất cả đã đọc
                        </button>
                      )}
                    </div>

                    <div className="notification-dropdown-list">
                      {recentNotifications.length === 0 ? (
                        <div className="px-3 py-4 text-center small" style={{ color: colors.textMuted }}>
                          Chưa có thông báo mới
                        </div>
                      ) : (
                        recentNotifications.map((item) => (
                          <div
                            key={item.id}
                            className="notification-dropdown-item"
                            style={{ borderBottom: `1px solid ${colors.border}`, opacity: item.isRead ? 0.6 : 1 }}
                          >
                            <div 
                              className="d-flex align-items-start gap-2 flex-grow-1 cursor-pointer"
                              onClick={() => markNotificationAsRead(item.id)}
                              style={{ paddingRight: '8px' }}
                            >
                              <span className={`notification-dot notification-${item.type}`} />
                              <div className="flex-grow-1 text-start">
                                <div className="small fw-bold notification-preview">
                                  {item.title}
                                </div>
                                <div className="small notification-preview">
                                  {shortenMessage(item.content)}
                                </div>
                                <div className="tiny text-uppercase" style={{ color: colors.textMuted }}>
                                  {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Theme Toggle Button */}
              <button 
                className="btn-icon-topbar theme-toggle-btn" 
                onClick={toggleTheme} 
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#6366f1" />}
              </button>
            </div>

            <div className="dropdown">
              <div 
                className="d-flex align-items-center gap-2 cursor-pointer p-1 pe-2 rounded-pill border hover-bg-custom"
                style={{ borderColor: colors.border }}
                data-bs-toggle="dropdown"
              >
                <div className="profile-avatar">
                  {user?.name.charAt(0).toUpperCase()}
                </div>
                <div className="d-none d-md-block">
                    <p className="m-0 small fw-bold leading-none" style={{ color: colors.textPrimary, fontSize: '13px' }}>
                        {currentTenant?.role?.name}
                    </p>
                </div>
                <ChevronDown size={16} style={{ color: colors.textSecondary }} />
              </div>

              <ul className="dropdown-menu dropdown-menu-end shadow-lg animate-slide-up" 
                  style={{ 
                    backgroundColor: colors.surface, 
                    border: `1px solid ${colors.border}`,
                    minWidth: '240px', 
                    borderRadius: '16px', 
                    marginTop: '12px' 
                  }}>
                <li>
                  <button className="dropdown-item d-flex align-items-center gap-3 py-2" onClick={openChangePasswordModal}>
                    <ShieldCheck size={16} /> <span>Đổi mật khẩu</span>
                  </button>
                </li>
                
                <li className="my-2 border-top" style={{ borderColor: colors.border }}></li>
                
                <li className="mb-2">
                  <button className="dropdown-item d-flex align-items-center gap-3 py-2 text-danger" onClick={handleLogout}>
                    <LogOut size={16} /> <span className="fw-bold">Đăng xuất</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      {isChangePasswordOpen && (
        <div className="password-modal-overlay" onClick={closeChangePasswordModal}>
          <div className="password-modal shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="d-flex align-items-start justify-content-between gap-3 p-4 border-bottom" style={{ borderColor: colors.border }}>
              <div>
                <div className="d-flex align-items-center gap-2 mb-2" style={{ color: colors.primary }}>
                  <LockKeyhole size={18} />
                  <span className="fw-semibold small text-uppercase">Thông tin cá nhân</span>
                </div>
                <h5 className="m-0 fw-bold" style={{ color: colors.textPrimary }}>Đổi mật khẩu</h5>
                <p className="mb-0 small" style={{ color: colors.textMuted }}>
                  Cập nhật mật khẩu cho tài khoản đang đăng nhập.
                </p>
              </div>
              <button className="btn-close-password" onClick={closeChangePasswordModal} type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-4">
              <div className="mb-3">
                <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                  Email
                </label>
                <input
                  type="email"
                  className="form-control password-input"
                  value={user?.email || auth.currentUser?.email || ''}
                  disabled
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="form-control password-input"
                  {...registerPassword('currentPassword')}
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                />
                {passwordErrors.currentPassword && (
                  <div className="text-danger small mt-1">{passwordErrors.currentPassword.message}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="form-control password-input"
                  {...registerPassword('newPassword')}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                />
                {passwordErrors.newPassword && (
                  <div className="text-danger small mt-1">{passwordErrors.newPassword.message}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold" style={{ color: colors.textSecondary }}>
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="form-control password-input"
                  {...registerPassword('confirmPassword')}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                />
                {passwordErrors.confirmPassword && (
                  <div className="text-danger small mt-1">{passwordErrors.confirmPassword.message}</div>
                )}
              </div>

              {passwordError && (
                <div className="alert alert-danger d-flex align-items-start gap-2 small mb-3 py-2">
                  <CircleAlert size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-4"
                  onClick={closeChangePasswordModal}
                  disabled={isSavingPassword}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary px-4" disabled={!isValid || isSavingPassword}>
                  {isSavingPassword ? 'Đang lưu...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .status-badge-container {
            display: flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 20px; transition: all 0.3s;
        }
        .status-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05rem; }
        
        .tenant-badge {
            display: flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
        }

        .btn-icon-topbar {
          background: transparent; border: none; color: ${colors.textSecondary};
          padding: 8px; border-radius: 10px; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .btn-icon-topbar:hover {
          background: ${colors.surfaceLight}; color: ${colors.primary}; transform: translateY(-1px);
        }

        .notification-badge {
          position: absolute;
          top: 1px;
          right: 1px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: ${colors.danger};
          color: white;
          font-size: 10px;
          font-weight: 700;
          line-height: 18px;
          text-align: center;
          border: 2px solid ${isDarkMode ? colors.surface : '#fff'};
        }

        .notification-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 360px;
          max-width: calc(100vw - 24px);
          border-radius: 16px;
          overflow: hidden;
          z-index: 2000;
        }

        .notification-dropdown-list {
          max-height: 360px;
          overflow: auto;
        }

        .notification-dropdown-item {
          width: 100%;
          display: flex;
          align-items: flex-start;
          padding: 12px 16px;
          background: transparent;
          color: inherit;
          transition: background 0.15s ease;
          gap: 8px;
        }

        .notification-dropdown-item:hover {
          background: ${colors.surfaceLight};
        }

        .notification-preview {
          line-height: 1.35;
        }

        .notification-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
        }

        .notification-success { background: #22c55e; }
        .notification-error { background: #ef4444; }
        .notification-info { background: ${colors.primary}; }
        .notification-warning { background: #f59e0b; }

        .theme-toggle-btn:hover { background: ${isDarkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(99, 102, 241, 0.1)'} !important; }

        .profile-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.info} 100%);
          color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px;
        }

        .hover-bg-custom:hover { background: ${colors.surfaceLight}; transition: 0.2s; }

        .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .pulse { animation: pulse-animation 2s infinite; }
        @keyframes pulse-animation {
          0% { box-shadow: 0 0 0 0px ${statusMeta.color}77; }
          70% { box-shadow: 0 0 0 6px ${statusMeta.color}00; }
          100% { box-shadow: 0 0 0 0px ${statusMeta.color}00; }
        }

        .dropdown-item {
          color: ${colors.textSecondary}; transition: 0.2s; margin: 0 8px; width: calc(100% - 16px); border-radius: 8px; font-size: 14px;
        }
        .dropdown-item:hover { background-color: ${colors.surfaceLight}; color: ${colors.textPrimary}; transform: translateX(4px); }
        .dropdown-item svg { color: ${colors.textMuted}; transition: 0.2s; }
        .dropdown-item:hover svg { color: ${colors.primary}; }

        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        .password-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 3000;
          background: rgba(2, 6, 23, 0.82);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .password-modal {
          width: 100%;
          max-width: 520px;
          border-radius: 20px;
          overflow: hidden;
          background: ${colors.surface};
          border: 1px solid ${colors.border};
        }

        .btn-close-password {
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 50%;
          background: ${colors.surfaceLight};
          color: ${colors.textSecondary};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: 0.2s;
          flex-shrink: 0;
        }

        .btn-close-password:hover {
          background: ${colors.borderLight};
          color: ${colors.textPrimary};
        }

        .password-input {
          background: ${isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#fff'};
          border: 1px solid ${colors.border};
          color: ${colors.textPrimary};
          border-radius: 12px;
          padding: 0.75rem 0.875rem;
        }

        .password-input:focus {
          background: ${isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#fff'};
          color: ${colors.textPrimary};
          border-color: ${colors.primary};
          box-shadow: 0 0 0 0.2rem ${colors.primaryGlow};
        }

        .password-input:disabled {
          opacity: 0.75;
          background: ${colors.surfaceLight};
        }

        .text-danger {
          color: ${colors.danger} !important;
        }
      `}</style>
    </>
  );
};

export default TopBar;