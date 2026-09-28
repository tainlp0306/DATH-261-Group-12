import React, { useState, useEffect, useCallback } from 'react';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';
import CourseCard from '../components/CourseCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  Search, 
  BookOpen, 
  Sparkles, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle,
  X,
  Layers
} from 'lucide-react';

const CourseListPage = () => {
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'enrolled'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const { isAuthenticated, user, isInstructor } = useAuth();

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchCoursesAndEnrollments = useCallback(async (searchQuery = '') => {
    try {
      setLoading(true);
      setError('');
      
      const coursesData = await courseApi.getCourses(searchQuery);
      setCourses(coursesData);

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

  useEffect(() => {
    fetchCoursesAndEnrollments();
  }, [fetchCoursesAndEnrollments]);

  // Handle Search submit
  const handleSearch = (e) => {
    e.preventDefault();
    fetchCoursesAndEnrollments(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    fetchCoursesAndEnrollments('');
  };

  // Handle Enroll
  const handleEnroll = async (courseId) => {
    if (!isAuthenticated) {
      showToast('Vui lòng đăng nhập để đăng ký khóa học!', 'error');
      return;
    }

    try {
      await courseApi.enrollCourse(courseId);
      showToast('Đăng ký khóa học thành công! Chúc bạn học tập tốt.', 'success');
      // Refresh enrollments
      const updatedEnrollments = await courseApi.getMyEnrollments();
      setEnrollments(updatedEnrollments);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Đăng ký khóa học thất bại.';
      showToast(msg, 'error');
    }
  };

  const enrolledCourseIds = new Set(enrollments.map((item) => item.course));

  const filteredCourses = courses.filter((c) => {
    if (activeFilter === 'enrolled') {
      return enrolledCourseIds.has(c.id);
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium transition-all transform duration-300 animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-200'
              : 'bg-rose-600 text-white shadow-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-8 sm:p-12 overflow-hidden shadow-xl shadow-indigo-100">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md text-indigo-200 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Nền tảng LingoSphere LMS
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            Nâng tầm tri thức cùng các khóa học chất lượng cao
          </h1>
          <p className="text-indigo-200 text-sm sm:text-base leading-relaxed">
            Khám phá thư viện bài giảng phong phú với video, bài tập và tài liệu tương tác từ các giảng viên hàng đầu.
          </p>
        </div>
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
      </div>

      {/* Error state */}
      {error && (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col items-center text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500" />
          <p className="text-rose-800 font-semibold">{error}</p>
          <button
            onClick={() => fetchCoursesAndEnrollments(searchTerm)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isEnrolled={enrolledCourseIds.has(course.id)}
              onEnroll={handleEnroll}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseListPage;
