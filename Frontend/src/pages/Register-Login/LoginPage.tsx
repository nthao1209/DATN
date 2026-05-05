import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { loginRequest } from "../../redux/slice/authSlice";
import {type RootState } from "../../redux/store";
import AuthLayout from '../../layouts/AuthLayout';
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";


const schema = yup.object({
  email: yup.string()
    .required("Email không được để trống")
    .email("Email không hợp lệ"),
  password: yup.string()
    .required("Mật khẩu không được để trống")
    .min(6, "Mật khẩu tối thiểu 6 ký tự")
}).required();

const Login: React.FC = () => {
  const dispatch = useDispatch();

  const { loading, error } = useSelector(
    (state: RootState) => state.auth
  );

  const [showPassword, setShowPassword] =
    useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = handleSubmit((data) => {
    dispatch(
      loginRequest({
        email: data.email,
        password: data.password
      })
    );
  });

  return (
    <AuthLayout>
          <div className="mb-4 text-center">
            <h1 className="h3 fw-bold text-light mb-2">
              Chào mừng trở lại
            </h1>
        </div>

        <form onSubmit={onSubmit}>
          {/* Email */}
          <div className="mb-3">
            <label className="form-label auth-muted">
              Email
            </label>

            <input
              type="email"
              placeholder="yourname@company.com"
              autoComplete="email"
              className={`form-control form-control-lg ${
                errors.email
                  ? "is-invalid"
                  : ""
              }`}
              {...register("email")}
            />

            {errors.email && (
              <div className="invalid-feedback">
                {errors.email.message}
              </div>
            )}
          </div>

          {/* Password */}
          <div className="mb-3">
            <label className="form-label auth-muted">
              Mật khẩu
            </label>

            <div className="input-group">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                className={`form-control form-control-lg ${
                  errors.password
                    ? "is-invalid"
                    : ""
                }`}
                {...register("password")} 
              />

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setShowPassword(
                    (v) => !v
                  )
                }
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {errors.password && (
              <div className="text-danger small mt-1">
                {
                  errors.password
                    .message
                }
              </div>
            )}
          </div>

          {/* Redux error */}
          {error && (
            <div className="alert alert-danger py-2 small">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={ !isValid || loading}
            className="btn btn-info btn-lg w-100 fw-semibold text-dark mt-2"
          >
            {loading
              ? "Đang đăng nhập..."
              : "Đăng nhập"}
          </button>
        </form>

        {/* Footer */}
        <div className="d-flex justify-content-between align-items-center mt-4 small">
          <Link
            to="/forgot-password"
            className="auth-muted"
          >
            Quên mật khẩu?
          </Link>

          <Link
            to="/register"
            className="text-info fw-semibold"
          >
            Tạo tài khoản
          </Link>
        </div>
  </AuthLayout>
  );
};

export default Login;