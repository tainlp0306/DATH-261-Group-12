import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { BookOpen, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  const landingPath = (authenticatedUser) => from || (
    authenticatedUser.role === 'learner' ? '/my-courses' :
      authenticatedUser.role === 'admin' ? '/admin' : '/courses'
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!');
      return;
    }

    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      navigate(landingPath(result.user));
    } else {
      setError(result.error);
    }
  };

  const handleGoogleSuccess = async (response) => {
    setError('');
    const result = await loginWithGoogle(response.credential);
    if (result.success) {
      navigate(landingPath(result.user));
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-indigo-50/40">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 mb-4">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Chào mừng trở lại!
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Đăng nhập vào hệ thống học tập trực tuyến <strong className="text-indigo-600 font-semibold">LingoSphere</strong>
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Không thể xác thực với Google. Vui lòng thử lại.')}
              text="signin_with"
              shape="rectangular"
              width="360"
            />
          </div>
        )}

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full"></div>
          <span className="bg-white px-3 text-xs uppercase tracking-wider text-slate-400 font-semibold absolute">
            Hoặc với tài khoản
          </span>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Tên đăng nhập (Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập của bạn"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Đăng nhập</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Redirect to Register */}
        <div className="text-center pt-2">
          <p className="text-sm text-slate-500">
            Chưa có tài khoản?{' '}
            <Link
              to="/register"
              className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
            >
              Đăng ký tài khoản mới
            </Link>
          </p>
          <Link to="/forgot-password" className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Quên mật khẩu?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
