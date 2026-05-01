import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Mail, CircleCheckBig } from "lucide-react";

import AuthLayout from "../../layouts/AuthLayout";
import { auth, sendPasswordResetEmail } from "../../config/firebase";

type ForgotPasswordFormData = {
  email: string;
};

const ForgotPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await sendPasswordResetEmail(auth, data.email.trim());

      setSuccessMessage(
        "Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư của bạn."
      );

      reset();
    } catch {
      setSubmitError(
        "Không thể gửi email lúc này. Vui lòng kiểm tra lại email hoặc thử lại sau."
      );
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthLayout>
      <div className="w-100">
        <div className="text-center mb-4">

          <h1 className="h3 fw-bold text-white mb-2">Quên mật khẩu?</h1>

          <p className="auth-muted mb-0">
            Nhập email đã đăng ký, hệ thống sẽ gửi liên kết đặt lại mật khẩu.
          </p>
        </div>

        {successMessage ? (
          <div className="text-center">
            <div className="alert alert-success py-3 d-flex align-items-start gap-2 text-start">
              <CircleCheckBig size={20} className="mt-1 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>

            <Link to="/login" className="btn btn-info fw-semibold text-dark px-4">
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="form-label auth-muted">
                <Mail size={15} className="me-1" />
                Email
              </label>

              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className={`form-control auth-input ${errors.email ? "is-invalid" : ""}`}
                {...register("email", {
                  required: "Email không được để trống",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Email không hợp lệ",
                  },
                })}
              />

              {errors.email && (
                <div className="invalid-feedback">{errors.email.message}</div>
              )}
            </div>

            {submitError && <div className="alert alert-danger py-2 small">{submitError}</div>}

            <button
              type="submit"
              className="btn btn-info w-100 fw-semibold text-dark py-2 mt-2"
              disabled={loading}
            >
              {loading ? "Đang gửi..." : "Gửi liên kết đặt lại mật khẩu"}
            </button>
          </form>
        )}

        <p className="text-center auth-muted mt-4 mb-0">
          Nhớ mật khẩu rồi?{" "}
          <Link to="/login" className="text-info fw-semibold text-decoration-none">
            Đăng nhập
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
