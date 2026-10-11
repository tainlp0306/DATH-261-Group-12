import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookOpen, LogOut, Search, X } from 'lucide-react';
import { courseApi } from '../api/courseApi';

const MyCoursesPage = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let mounted = true;
    courseApi.getMyEnrollments()
      .then((data) => {
        if (mounted) setEnrollments(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => toast.error('Không thể tải danh sách khóa học của bạn.'))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const withdraw = async (enrollment) => {
    if (!window.confirm(`Rời khóa học "${enrollment.course_title}"?`)) return;
    try {
      await courseApi.leaveCourse(enrollment.course);
      setEnrollments((current) => current.filter((item) => item.id !== enrollment.id));
      toast.success('Đã rời khóa học.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể rời khóa học.');
    }
  };

  const filteredEnrollments = enrollments.filter((enrollment) => (
    enrollment.course_title?.toLowerCase().includes(searchTerm.trim().toLowerCase())
  ));

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">Học tập</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Khóa học của tôi</h1>
        </div>
        <Link to="/courses" className="text-sm font-semibold text-emerald-700 hover:underline">Khám phá khóa học</Link>
      </div>
      {!loading && enrollments.length > 0 && (
        <label className="relative block max-w-xl">
          <span className="sr-only">Tìm trong khóa học đã tham gia</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm khóa học đã tham gia..."
            className="w-full border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} aria-label="Xóa nội dung tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-900">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      )}
      {loading ? <p className="py-10 text-sm text-slate-500">Đang tải...</p> : enrollments.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen className="mx-auto h-9 w-9 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800">Bạn chưa tham gia khóa học nào</p>
        </div>
      ) : (
        filteredEnrollments.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Không có khóa học nào khớp với “{searchTerm}”.</p> :
        <ul className="divide-y divide-slate-200">
          {filteredEnrollments.map((enrollment) => (
            <li key={enrollment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-5">
              <div>
                <Link to={`/courses/${enrollment.course}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                  {enrollment.course_title}
                </Link>
                <p className="mt-1 text-xs text-slate-500">Tham gia {new Date(enrollment.enrolled_at).toLocaleDateString('vi-VN')}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link to={`/courses/${enrollment.course}`} className="text-sm font-semibold text-emerald-700">Tiếp tục học</Link>
                <button
                  type="button"
                  onClick={() => withdraw(enrollment)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <LogOut className="h-3.5 w-3.5" /> Rời khóa học
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default MyCoursesPage;