import React, { useState, useEffect, useCallback, useEffectEvent } from 'react';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { Link } from 'react-router-dom';
import { Search, BookOpen, AlertCircle, X } from 'lucide-react';

const CourseListPage = () => {
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ordering, setOrdering] = useState('-created_at');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCourses, setTotalCourses] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'enrolled'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuth();

  const fetchCoursesAndEnrollments = useCallback(async (searchQuery = '', page = 1, order = '-created_at') => {
    try {
      const coursesData = await courseApi.getCourses(searchQuery, page, order);
      setCourses(Array.isArray(coursesData) ? coursesData : coursesData.results || []);
      setTotalCourses(coursesData.count ?? coursesData.length ?? 0);

      if (isAuthenticated) {
        try {
          const enrollmentsData = await courseApi.getMyEnrollments();
          setEnrollments(enrollmentsData);
        } catch (err) {
          console.warn('Could not load enrollments:', err);
        }
      }
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      setError('Không thể tải danh sách khóa học. Vui lòng kiểm tra lại kết nối Backend!');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchInitialCourses = useEffectEvent(() => fetchCoursesAndEnrollments());

  useEffect(() => {
    fetchInitialCourses();
  }, [fetchCoursesAndEnrollments]);

  // Handle Search submit
  const handleSearch = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setCurrentPage(1);
    fetchCoursesAndEnrollments(searchTerm, 1, ordering);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setError('');
    setLoading(true);
    setCurrentPage(1);
    fetchCoursesAndEnrollments('', 1, ordering);
  };

  const enrolledCourseIds = new Set(enrollments.map((item) => item.course));

  const filteredCourses = courses.filter((c) => {
    if (activeFilter === 'enrolled') {
      return enrolledCourseIds.has(c.id);
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(totalCourses / 12));

  const handlePageChange = (page) => {
    setError('');
    setLoading(true);
    setCurrentPage(page);
    fetchCoursesAndEnrollments(searchTerm, page, ordering);
  };

  const handleOrderingChange = (event) => {
    const nextOrdering = event.target.value;
    setError('');
    setLoading(true);
    setOrdering(nextOrdering);
    setCurrentPage(1);
    fetchCoursesAndEnrollments(searchTerm, 1, nextOrdering);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col justify-between gap-5 border-y border-emerald-900/15 bg-[#e8f2ed] px-5 py-6 sm:flex-row sm:items-end sm:px-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Thư viện học tập</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-slate-950">Tất cả khóa học</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Tìm kiếm và tiếp tục các chương trình học do giảng viên LingoSphere biên soạn.</p>
        </div>
        <p className="shrink-0 text-sm font-medium tabular-nums text-emerald-950">{totalCourses} khóa học</p>
      </div>

      {/* Controls & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search Input */}
        <form onSubmit={handleSearch} className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm khóa học theo tên hoặc nội dung..."
            className="w-full pl-10 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm transition-all"
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-1">
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Tìm
            </button>
          </div>
        </form>

        {/* Tab Filters */}
        {isAuthenticated && (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({courses.length})
            </button>
            <button
              onClick={() => setActiveFilter('enrolled')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'enrolled'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã đăng ký ({enrollments.length})
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="shrink-0">Sắp xếp</span>
          <select
            value={ordering}
            onChange={handleOrderingChange}
            className="min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="-created_at">Mới nhất</option>
            <option value="created_at">Cũ nhất</option>
            <option value="title">Tên A-Z</option>
            <option value="-title">Tên Z-A</option>
          </select>
        </label>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col items-center text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500" />
          <p className="text-rose-800 font-semibold">{error}</p>
          <button
            onClick={() => {
              setError('');
              setLoading(true);
              fetchCoursesAndEnrollments(searchTerm, currentPage, ordering);
            }}
            className="px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Course List Content */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="large" text="Đang tải danh sách khóa học..." />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Không tìm thấy khóa học nào</h3>
          <p className="text-sm text-slate-500">
            {searchTerm
              ? `Không có kết quả nào phù hợp với từ khóa "${searchTerm}". Hãy thử từ khóa khác!`
              : activeFilter === 'enrolled'
              ? 'Bạn chưa đăng ký khóa học nào. Hãy khám phá và đăng ký ngay!'
              : 'Hiện tại chưa có khóa học nào được xuất bản.'}
          </p>
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
            >
              Xóa tìm kiếm
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden border-y border-slate-300 bg-white">
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_8rem] gap-4 bg-slate-100 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 md:grid">
              <span>Khóa học</span><span>Giảng viên</span><span className="text-right">Truy cập</span>
            </div>
            <ul className="divide-y divide-slate-200">
              {filteredCourses.map((course) => (
                <li key={course.id} className="grid gap-3 px-4 py-4 transition-colors hover:bg-emerald-50/40 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_8rem] md:items-center md:gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-slate-950">{course.title}</h2>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-600">{course.description || 'Chưa có mô tả.'}</p>
                    {enrolledCourseIds.has(course.id) && <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Đã đăng ký</span>}
                  </div>
                  <span className="text-xs text-slate-600">{course.instructor_username || 'Giảng viên LingoSphere'}</span>
                  <Link to={`/courses/${course.id}`} className="inline-flex min-h-10 items-center justify-center border border-emerald-800 px-3 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
                    Xem chi tiết
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row">
            <p className="text-xs text-slate-500">
              Trang {currentPage} / {totalPages} · {totalCourses} khóa học
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-40"
              >
                Tiếp
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CourseListPage;
