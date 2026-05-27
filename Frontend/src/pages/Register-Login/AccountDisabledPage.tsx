import React from 'react';
import AuthLayout from '../../layouts/AuthLayout';

const AccountDisabledPage: React.FC = () => {
  return (
    <AuthLayout>
      <div className="text-center w-100">
        <h2 className="fw-bold text-danger mb-3">Tài khoản đã bị vô hiệu hóa</h2>
        <p className="auth-muted mb-4">Tài khoản của bạn đã bị vô hiệu hóa bởi quản trị hệ thống. Vui lòng liên hệ system admin để được hỗ trợ.</p>
      </div>
    </AuthLayout>
  );
};

export default AccountDisabledPage;
