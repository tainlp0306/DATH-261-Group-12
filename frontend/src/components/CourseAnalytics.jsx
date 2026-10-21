import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { analyticsApi } from '../api/analyticsApi';

const LEVEL_LABEL = {
  ok: 'Ổn',
  watch: 'Theo dõi',
  at_risk: 'Chậm tiến độ',
  critical: 'Rất chậm',
};

const LEVEL_CLASS = {
  ok: 'bg-emerald-50 text-emerald-800',
  watch: 'bg-amber-50 text-amber-800',
  at_risk: 'bg-orange-50 text-orange-900',
  critical: 'bg-red-50 text-red-800',
};

const percent = (ratio) => (ratio == null ? '—' : `${Math.round(ratio * 100)}%`);

const CourseAnalytics = ({ courseId }) => {
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [level, setLevel] = useState('at_risk');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openReasons, setOpenReasons] = useState(null);
  const [sending, setSending] = useState('');

  const load = async (nextLevel = level) => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, riskData] = await Promise.all([
        analyticsApi.getOverview(courseId),
        analyticsApi.getAtRisk(courseId, nextLevel),
      ]);
      setOverview(overviewData);
      setRows(riskData.results || []);
    } catch (err) {
      const message = err.response?.data?.error || 'Không tải được phân tích lớp.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(level);
  }, [courseId, level]);

  const send = async (row, action) => {
    const key = `${row.username}-${action}`;
    setSending(key);
    try {
      const result = await analyticsApi.intervene(courseId, row.student_id, action);
      toast.success(result.deduplicated ? 'Đã nhắc trong 24 giờ qua.' : 'Đã gửi nhắc.');
    } catch (err) {
      toast.error(err.response?.data?.action?.[0] || err.response?.data?.error || 'Không gửi được.');
    } finally {
      setSending('');
    }
  };

  if (loading) {
    return <p className="py-8 text-sm text-slate-500">Đang tải phân tích...</p>;
  }
  if (error) {
    return <p className="py-8 text-sm text-rose-700" data-testid="analytics-error">{error}</p>;
  }
  if (!overview) return null;

  return (
    <div className="space-y-6" data-testid="course-analytics">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ghi danh" value={overview.enrolled_count} testId="kpi-enrolled" />
        <Kpi label="Hoàn thành TB" value={percent(overview.mean_completion_ratio)} testId="kpi-completion" />
        <Kpi label="Ghi nhớ TB" value={overview.mean_retention == null ? '—' : Math.round(overview.mean_retention)} testId="kpi-retention" />
        <Kpi label="Chậm tiến độ" value={overview.at_risk_count} testId="kpi-at-risk-count" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="progress-chart">
        <h3 className="text-sm font-bold text-slate-900">Tiến độ lớp theo tuần</h3>
        <p className="mt-1 text-xs text-slate-500">Đường trung vị bài đã hoàn thành, so với kế hoạch 28 ngày.</p>
        <div className="mt-4 space-y-2">
          {overview.weekly_progress.every((point) => !point.median_completion) ? (
            <p className="text-sm text-slate-500">Chưa có nhật ký hoàn thành bài.</p>
          ) : overview.weekly_progress.map((point) => (
            <div key={point.week_start} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-xs">
              <span className="text-slate-500">{point.week_start}</span>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-indigo-600"
                  style={{ width: `${Math.round((point.median_completion || 0) * 100)}%` }}
                />
              </div>
              <span className="font-semibold text-slate-800">{percent(point.median_completion)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="completion-buckets">
        <h3 className="text-sm font-bold text-slate-900">Phân bố hoàn thành</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {overview.completion_buckets.map((bucket) => (
            <div key={bucket.label} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{bucket.label}%</p>
              <p className="text-lg font-black text-slate-900">{bucket.count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-bold text-slate-900">Học viên cần chú ý</h3>
          <label className="text-xs font-semibold text-slate-600">
            Lọc
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1"
              data-testid="risk-filter"
            >
              <option value="at_risk">Chậm và rất chậm</option>
              <option value="watch">Theo dõi</option>
              <option value="all">Tất cả</option>
            </select>
          </label>
        </div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Không có học viên ở mức này.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100" data-testid="at-risk-table">
            {rows.map((row) => (
              <li key={row.student_id} className="py-3" data-testid={`at-risk-row-${row.username}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{row.full_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Xong {percent(row.completion_ratio)} · Nghỉ {row.days_since_last_active} ngày · Quiz TB {row.avg_quiz_score == null ? '—' : Number(row.avg_quiz_score).toFixed(1)} · Nhớ {row.retention_score == null ? '—' : row.retention_score}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{row.reasons[0]?.text || 'Chưa có cờ cảnh báo.'}</p>
                    {openReasons === row.username && (
                      <ul className="mt-2 space-y-1 text-xs text-slate-600" data-testid={`at-risk-reasons-${row.username}`}>
                        {row.reasons.map((reason) => <li key={reason.code}>{reason.text}</li>)}
                      </ul>
                    )}
                    {row.reasons.length > 1 && (
                      <button type="button" className="mt-1 text-xs font-semibold text-indigo-700" onClick={() => setOpenReasons(openReasons === row.username ? null : row.username)}>
                        {openReasons === row.username ? 'Ẩn lý do' : 'Xem lý do'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${LEVEL_CLASS[row.risk_level]}`}>{LEVEL_LABEL[row.risk_level]}</span>
                    <button
                      type="button"
                      data-testid={`intervene-notify-${row.username}`}
                      disabled={!row.suggested_actions.includes('notify') || sending === `${row.username}-notify`}
                      onClick={() => send(row, 'notify')}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      Gửi nhắc
                    </button>
                    <button
                      type="button"
                      data-testid={`intervene-review-${row.username}`}
                      disabled={!row.suggested_actions.includes('suggest_review') || sending === `${row.username}-suggest_review`}
                      onClick={() => send(row, 'suggest_review')}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      Gợi ý ôn
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const Kpi = ({ label, value, testId }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-slate-900" data-testid={testId}>{value}</p>
  </div>
);

export default CourseAnalytics;
