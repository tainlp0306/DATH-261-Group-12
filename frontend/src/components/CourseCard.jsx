import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, User, Layers, ArrowRight, BookmarkCheck } from 'lucide-react';

const CourseCard = ({ course, isEnrolled, onEnroll }) => {
  const [enrolling, setEnrolling] = useState(false);
  const navigate = useNavigate();

  const handleEnrollClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEnrolled) {
      navigate(`/courses/${course.id}`);
      return;
    }

    if (onEnroll) {
      setEnrolling(true);
      await onEnroll(course.id);
      setEnrolling(false);
    }
  };

  const moduleCount = course.modules?.length || 0;
  const totalLessons = course.modules?.reduce((acc, m) => acc + (m.lessons?.length || 0), 0) || 0;

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-200 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      {/* Decorative Header Banner */}
      <div className="h-36 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 p-5 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-purple-400/20 rounded-full blur-lg pointer-events-none" />

        <div className="flex items-center justify-between z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/20">
            <BookOpen className="w-3.5 h-3.5" />
            Khóa học
          </span>

          {isEnrolled && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white shadow-xs">
              <BookmarkCheck className="w-3.5 h-3.5" />
              Đã đăng ký
            </span>
          )}
        </div>

        <div className="z-10">
          <div className="flex items-center gap-2 text-indigo-100 text-xs font-medium">
            <User className="w-3.5 h-3.5" />
            <span>Giảng viên: <strong className="text-white font-semibold">{course.instructor_username || 'Giảng viên LingoSphere'}</strong></span>
          </div>
        </div>
      </div>

      {/* Course Body Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <Link to={`/courses/${course.id}`} className="block group-hover:text-indigo-600 transition-colors">
            <h3 className="text-lg font-bold text-slate-800 line-clamp-1 mb-2">
              {course.title}
            </h3>
          </Link>
          <p className="text-slate-600 text-sm line-clamp-2 mb-4 leading-relaxed">
            {course.description || 'Chưa có mô tả cho khóa học này.'}
          </p>
        </div>

        <div>
          {/* Stats Bar */}
          <div className="flex items-center gap-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>{moduleCount} chương học</span>
            </div>
            {totalLessons > 0 && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-500" />
                <span>{totalLessons} bài học</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-2 pt-2 flex items-center gap-2">
            <Link
              to={`/courses/${course.id}`}
              className="flex-1 text-center px-3.5 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Chi tiết
            </Link>

            <button
              onClick={handleEnrollClick}
              disabled={enrolling}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm ${
                isEnrolled
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              } disabled:opacity-50`}
            >
              {enrolling ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isEnrolled ? (
                <>
                  <span>Vào học</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Đăng ký</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
