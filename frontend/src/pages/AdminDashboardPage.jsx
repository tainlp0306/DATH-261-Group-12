import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import { courseApi } from '../api/courseApi';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ShieldCheck,
  Users,
  BookOpen,
  UserCheck,
  GraduationCap,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Settings,
  Activity,
  RefreshCw,
  TrendingUp,
  ClipboardList,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminDashboardPage = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'courses'
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [togglingUserId, setTogglingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [deletingCourseId, setDeletingCourseId] = useState(null);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const data = await adminApi.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      toast.error('Không thể tải thống kê tổng quan.');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUsers = async (role = roleFilter) => {
    try {
      const data = await adminApi.getUsers(role);
      setUsers(data);
    } catch (err) {
      console.error('Failed to load admin users:', err);
      toast.error('Không thể tải danh sách người dùng.');
    }
  };

  const fetchCourses = async () => {
    try {
      const data = await adminApi.getAllCourses();
      setCourses(data);
    } catch (err) {
      console.error('Failed to load admin courses:', err);
      toast.error('Không thể tải danh sách khóa học hệ thống.');
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchUsers(roleFilter), fetchCourses()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleRoleFilterChange = async (newRole) => {
    setRoleFilter(newRole);
    setLoading(true);
    await fetchUsers(newRole);
    setLoading(false);
  };

  const handleToggleUserStatus = async (user) => {
    try {
      setTogglingUserId(user.id);
      const res = await adminApi.toggleUserStatus(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      );
      toast.success(res.message || 'Cập nhật trạng thái người dùng thành công!');
      // Refresh stats after toggle
      fetchStats();
    } catch (err) {
      console.error('Failed to toggle user status:', err);
      toast.error('Không thể thay đổi trạng thái tài khoản.');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleToggleCoursePublish = async (course) => {
    try {
      const updated = await courseApi.updateCourse(course.id, {
        title: course.title,
        description: course.description,
        requirements: course.requirements || '',
        is_published: !course.is_published,
      });
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_published: updated.is_published } : c))
      );
      toast.success(`Khóa học "${course.title}" đã được ${updated.is_published ? 'Xuất bản' : 'Ẩn'}!`);
      fetchStats();
    } catch (err) {
      console.error('Failed to toggle course publish:', err);
      toast.error('Không thể cập nhật trạng thái khóa học.');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Xóa tài khoản "${user.username}"? Khóa học và dữ liệu liên quan có thể bị xóa theo. Thao tác này không thể hoàn tác.`)) return;

    try {
      setDeletingUserId(user.id);
      await adminApi.deleteUser(user.id);
      setUsers((previous) => previous.filter((item) => item.id !== user.id));
      toast.success(`Đã xóa tài khoản "${user.username}".`);
      fetchStats();
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error(err.response?.data?.error || 'Không thể xóa tài khoản.');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteCourse = async (course) => {
    if (!window.confirm(`Xóa khóa học "${course.title}" cùng toàn bộ nội dung và tiến độ?`)) return;

    try {
      setDeletingCourseId(course.id);
      await courseApi.deleteCourse(course.id);
      setCourses((previous) => previous.filter((item) => item.id !== course.id));
      toast.success(`Đã xóa khóa học "${course.title}".`);
      fetchStats();
    } catch (err) {
      console.error('Failed to delete course:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Không thể xóa khóa học.');
    } finally {
      setDeletingCourseId(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
      (c.instructor_username && c.instructor_username.toLowerCase().includes(courseSearch.toLowerCase()))
  );

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
            <ShieldCheck className="w-3 h-3" /> Quản trị viên
          </span>
        );
      case 'instructor':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
            <GraduationCap className="w-3 h-3" /> Giảng viên
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <UserCheck className="w-3 h-3" /> Học viên
          </span>
        );
    }
  };

  // Stats data with API data or local counts as fallback
  const statCards = [
    {
      label: 'Tổng Học viên',
      value: stats?.total_students ?? users.filter((u) => u.role === 'learner').length,
      icon: <Users className="w-6 h-6" />,
      color: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
    },
    {
      label: 'Giảng viên',
      value: stats?.total_instructors ?? users.filter((u) => u.role === 'instructor').length,
      icon: <GraduationCap className="w-6 h-6" />,
      color: 'from-purple-500 to-indigo-600',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
    },
    {
      label: 'Tổng Khóa học',
      value: stats?.total_courses ?? courses.length,
      icon: <BookOpen className="w-6 h-6" />,
      color: 'from-indigo-500 to-blue-600',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
    },
    {
      label: 'Lượt Đăng ký',
      value: stats?.total_enrollments ?? '—',
      icon: <ClipboardList className="w-6 h-6" />,
      color: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> Bảng điều khiển Quản trị viên
          </span>
          <h1 className="text-2xl sm:text-3xl font-black">
            LingoSphere Master Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Kiểm soát người dùng, giám sát khóa học và quản lý phân quyền toàn hệ thống.
          </p>
        </div>

        <button
          onClick={loadAllData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold rounded-xl transition-colors self-start md:self-center cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Làm mới dữ liệu
        </button>
      </div>

      {/* Stats Cards — from GET /admin/dashboard-stats/ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className={`bg-white rounded-2xl border ${card.border} p-5 shadow-xs flex items-center gap-4`}
          >
            <div className={`p-3 rounded-xl ${card.bg} ${card.text} shrink-0`}>
              {card.icon}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{card.label}</p>
              {statsLoading ? (
                <div className="h-6 w-16 bg-slate-200 animate-pulse rounded mt-1" />
              ) : (
                <p className={`text-2xl font-black ${card.text}`}>{card.value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" /> Tổng quan
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" /> Quản lý Người dùng ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Toàn bộ Khóa học ({courses.length})
        </button>
      </div>

      {/* Tab 0: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick snapshot cards */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-indigo-500" />
              Phân bổ Người dùng
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Học viên', count: stats?.total_students ?? users.filter(u => u.role === 'learner').length, color: 'bg-emerald-500', total: users.length || 1 },
                  { label: 'Giảng viên', count: stats?.total_instructors ?? users.filter(u => u.role === 'instructor').length, color: 'bg-purple-500', total: users.length || 1 },
                  { label: 'Quản trị', count: users.filter(u => u.role === 'admin').length, color: 'bg-rose-500', total: users.length || 1 },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{item.label}</span>
                      <span>{item.count} người</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} transition-all duration-700`}
                        style={{ width: item.total > 0 ? `${Math.round((item.count / item.total) * 100)}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
              <BookOpen className="w-5 h-5 text-purple-500" />
              Trạng thái Khóa học
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Đang xuất bản', count: courses.filter(c => c.is_published).length, color: 'bg-emerald-500' },
                  { label: 'Đang ẩn / Nháp', count: courses.filter(c => !c.is_published).length, color: 'bg-amber-400' },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{item.label}</span>
                      <span>{item.count} khóa</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} transition-all duration-700`}
                        style={{ width: courses.length > 0 ? `${Math.round((item.count / courses.length) * 100)}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Tổng lượt đăng ký học:{' '}
                <strong className="text-indigo-600">
                  {statsLoading ? '...' : (stats?.total_enrollments ?? '—')}
                </strong>
              </p>
            </div>
          </div>

          {/* Recent Users quick list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Tài khoản người dùng gần nhất
              </h3>
              <button
                onClick={() => setActiveTab('users')}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Xem tất cả →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {users.slice(0, 6).map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                    {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{u.username}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {getRoleBadge(u.role)}
                      {u.is_active === false && (
                        <span className="text-[10px] text-rose-600 font-bold">Khoá</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Users Management */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter and Search Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { label: 'Tất cả', value: '' },
                { label: 'Học viên', value: 'learner' },
                { label: 'Giảng viên', value: 'instructor' },
                { label: 'Quản trị viên', value: 'admin' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => handleRoleFilterChange(tab.value)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                    roleFilter === tab.value
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Tìm username / email..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="py-20">
              <LoadingSpinner size="large" text="Đang tải danh sách người dùng..." />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Không tìm thấy người dùng</h3>
              <p className="text-xs text-slate-500">Thử thay đổi bộ lọc vai trò hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">ID</th>
                      <th className="px-5 py-3.5">Tên người dùng</th>
                      <th className="px-5 py-3.5">Email</th>
                      <th className="px-5 py-3.5">Vai trò</th>
                      <th className="px-5 py-3.5">Trạng thái</th>
                      <th className="px-5 py-3.5 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredUsers.map((u) => {
                      const isActive = u.is_active !== false;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs text-slate-400">#{u.id}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                                {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <span className="font-bold text-slate-900">{u.username}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-500">{u.email || '—'}</td>
                          <td className="px-5 py-4">{getRoleBadge(u.role)}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" /> Hoạt động
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" /> Đã khoá
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                disabled={togglingUserId === u.id || deletingUserId === u.id}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                  isActive
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                } disabled:opacity-50`}
                              >
                                {togglingUserId === u.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : isActive ? (
                                  <><Lock className="w-3.5 h-3.5" /> Khoá tài khoản</>
                                ) : (
                                  <><Unlock className="w-3.5 h-3.5" /> Mở khoá</>
                                )}
                              </button>
                              {u.id !== currentUser?.id && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={deletingUserId === u.id || togglingUserId === u.id}
                                  title={`Xóa tài khoản ${u.username}`}
                                  aria-label={`Xóa tài khoản ${u.username}`}
                                  className="p-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-50"
                                >
                                  {deletingUserId === u.id ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : <Trash2 className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: All Courses Management */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                placeholder="Tìm khóa học theo tiêu đề hoặc giảng viên..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Không tìm thấy khóa học nào</h3>
              <p className="text-xs text-slate-500">Chưa có khóa học nào hoặc không khớp từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">ID</th>
                      <th className="px-5 py-3.5">Tên khóa học</th>
                      <th className="px-5 py-3.5">Giảng viên</th>
                      <th className="px-5 py-3.5">Chương / Bài</th>
                      <th className="px-5 py-3.5">Trạng thái</th>
                      <th className="px-5 py-3.5 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredCourses.map((c) => {
                      const moduleCount = c.modules?.length || 0;
                      const lessonCount = c.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs text-slate-400">#{c.id}</td>
                          <td className="px-5 py-4 max-w-xs">
                            <span className="font-bold text-slate-900 block truncate">{c.title}</span>
                            <span className="text-[11px] text-slate-400 line-clamp-1">
                              {c.description}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-800">
                            {c.instructor_username || 'Giảng viên'}
                          </td>
                          <td className="px-5 py-4 text-slate-500">
                            {moduleCount} chương ({lessonCount} bài)
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                c.is_published
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {c.is_published ? (
                                <><Eye className="w-3 h-3" /> Đang xuất bản</>
                              ) : (
                                <><EyeOff className="w-3 h-3" /> Đang ẩn</>
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to={`/courses/${c.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" /> Xem
                              </Link>

                              <Link
                                to={`/instructor/courses/${c.id}/manage`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Settings className="w-3.5 h-3.5" /> Quản lý
                              </Link>

                              <button
                                onClick={() => handleToggleCoursePublish(c)}
                                disabled={deletingCourseId === c.id}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  c.is_published
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                                title={c.is_published ? 'Ẩn khóa học' : 'Xuất bản'}
                              >
                                {c.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteCourse(c)}
                                disabled={deletingCourseId === c.id}
                                title={`Xóa khóa học ${c.title}`}
                                aria-label={`Xóa khóa học ${c.title}`}
                                className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                              >
                                {deletingCourseId === c.id ? (
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
