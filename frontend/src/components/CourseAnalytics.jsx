import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Activity, BellRing, TrendingDown, Users } from 'lucide-react';
import { courseApi } from '../api/courseApi';
import LoadingSpinner from './LoadingSpinner';

const riskLabels = {
  at_risk: 'Cần can thiệp',
  watch: 'Cần theo dõi',
  ok: 'Đúng tiến độ',
};

const riskStyles = {
  at_risk: 'bg-rose-50 text-rose-800 border-rose-200',
  watch: 'bg-amber-50 text-amber-800 border-amber-200',
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

const percent = (value) => `${Math.round((value || 0) * 100)}%`;

export default function CourseAnalytics({ courseId }) {
  const [report, setReport] = useState(null);
  const [loadedCourseId, setLoadedCourseId] = useState(null);
  const [sending, setSending] = useState(null);

  useEffect(() => {
    let active = true;
    const loadReport = async () => {
      try {
        const data = await courseApi.getCourseAnalytics(courseId);
        if (active) setReport(data);
      } catch (error) {
        if (active) {
          console.error('Failed to load course analytics:', error);
          setReport(null);
          toast.error(error.response?.data?.detail || 'Không thể tải phân tích khóa học.');
        }
      } finally {
        if (active) setLoadedCourseId(courseId);
      }
    };
    loadReport();
    return () => { active = false; };
  }, [courseId]);

  const sendReminder = async (student) => {
    setSending(student.student_id);
    try {
      const result = await courseApi.interveneCourseLearner(courseId, student.student_id);
      toast.success(result.deduplicated ? 'Đã gửi nhắc học viên trong 24 giờ qua.' : 'Đã gửi thông báo nhắc tiến độ.');
    } catch (error) {
      toast.error(error.response?.data?.action?.[0] || error.response?.data?.detail || 'Không thể gửi thông báo.');
    } finally {
      setSending(null);
    }
  };

  if (loadedCourseId !== courseId) return <LoadingSpinner text="Đang tổng hợp dữ liệu học tập..." />;
  if (!report) return <p className="py-8 text-center text-sm text-slate-500">Chưa thể hiển thị báo cáo.</p>;

  return (
    <section className="space-y-6" aria-labelledby="course-analytics-title">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Learning analytics & early warning</p>
        <h2 id="course-analytics-title" className="mt-1 text-xl font-semibold text-slate-950">Tiến độ và cảnh báo sớm</h2>
        <p className="mt-1 text-sm text-slate-600">
          Mốc tham chiếu tiến độ là 28 ngày; đây là tín hiệu hỗ trợ giảng viên, không phải kết luận về năng lực học viên.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Users className="h-4 w-4" /> Học viên ghi danh</div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{report.enrolled_count}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-800"><BellRing className="h-4 w-4" /> Cần can thiệp</div>
          <p className="mt-2 text-2xl font-bold text-rose-900">{report.risk_counts.at_risk}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800"><TrendingDown className="h-4 w-4" /> Cần theo dõi</div>
          <p className="mt-2 text-2xl font-bold text-amber-900">{report.risk_counts.watch}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Activity className="h-4 w-4" /> Hoàn thành trung bình</div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{percent(report.mean_completion_ratio)}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="analytics-timeline-title">
        <h3 id="analytics-timeline-title" className="font-semibold text-slate-900">Diễn biến học tập theo tuần</h3>
        <p className="mt-1 text-xs text-slate-500">Tỷ lệ hoàn thành trung vị, mốc tham chiếu và điểm quiz trung bình trong tuần.</p>
        <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {report.weekly_progress.map((week) => (
            <div key={week.week_start} className="flex flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end justify-center gap-1 border-b border-slate-200 bg-slate-50 px-1">
                <div
                  title={`Hoàn thành: ${percent(week.median_completion)}`}
                  className="w-3 rounded-t bg-indigo-600"
                  style={{ height: `${Math.max((week.median_completion || 0) * 100, 2)}%` }}
                />
                <div
                  title={`Kỳ vọng: ${percent(week.expected_completion)}`}
                  className="w-3 rounded-t bg-slate-300"
                  style={{ height: `${Math.max((week.expected_completion || 0) * 100, 2)}%` }}
                />
                {week.mean_quiz_score != null && (
                  <div
                    title={`Điểm quiz trung bình: ${week.mean_quiz_score.toFixed(1)}/10 (${week.quiz_attempt_count} lượt)`}
                    className="w-3 rounded-t bg-teal-500"
                    style={{ height: `${Math.max((week.mean_quiz_score / 10) * 100, 2)}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] text-slate-500">{new Date(`${week.week_start}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 bg-indigo-600" /> Thực tế</span>
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 bg-slate-300" /> Mốc tham chiếu 28 ngày</span>
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 bg-teal-500" /> Điểm quiz TB/10</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="analytics-students-title">
        <div className="border-b border-slate-200 px-4 py-4">
          <h3 id="analytics-students-title" className="font-semibold text-slate-900">Học viên và lý do cảnh báo</h3>
          <p className="mt-1 text-xs text-slate-500">Các quy tắc dựa trên tiến độ sau 14 ngày, chuỗi điểm quiz thấp và 7 ngày không hoạt động.</p>
        </div>
        {report.students.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Chưa có học viên ghi danh để phân tích.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Học viên</th>
                  <th className="px-4 py-3">Tiến độ</th>
                  <th className="px-4 py-3">Hoạt động gần nhất</th>
                  <th className="px-4 py-3">Trạng thái và giải thích</th>
                  <th className="px-4 py-3">Can thiệp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.students.map((student) => (
                  <tr key={student.student_id} data-testid={`analytics-student-${student.student_id}`} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{student.full_name}</p>
                      <p className="text-xs text-slate-500">{student.username}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-800">{student.completed_lessons}/{student.total_lessons} bài · {percent(student.completion_ratio)}</p>
                      <p className="mt-1 text-xs text-slate-500">Điểm quiz TB: {student.avg_quiz_score == null ? 'Chưa có' : `${student.avg_quiz_score.toFixed(1)}/10`}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {student.days_since_last_active === 0 ? 'Hôm nay' : `${student.days_since_last_active} ngày trước`}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles[student.risk_level]}`}>
                        {riskLabels[student.risk_level]}
                      </span>
                      {student.reasons.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                          {student.reasons.map((reason) => <li key={reason.code}>{reason.text}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-xs text-slate-500">Chưa có dấu hiệu cảnh báo theo các quy tắc hiện tại.</p>}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={!student.reasons.length || sending === student.student_id}
                        onClick={() => sendReminder(student)}
                        className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sending === student.student_id ? 'Đang gửi…' : 'Gửi nhắc'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
