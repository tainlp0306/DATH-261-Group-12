import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, BookOpen, Check, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { user, isAuthenticated, isLearner, isInstructor } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    let active = true;
    authApi.getNotifications()
      .then((items) => {
        if (active) setNotifications(Array.isArray(items) ? items : items.results || []);
      })
      .catch(() => {
        if (active) toast.error('Không thể tải kênh thông báo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isAuthenticated]);

  const confirmRead = async (notification) => {
    try {
      setConfirmingId(notification.id);
      const updated = await authApi.confirmNotification(notification.id);
      setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success('Đã xác nhận thông báo.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể xác nhận thông báo.');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden border-y border-emerald-900/10 bg-[#e8f2ed] px-6 py-10 sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">LingoSphere · Nền tảng học tập</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
            {isAuthenticated ? `Chào ${user?.first_name || user?.username || 'bạn'}, sẵn sàng học tiếp?` : 'Học tập có định hướng, tiến bộ từng ngày.'}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700">
            Theo dõi bài học, trao đổi cùng giảng viên và tiếp tục đúng nơi bạn đã dừng lại.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {isLearner ? (
              <Link to="/my-courses" className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 motion-reduce:transform-none">
                Khóa học của tôi <ArrowRight className="h-4 w-4" />
              </Link>
            ) : isInstructor ? (
              <Link to="/instructor/courses" className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 motion-reduce:transform-none">
                Quản lý khóa học <ArrowRight className="h-4 w-4" />
              </Link>
            ) : isAuthenticated ? (
              <Link to="/admin" className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white">
                Bảng điều khiển Admin <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/courses" className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white">
                  Khám phá khóa học <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/login" className="inline-flex items-center gap-2 border border-emerald-900/30 px-4 py-2.5 text-sm font-semibold text-emerald-950">
                  Đăng nhập
                </Link>
              </>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 hidden h-full w-[32%] items-end justify-center border-l border-emerald-900/10 text-emerald-900/10 md:flex">
          <BookOpen className="mb-8 h-40 w-40" strokeWidth={0.7} />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="announcement-heading">
        <div className="flex items-end justify-between gap-4 border-b border-slate-300 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Cập nhật</p>
            <h2 id="announcement-heading" className="mt-1 text-xl font-semibold text-slate-950">Kênh thông báo</h2>
          </div>
          {notifications.some((item) => !item.is_read) && (
            <span className="text-xs font-medium text-slate-500">
              {notifications.filter((item) => !item.is_read).length} cần xác nhận
            </span>
          )}
        </div>

        {!isAuthenticated ? (
          <div className="flex items-center gap-3 border-b border-slate-200 py-6 text-sm text-slate-600">
            <Bell className="h-5 w-5 shrink-0 text-emerald-800" /> Đăng nhập để xem thông báo từ giảng viên và quản trị viên.
          </div>
        ) : loading ? (
          <p className="border-b border-slate-200 py-6 text-sm text-slate-500">Đang tải thông báo...</p>
        ) : notifications.length === 0 ? (
          <p className="border-b border-slate-200 py-6 text-sm text-slate-500">Chưa có thông báo mới.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {notifications.map((notification) => (
              <li key={notification.id} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <Link to={notification.target_url || (notification.course ? `/courses/${notification.course}` : '/')} onClick={() => { if (!notification.is_read) void confirmRead(notification); }} className="block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{notification.title || 'Thông báo'}</h3>
                      {!notification.is_read && <span className="h-2 w-2 rounded-full bg-amber-600" aria-label="Chưa xác nhận" />}
                      {notification.course_title && <span className="text-xs text-emerald-800">Khóa học: {notification.course_title}</span>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{notification.message}</p>
                    <time className="mt-2 block text-xs text-slate-500">{new Date(notification.created_at).toLocaleString('vi-VN')}</time>
                    <span className="mt-2 inline-block text-xs font-semibold text-emerald-800">Mở nội dung thông báo →</span>
                  </Link>
                </div>
                {notification.is_read ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><Check className="h-4 w-4" /> Đã xác nhận</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirmRead(notification)}
                    disabled={confirmingId === notification.id}
                    className="inline-flex min-h-10 items-center justify-center gap-2 border border-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> {confirmingId === notification.id ? 'Đang lưu...' : 'Xác nhận đọc'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 grid gap-6 border-y border-slate-200 py-7 sm:grid-cols-2">
        <Link to="/courses" className="group flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-emerald-800" />
          <span><strong className="block text-sm text-slate-900">Tất cả khóa học</strong><span className="mt-1 block text-sm text-slate-600">Tìm nội dung phù hợp với mục tiêu học tập.</span></span>
        </Link>
        <div className="flex items-start gap-3">
          <GraduationCap className="mt-0.5 h-5 w-5 text-emerald-800" />
          <span><strong className="block text-sm text-slate-900">Học theo nhịp của bạn</strong><span className="mt-1 block text-sm text-slate-600">Tiến độ được lưu theo từng bài học.</span></span>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
