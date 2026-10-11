import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, normalizeRole } from '../context/AuthContext';
import { 
  BookOpen, 
  LogOut, 
  User as UserIcon, 
  PlusCircle, 
  ShieldCheck,
  GraduationCap,
  Bell,
  Check,
} from 'lucide-react';
import { authApi } from '../api/authApi';

const Navbar = () => {
  const { user, role, isAuthenticated, isInstructor, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentRole = normalizeRole(role ?? user?.role);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const currentY = window.scrollY;
        setHeaderVisible(currentY < 80 || currentY < lastScrollY.current);
        lastScrollY.current = currentY;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    authApi.getNotifications()
      .then((items) => setNotifications(Array.isArray(items) ? items : items.results || []))
      .catch(() => {});
  }, [isAuthenticated]);

  const markRead = async (notification) => {
    if (notification.is_read) return;
    try {
      const updated = await authApi.confirmNotification(notification.id);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? updated : item
      )));
    } catch {
      // Keep the notification unread so the user can retry.
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadge = (userRole) => {
    switch (normalizeRole(userRole)) {
      case 'instructor':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
            <GraduationCap className="w-3 h-3" />
            Giảng viên
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
            <ShieldCheck className="w-3 h-3" />
            Quản trị viên
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <UserIcon className="w-3 h-3" />
            Học viên
          </span>
        );
    }
  };

  const isActive = (path) => path === '/'
    ? location.pathname === '/'
    : location.pathname === path || location.pathname.startsWith(`${path}/`);

  const mobileLinkClass = (path) => `shrink-0 border-b-2 px-3 py-2 text-xs font-semibold ${
    isActive(path) ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-slate-600'
  }`;

  return (
    <header className={`sticky top-0 z-50 border-b border-slate-200 bg-white transition-transform duration-200 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="flex h-10 w-10 items-center justify-center bg-emerald-800 text-white transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transform-none">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-display text-xl font-semibold text-slate-950">
                  LingoSphere
                </span>
                <span className="ml-1.5 hidden border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600 sm:inline-block">
                  LMS
                </span>
              </div>
            </Link>

            {/* Main Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={`px-3.5 py-2 text-sm font-medium transition-colors ${isActive('/') ? 'border-b-2 border-emerald-800 text-emerald-900' : 'text-slate-600 hover:text-slate-950'}`}
              >
                Trang chủ
              </Link>
              <Link
                to="/courses"
                className={`px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive('/courses')
                    ? 'border-b-2 border-emerald-800 text-emerald-900'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Tất cả khóa học
              </Link>

              {isInstructor && (
                <Link
                  to="/instructor/courses"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/instructor/courses')
                      ? 'border-b-2 border-emerald-800 text-emerald-900'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  Quản lý khóa học
                </Link>
              )}

              {currentRole === 'learner' && (
                <Link
                  to="/my-courses"
                  className={`px-3.5 py-2 text-sm font-medium transition-colors ${isActive('/my-courses') ? 'border-b-2 border-emerald-800 text-emerald-900' : 'text-slate-600 hover:text-slate-950'}`}
                >
                  Khóa học của tôi
                </Link>
              )}

              {isInstructor && (
                <Link
                  to="/instructor/courses/create"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/instructor/courses/create')
                      ? 'border-b-2 border-emerald-800 text-emerald-900'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 text-purple-600" />
                  Tạo khóa học mới
                </Link>
              )}

              {isAdmin && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/admin')
                      ? 'border-b-2 border-emerald-800 text-emerald-900'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  Admin Dashboard
                </Link>
              )}

              {isAuthenticated && (
                <Link
                  to="/profile"
                  className={`px-3.5 py-2 text-sm font-medium transition-colors ${isActive('/profile') ? 'border-b-2 border-emerald-800 text-emerald-900' : 'text-slate-600 hover:text-slate-950'}`}
                >
                  Hồ sơ
                </Link>
              )}
            </nav>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNotifications((current) => !current)}
                    aria-label="Thông báo"
                    aria-expanded={showNotifications}
                    className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                  >
                    <Bell className="h-5 w-5" />
                    {notifications.some((item) => !item.is_read) && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-600" />
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] border border-slate-200 bg-white shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <h2 className="text-sm font-bold text-slate-900">Thông báo</h2>
                      </div>
                      <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <li className="px-4 py-6 text-center text-sm text-slate-500">Chưa có thông báo.</li>
                        ) : notifications.slice(0, 10).map((item) => (
                          <li key={item.id} className={`px-4 py-3 text-sm ${item.is_read ? 'text-slate-600' : 'bg-emerald-50/60 font-medium text-slate-900'}`}>
                            <p className="font-semibold">{item.title || 'Thông báo'}</p>
                            <p className="mt-1">{item.message}</p>
                            <span className="mt-1 block text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString('vi-VN')}</span>
                            {!item.is_read && (
                              <button type="button" onClick={() => markRead(item)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline">
                                <Check className="h-3.5 w-3.5" /> Xác nhận đọc
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {/* User Info */}
                <div className="hidden sm:flex flex-col items-end text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      {user?.username}
                    </span>
                    {getRoleBadge(currentRole)}
                  </div>
                  {user?.email && (
                    <span className="text-xs text-slate-400 font-normal">
                      {user.email}
                    </span>
                  )}
                </div>

                {/* Avatar Initials */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-indigo-100">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-all hover:shadow-md"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-200 py-2 md:hidden" aria-label="Điều hướng chính">
          <Link to="/" className={mobileLinkClass('/')}>Trang chủ</Link>
          <Link to="/courses" className={mobileLinkClass('/courses')}>Tất cả khóa học</Link>
          {currentRole === 'learner' && <Link to="/my-courses" className={mobileLinkClass('/my-courses')}>Khóa học của tôi</Link>}
          {isAuthenticated && <Link to="/profile" className={mobileLinkClass('/profile')}>Hồ sơ</Link>}
          {isInstructor && <Link to="/instructor/courses" className={mobileLinkClass('/instructor/courses')}>Quản lý khóa học</Link>}
          {isAdmin && <Link to="/admin" className={mobileLinkClass('/admin')}>Admin</Link>}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
