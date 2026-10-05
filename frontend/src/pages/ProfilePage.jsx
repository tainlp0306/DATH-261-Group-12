import React, { useEffect, useState } from 'react';
import { Award, BookOpen, CalendarDays, Clock3, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';

const weekPreview = [
  { day: 'T2', height: '28%' },
  { day: 'T3', height: '56%' },
  { day: 'T4', height: '38%' },
  { day: 'T5', height: '76%' },
  { day: 'T6', height: '48%' },
  { day: 'T7', height: '64%' },
  { day: 'CN', height: '34%' },
];

const ProfilePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('completed');
  const [completedCourses, setCompletedCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    if (user?.role !== 'learner') return;
    let active = true;
    courseApi.getMyEnrollments()
      .then(async (enrollments) => {
        const list = Array.isArray(enrollments) ? enrollments : enrollments.results || [];
        const completed = await Promise.all(list.map(async (enrollment) => {
          const [course, progress] = await Promise.all([
            courseApi.getCourseDetail(enrollment.course),
            courseApi.getMyProgress(enrollment.course),
          ]);
          const lessonCount = (course.modules || []).reduce((total, module) => total + (module.lessons?.length || 0), 0);
          const completedCount = (Array.isArray(progress) ? progress : []).filter((item) => item.is_completed).length;
          return lessonCount > 0 && completedCount >= lessonCount ? course : null;
        }));
        if (active) setCompletedCourses(completed.filter(Boolean));
      })
      .catch(() => toast.error('Không thể tải khóa học đã hoàn thành.'))
      .finally(() => {
        if (active) setLoadingCourses(false);
      });
    return () => { active = false; };
  }, [user?.role]);

  const joinedDate = user?.date_joined
    ? new Date(user.date_joined).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Chưa có dữ liệu';
  const lastLogin = user?.last_login
    ? new Date(user.last_login).toLocaleString('vi-VN')
    : 'Chưa có dữ liệu';

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-slate-300 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Tài khoản</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Hồ sơ người dùng</h1>
      </header>

      <section className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.8fr)]">
        <div>
          <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-emerald-100 text-emerald-900">
              <UserRound className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold text-slate-950">{[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username}</h2>
              <p className="mt-1 break-all text-sm text-slate-600">{user?.email || 'Chưa cập nhật email'}</p>
              <p className="mt-2 text-xs font-medium capitalize text-emerald-800">{user?.role || 'learner'}</p>
            </div>
          </div>
          <dl className="grid gap-4 py-5 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 text-slate-500" />
              <div><dt className="text-xs text-slate-500">Ngày gia nhập</dt><dd className="mt-1 text-sm font-medium text-slate-900">{joinedDate}</dd></div>
            </div>
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-4 w-4 text-slate-500" />
              <div><dt className="text-xs text-slate-500">Lần đăng nhập gần nhất</dt><dd className="mt-1 text-sm font-medium text-slate-900">{lastLogin}</dd></div>
            </div>
          </dl>

          <section className="border-y border-slate-200 py-5" aria-labelledby="weekly-activity-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 id="weekly-activity-title" className="text-sm font-semibold text-slate-900">Tần suất truy cập theo tuần</h2>
                <p className="mt-1 text-xs text-slate-500">Bản xem trước · dữ liệu hoạt động chưa được kết nối</p>
              </div>
              <span className="text-xs text-slate-500">7 ngày</span>
            </div>
            <div className="mt-5 grid h-28 grid-cols-7 items-end gap-2 border-b border-slate-300 pb-2" aria-hidden="true">
              {weekPreview.map((item) => (
                <div key={item.day} className="flex h-full flex-col items-center justify-end gap-2">
                  <div className="w-full max-w-8 bg-emerald-700/70 motion-safe:transition-transform motion-safe:hover:-translate-y-1" style={{ height: item.height }} />
                  <span className="text-[10px] text-slate-500">{item.day}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="border-l-0 border-slate-200 lg:border-l lg:pl-7">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-800" />
            <h2 className="text-sm font-semibold text-slate-900">Tổng quan học tập</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Các khóa học đã hoàn tất và kết quả đánh giá được tổng hợp tại đây.</p>
          <div className="mt-5 grid grid-cols-2 border-y border-slate-200 py-4">
            <div><p className="text-xs text-slate-500">Đã hoàn thành</p><p className="mt-1 text-2xl font-semibold text-slate-950">{loadingCourses ? '—' : completedCourses.length}</p></div>
            <div><p className="text-xs text-slate-500">Kết quả</p><p className="mt-1 text-sm font-medium text-slate-700">Đang kết nối</p></div>
          </div>
        </aside>
      </section>

      <section className="mt-9">
        <div className="flex gap-6 border-b border-slate-300" role="tablist" aria-label="Nội dung hồ sơ">
          <button type="button" role="tab" aria-selected={activeTab === 'completed'} onClick={() => setActiveTab('completed')} className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeTab === 'completed' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            Khóa học đã hoàn thành
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'results'} onClick={() => setActiveTab('results')} className={`border-b-2 px-1 py-3 text-sm font-semibold ${activeTab === 'results' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            Kết quả học tập
          </button>
        </div>
        {activeTab === 'completed' ? (
          loadingCourses ? <p className="py-6 text-sm text-slate-500">Đang tải khóa học...</p> : completedCourses.length ? (
            <ul className="divide-y divide-slate-200">
              {completedCourses.map((course) => (
                <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div><p className="text-xs text-slate-500">#{course.id}</p><p className="mt-1 text-sm font-semibold text-slate-900">{course.title}</p></div>
                  <span className="text-xs font-semibold text-emerald-800">Hoàn thành</span>
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-sm text-slate-500">Chưa có khóa học hoàn thành.</p>
        ) : (
          <div className="flex items-start gap-3 py-6 text-sm text-slate-600">
            <BookOpen className="mt-0.5 h-4 w-4 text-slate-500" /> Kết quả quiz và bài tập sẽ xuất hiện tại đây khi dữ liệu được kết nối.
          </div>
        )}
      </section>
    </main>
  );
};

export default ProfilePage;
