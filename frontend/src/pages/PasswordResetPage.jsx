import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { authApi } from '../api/authApi';

const PasswordResetPage = () => {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');
  const isConfirming = Boolean(uid && token);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isConfirming && password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }
    setSubmitting(true);
    try {
      if (isConfirming) {
        const result = await authApi.confirmPasswordReset({ uid, token, new_password: password });
        toast.success(result.message);
      } else {
        const result = await authApi.requestPasswordReset(email);
        setSent(true);
        toast.success(result.message);
      }
    } catch (error) {
      const detail = error.response?.data?.new_password?.join(' ') || error.response?.data?.error;
      toast.error(detail || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-9 shadow-sm">
        <div className="w-11 h-11 flex items-center justify-center bg-emerald-50 text-emerald-700 rounded-lg">
          {isConfirming ? <KeyRound className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">
          {isConfirming ? 'Đặt mật khẩu mới' : 'Quên mật khẩu'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isConfirming
            ? 'Tạo mật khẩu mới cho tài khoản của bạn.'
            : sent
              ? 'Nếu email tồn tại, hướng dẫn khôi phục đã được gửi.'
              : 'Nhập email tài khoản để nhận liên kết khôi phục.'}
        </p>
        {!sent || isConfirming ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {!isConfirming ? (
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </label>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Mật khẩu mới
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Xác nhận mật khẩu
                  <input
                    type="password"
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
              {submitting ? 'Đang xử lý...' : isConfirming ? 'Lưu mật khẩu' : 'Gửi liên kết'}
            </button>
          </form>
        ) : null}
        <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700">
          <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
        </Link>
      </div>
    </main>
  );
};

export default PasswordResetPage;