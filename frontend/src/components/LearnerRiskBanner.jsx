import { useEffect, useState } from 'react';
import { courseApi } from '../api/courseApi';

const copy = {
  ok: {
    title: 'Đúng tiến độ',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  watch: {
    title: 'Cần theo dõi',
    className: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  at_risk: {
    title: 'Nên học lại sớm',
    className: 'border-rose-200 bg-rose-50 text-rose-950',
  },
  critical: {
    title: 'Đã ngưng khá lâu',
    className: 'border-rose-300 bg-rose-100 text-rose-950',
  },
};

const percent = (value) => `${Math.round((value || 0) * 100)}%`;

export default function LearnerRiskBanner({ courseId }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    let active = true;
    courseApi.getMyCourseAnalytics(courseId)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((error) => {
        console.error('Failed to load learner analytics:', error);
      });
    return () => { active = false; };
  }, [courseId]);

  if (!report) return null;
  const tone = copy[report.risk_level] || copy.watch;
  const quiet = report.risk_level === 'ok';

  return (
    <section
      data-testid="learner-risk-banner"
      className={`mb-6 border px-4 py-3 text-sm ${tone.className}`}
      aria-label="Tiến độ và cảnh báo của bạn"
    >
      <p className="text-xs font-bold uppercase tracking-wider">{tone.title}</p>
      <p className="mt-1">
        Đã hoàn thành {report.completed_lessons}/{report.total_lessons} bài ({percent(report.completion_ratio)}).
        {report.days_since_last_active === 0
          ? ' Có hoạt động học hôm nay.'
          : ` Lần học gần nhất cách đây ${report.days_since_last_active} ngày.`}
      </p>
      {!quiet && report.message && <p className="mt-1">{report.message}</p>}
      {report.retention_score != null && (
        <p className="mt-1 text-xs">Độ ghi nhớ ước tính từ các lượt luyện từ: {report.retention_score}/100.</p>
      )}
    </section>
  );
}
