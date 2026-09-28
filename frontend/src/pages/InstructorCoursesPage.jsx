import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  PlusCircle,
  BookOpen,
  Layers,
  Users,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Settings,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  GraduationCap
} from 'lucide-react';

const InstructorCoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [deletingCourseId, setDeletingCourseId] = useState(null);

  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchInstructorCourses = async () => {
    try {
      setLoading(true);
      // Fetch all courses (search backend)
      const data = await courseApi.getCourses('');
      // Filter for this instructor's courses unless user is admin
      const filtered = isAdmin
        ? data
        : data.filter((c) => c.instructor === user?.id || c.instructor_username === user?.username);
      setCourses(filtered.length > 0 ? filtered : data);
    } catch (err) {
      console.error('Failed to load courses:', err);
      showToast('Không thể tải danh sách khóa học.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructorCourses();
  }, []);

  const handleTogglePublish = async (course) => {
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
      showToast(
        `Khóa học "${course.title}" đã được ${updated.is_published ? 'Xuất bản' : 'Ẩn'} thành công!`,
        'success'
      );
    } catch (err) {
      console.error('Failed to toggle publish:', err);
      showToast('Không thể thay đổi trạng thái xuất bản.', 'error');
    }
  };

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa khóa học "${courseTitle}"? Thao tác này không thể hoàn tác!`)) {
      return;
    }

    try {
      setDeletingCourseId(courseId);
      await courseApi.deleteCourse(courseId);
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      showToast(`Đã xóa khóa học "${courseTitle}" thành công.`, 'success');
    } catch (err) {
      console.error('Failed to delete course:', err);
      showToast('Xóa khóa học thất bại. Vui lòng thử lại!', 'error');
    } finally {
      setDeletingCourseId(null);
    }
  };

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium transition-all transform animate-bounce ${
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 mb-2">
            <GraduationCap className="w-3.5 h-3.5" /> Quản lý Giảng dạy
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Khóa học của tôi
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Quản lý nội dung, xuất bản/ẩn khóa học và theo dõi tiến độ của học viên.
          </p>
        </div>

        <Link
          to="/instructor/courses/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 transition-all hover:shadow-lg self-start sm:self-auto"
        >
          <PlusCircle className="w-5 h-5" />
          Tạo khóa học mới
        </Link>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm khóa học theo tiêu đề..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm transition-all"
          />
        </div>

        <div className="text-xs font-semibold text-slate-500 flex items-center gap-2 px-2">
          <span>Tổng số: <strong className="text-slate-800">{filteredCourses.length}</strong> khóa học</span>
        </div>
      </div>

      {/* Courses List Grid */}
      {loading ? (
        <div className="py-20">
          <LoadingSpinner size="large" text="Đang tải danh sách khóa học của bạn..." />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Chưa có khóa học nào</h3>
          <p className="text-sm text-slate-500">
            {searchTerm ? `Không tìm thấy khóa học khớp với "${searchTerm}".` : 'Bạn chưa tạo khóa học nào. Hãy bắt đầu xây dựng giáo trình đầu tiên!'}
          </p>
          <Link
            to="/instructor/courses/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> Tạo khóa học ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((c) => {
            const moduleCount = c.modules?.length || 0;
            const totalLessons = c.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0;

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        c.is_published
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {c.is_published ? (
                        <>
                          <Eye className="w-3 h-3" /> Đang xuất bản
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" /> Đang ẩn
                        </>
                      )}
                    </span>

                    <span className="text-[11px] text-slate-400 font-medium">
                      ID: #{c.id}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {c.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {c.description || 'Chưa có mô tả.'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      {moduleCount} chương
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                      {totalLessons} bài học
                    </span>
                  </div>
                </div>

                {/* Card Actions Bottom */}
                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    to={`/instructor/courses/${c.id}/manage`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                  >
                    <Settings className="w-3.5 h-3.5" /> Quản lý đề cương
                  </Link>

                  <button
                    onClick={() => handleTogglePublish(c)}
                    title={c.is_published ? 'Ẩn khóa học' : 'Xuất bản khóa học'}
                    className={`p-2 rounded-xl text-xs font-semibold border transition-colors ${
                      c.is_published
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {c.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => handleDeleteCourse(c.id, c.title)}
                    disabled={deletingCourseId === c.id}
                    title="Xóa khóa học"
                    className="p-2 rounded-xl text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors disabled:opacity-50"
                  >
                    {deletingCourseId === c.id ? (
                      <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InstructorCoursesPage;
