import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import { CheckCircle2, CircleAlert, History } from 'lucide-react';

const AdminReportsLogs = ({ activeTab }) => {
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadedTab, setLoadedTab] = useState(null);
  const loading = (activeTab === 'reports' || activeTab === 'logs') && loadedTab !== activeTab;

  useEffect(() => {
    if (activeTab !== 'reports' && activeTab !== 'logs') return;
    const load = activeTab === 'reports' ? adminApi.getReports : adminApi.getAdminLogs;
    load()
      .then((items) => activeTab === 'reports' ? setReports(items) : setLogs(items))
      .catch(() => toast.error('Không thể tải dữ liệu quản trị.'))
      .finally(() => setLoadedTab(activeTab));
  }, [activeTab]);

  const setResolved = async (report, resolved) => {
    try {
      await adminApi.resolveReport(report.id, resolved);
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, is_resolved: resolved } : item));
    } catch {
      toast.error('Không thể cập nhật trạng thái báo cáo.');
    }
  };

  if (activeTab !== 'reports' && activeTab !== 'logs') return null;

  return (
    <section className="space-y-4">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase text-rose-700">Quản trị hệ thống</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{activeTab === 'reports' ? 'Quản lý báo cáo' : 'Nhật ký hệ thống'}</h2>
      </div>
      {loading ? <p className="py-8 text-sm text-slate-500">Đang tải...</p> : activeTab === 'reports' ? (
        reports.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Chưa có báo cáo.</p> : (
          <ul className="divide-y divide-slate-200">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Báo cáo #{report.id} · {report.reporter_username}</p>
                  <p className="mt-1 text-sm text-slate-700">{report.reason}</p>
                  {report.comment_content && <blockquote className="mt-2 border-l-2 border-slate-300 pl-3 text-sm text-slate-500">{report.comment_content}</blockquote>}
                  <time className="mt-2 block text-xs text-slate-400">{new Date(report.created_at).toLocaleString('vi-VN')}</time>
                </div>
                <button
                  type="button"
                  onClick={() => setResolved(report, !report.is_resolved)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${report.is_resolved ? 'border-slate-300 text-slate-600' : 'border-amber-300 text-amber-800 hover:bg-amber-50'}`}
                >
                  {report.is_resolved ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                  {report.is_resolved ? 'Đã xử lý' : 'Đánh dấu đã xử lý'}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : logs.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Chưa có nhật ký.</p> : (
        <ul className="divide-y divide-slate-200">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-3 py-4">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">{log.action}</p>
                <p className="mt-1 text-xs text-slate-500">{log.admin_username} · {new Date(log.created_at).toLocaleString('vi-VN')}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default AdminReportsLogs;