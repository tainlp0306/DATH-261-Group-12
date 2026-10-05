import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { authApi } from '../api/authApi';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (!codeSent) {
        const response = await authApi.requestOtp(email.trim());
        setCodeSent(true);
        toast.success(response.message || 'Nếu email tồn tại, mã xác minh đã được gửi.');
      } else {
        if (!/^\d{6}$/.test(otp)) {
          toast.error('Mã OTP phải gồm 6 chữ số.');
          return;
        }
        if (password !== confirmPassword) {
          toast.error('Mật khẩu xác nhận không khớp.');
          return;
        }
        const response = await authApi.confirmOtp({
          email: email.trim(),
          otp,
          new_password: password,
        });
        setCompleted(true);
        toast.success(response.message || 'Đổi mật khẩu thành công.');
      }
    } catch (error) {
      const detail = error.response?.data?.new_password?.join(' ')
        || error.response?.data?.email?.[0]
        || error.response?.data?.error;
      toast.error(detail || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <section className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          {codeSent ? <KeyRound className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">{codeSent ? 'Đặt mật khẩu mới' : 'Quên mật khẩu'}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {completed
            ? 'Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.'
            : codeSent
              ? `Nhập mã OTP vừa gửi đến ${email}. Mã có hiệu lực trong 10 phút.`
              : 'Nhập email tài khoản để nhận mã xác minh.'}
        </p>

        {completed ? (
          <Link to="/login" className="mt-6 inline-flex w-full justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
            Đến trang đăng nhập
          </Link>
        ) : <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              disabled={codeSent}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100"
            />
          </label>

          {codeSent && (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Mã OTP
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Mật khẩu mới
                <input
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Xác nhận mật khẩu mới
                <input
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {submitting ? 'Đang xử lý...' : codeSent ? 'Xác minh & đổi mật khẩu' : 'Gửi mã OTP'}
          </button>
        </form>}

        <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700">
          <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
        </Link>
      </section>
    </main>
  );
};

export default ForgotPassword;
