import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { fetchSignInMethodsForEmail } from "firebase/auth";

import { registerRequest } from "../../redux/slice/authSlice";
import { type RootState } from "../../redux/store";
import { auth } from "../../config/firebase";
import AuthLayout from "../../layouts/AuthLayout";

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const Register: React.FC = () => {
  const dispatch = useDispatch();

  const { loading, error, statusMessage } = useSelector(
    (state: RootState) => state.auth
  );

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword
  ] = useState(false);

  const [formError, setFormError] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegisterFormData>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  const passwordValue = watch("password");

  const onSubmit = handleSubmit(
    async (data) => {
      setFormError(null);

      try {
        const methods =
          await fetchSignInMethodsForEmail(
            auth,
            data.email.trim()
          );

        if (methods.length > 0) {
          setFormError(
            "Email này đã được sử dụng"
          );
          return;
        }

        dispatch(
          registerRequest({
            name: data.name,
            email: data.email,
            password: data.password
          })
        );
      } catch {
        setFormError(
          "Không thể kiểm tra email lúc này"
        );
      }
    }
  );

  if (statusMessage) {
    return (
      <AuthLayout>
        <div className="w-100 text-center">
          <h2 className="fw-bold text-success mb-3">
            Đăng ký thành công
          </h2>

          <p className="auth-muted mb-4">
            {statusMessage}
          </p>

          <Link
            to="/login"
            className="btn btn-info px-4 fw-semibold text-dark"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-100">
        <div className="mb-4 text-center">
          <h1 className="h3 fw-bold text-light mb-2">
            Tạo tài khoản mới
          </h1>
          
        </div>

        <form onSubmit={onSubmit}>
          <div className="mb-3">
            <label className="form-label auth-muted">Họ và tên</label>

            <input
              type="text"
              placeholder="Nguyen Van A"
              autoComplete="name"
              className={`form-control form-control-lg ${
                errors.name ? "is-invalid" : ""
              }`}
              {...register("name", {
                required:
                  "Họ tên không được để trống"
              })}
            />

            {errors.name && (
              <div className="invalid-feedback">
                {errors.name.message}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label auth-muted">Email</label>

            <input
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              className={`form-control form-control-lg ${
                errors.email ? "is-invalid" : ""
              }`}
              {...register("email", {
                required:
                  "Email không được để trống",
                pattern: {
                  value:
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message:
                    "Email không hợp lệ"
                }
              })}
            />

            {errors.email && (
              <div className="invalid-feedback">
                {errors.email.message}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label auth-muted">Mật khẩu</label>

            <div className="input-group">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Tối thiểu 8 ký tự"
                autoComplete="new-password"
                className={`form-control form-control-lg ${
                  errors.password
                    ? "is-invalid"
                    : ""
                }`}
                {...register("password", {
                  required:
                    "Mật khẩu không được để trống",
                  minLength: {
                    value: 8,
                    message: "Tối thiểu 8 ký tự"
                  }
                })}
              />

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setShowPassword((v) => !v)
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>

            {errors.password && (
              <div className="text-danger small mt-1">
                {errors.password.message}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label auth-muted">Nhập lại mật khẩu</label>

            <div className="input-group">
              <input
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
                className={`form-control form-control-lg ${
                  errors.confirmPassword
                    ? "is-invalid"
                    : ""
                }`}
                {...register(
                  "confirmPassword",
                  {
                    required:
                      "Vui lòng nhập lại mật khẩu",
                    validate: (value) =>
                      value ===
                        passwordValue ||
                      "Mật khẩu không khớp"
                  }
                )}
              />

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setShowConfirmPassword(
                    (v) => !v
                  )
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>

            {errors.confirmPassword && (
              <div className="text-danger small mt-1">
                {
                  errors.confirmPassword
                    .message
                }
              </div>
            )}
          </div>

          {formError && (
            <div className="alert alert-warning py-2 small">
              {formError}
            </div>
          )}

          {error && (
            <div className="alert alert-danger py-2 small">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-info btn-lg w-100 fw-semibold text-dark mt-2"
          >
            {loading
              ? "Đang xử lý..."
              : "Đăng ký"}
          </button>
        </form>

        <div className="d-flex justify-content-between align-items-center mt-4 small">
          <Link to="/forgot-password" className="auth-muted text-decoration-none">
            Quên mật khẩu?
          </Link>

          <Link
            to="/login"
            className="text-info fw-semibold"
          >
            Đã có tài khoản? Đăng nhập
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Register;