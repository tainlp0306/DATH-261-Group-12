import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, 
  Lock, 
  User, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  GraduationCap, 
  UserCheck 
} from 'lucide-react';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('learner');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('Vui lòng nhập tên đăng nhập, email và mật khẩu.');
      return;
    }
    if (otpRequested && !/^\d{6}$/.test(otp)) {
      setError('Mã OTP phải gồm 6 chữ số.');
      return;
    }

    setError('');
    setLoading(true);

    const result = await register(username, email, password, role, otpRequested ? otp : '');
    setLoading(false);

    if (result.success) {
      if (result.requiresOtp) {
        setOtpRequested(true);
        return;
      }
      if (role === 'instructor') {
        navigate('/instructor/courses/create');
      } else {
        navigate('/my-courses');
      }
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-indigo-50/40">
      <div className="max-w-lg w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 mb-4">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Tạo tài khoản mới
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Khám phá hành trình chinh phục tri thức cùng <strong className="text-indigo-600 font-semibold">LingoSphere</strong>
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Register Form */}
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Bạn tham gia với vai trò gì?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('learner')}
                disabled={otpRequested}
                className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  role === 'learner'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                }`}
              >
                <UserCheck className={`w-6 h-6 ${role === 'learner' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-sm font-bold">Học viên</span>
                <span className="text-[11px] text-slate-500 text-center">Tìm kiếm & tham gia khóa học</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('instructor')}
                disabled={otpRequested}
                className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  role === 'instructor'
                    ? 'border-purple-600 bg-purple-50/70 text-purple-700 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                }`}
              >
                <GraduationCap className={`w-6 h-6 ${role === 'instructor' ? 'text-purple-600' : 'text-slate-400'}`} />
                <span className="text-sm font-bold">Giảng viên</span>
                <span className="text-[11px] text-slate-500 text-center">Tạo & quản lý các khóa học</span>
              </button>
            </div>
          </div>

          {/* Username */}
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
                disabled={otpRequested}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: learner_pro"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Email để xác minh <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                required
                disabled={otpRequested}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@lingosphere.edu.vn"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          {/* Password */}
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
                minLength={8}
                disabled={otpRequested}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
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

          {otpRequested && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Mã OTP 6 chữ số
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-2 text-xs text-slate-500">Mã đã gửi đến {email}. Mã có hiệu lực trong 10 phút.</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{otpRequested ? 'Xác minh & tạo tài khoản' : 'Gửi mã xác minh'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-sm text-slate-500">
            Đã có tài khoản?{' '}
            <Link
              to="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
            >
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
