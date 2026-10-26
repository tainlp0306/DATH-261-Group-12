import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Save } from 'lucide-react';
import { courseApi } from '../api/courseApi';
import LoadingSpinner from '../components/LoadingSpinner';

const InstructorAssignmentResultsPage = () => {
  const { id: courseId, assignmentId } = useParams();
  const [data, setData] = useState(null);
  const [grades, setGrades] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    courseApi.getAssignmentGrading(assignmentId)
      .then((result) => {
        if (!active) return;
        setData(result);
        setGrades(Object.fromEntries((result.submissions || []).map((submission) => [submission.id, submission.score ?? ''])));
      })
      .catch((error) => {
        console.error('Failed to load assignment grading data:', error);
        toast.error(error.response?.data?.error || 'Không thể tải dữ liệu chấm bài.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assignmentId]);

  const saveScore = async (submissionId) => {
    const score = grades[submissionId];
    if (score === '' || Number(score) < 0 || Number(score) > 10) {
      toast.error('Điểm phải nằm trong khoảng 0 đến 10.');
      return;
    }
    setSavingId(submissionId);
    try {
      const updated = await courseApi.gradeSubmission(submissionId, { score: Number(score) }, 'assignment');
      setData((current) => ({
        ...current,
        submissions: current.submissions.map((submission) => submission.id === updated.id ? { ...submission, score: updated.score } : submission),
      }));
      toast.success('Đã lưu điểm.');
    } catch (error) {
      console.error('Failed to save assignment score:', error);
      toast.error(error.response?.data?.score?.[0] || error.response?.data?.error || 'Không thể lưu điểm.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="py-20"><LoadingSpinner size="large" text="Đang tải bảng chấm bài..." /></div>;
  if (!data) return <main className="mx-auto max-w-4xl px-4 py-12 text-center"><p>Không thể tải bảng chấm bài.</p><Link to={`/instructor/courses/${courseId}/manage`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Quản lý khóa học</Link></main>;

  const mediaUrl = (path) => path?.startsWith('http') ? path : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${path || ''}`;
  const isQuiz = data.assignment_type === 'quiz';

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <Link to={`/instructor/courses/${courseId}/manage`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" /> Quản lý khóa học</Link>
      <header className="mt-5 border-b border-slate-300 pb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{data.module_title || 'Bài tập'}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-slate-950">Chấm bài: {data.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{data.submissions.length} bài nộp</p>
      </header>

      {isQuiz ? (
        <div className="mt-6 overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="sticky left-0 border-b border-r border-slate-300 bg-slate-100 px-4 py-3">Học viên</th>
                {data.questions.map((question, index) => <th key={question.id} className="min-w-40 border-b border-r border-slate-300 px-4 py-3">Câu {index + 1}: {question.content}</th>)}
                <th className="border-b border-slate-300 px-4 py-3">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.submissions.map((submission) => (
                <tr key={submission.id}>
                  <th scope="row" className="sticky left-0 border-r border-slate-200 bg-white px-4 py-3 font-semibold">{submission.student_name}</th>
                  {data.questions.map((question) => {
                    const answer = submission.answers?.[String(question.id)] || '—';
                    const isCorrect = answer !== '—' && answer === question.correct_option;
                    return <td key={question.id} className="border-r border-slate-200 px-4 py-3"><span className={isCorrect ? 'font-semibold text-emerald-800' : answer === '—' ? 'text-slate-400' : 'font-semibold text-rose-700'}>{answer}{answer !== '—' && ` · ${isCorrect ? 'Đúng' : 'Sai'}`}</span></td>;
                  })}
                  <td className="px-4 py-3 font-semibold">{submission.score ?? '—'} / 10</td>
                </tr>
              ))}
              {data.submissions.length === 0 && <tr><td colSpan={data.questions.length + 2} className="px-4 py-10 text-center text-slate-500">Chưa có học viên nộp bài kiểm tra.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-100"><tr><th className="px-4 py-3">Học viên</th><th className="px-4 py-3">Tệp mới nhất</th><th className="px-4 py-3">Nộp lúc</th><th className="px-4 py-3">Điểm (0–10)</th><th className="px-4 py-3">Lưu</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {data.submissions.map((submission) => (
                <tr key={submission.id}>
                  <th scope="row" className="px-4 py-3 font-semibold">{submission.student_name}</th>
                  <td className="px-4 py-3">{submission.submitted_file ? <a href={mediaUrl(submission.submitted_file)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"><Download className="h-4 w-4" /> Mở tệp</a> : 'Không có tệp'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{new Date(submission.submitted_at).toLocaleString('vi-VN')}</td>
                  <td className="px-4 py-3"><input aria-label={`Điểm của ${submission.student_name}`} type="number" min="0" max="10" step="0.1" value={grades[submission.id] ?? ''} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: event.target.value }))} className="w-24 border border-slate-300 px-2 py-1.5" /></td>
                  <td className="px-4 py-3"><button type="button" onClick={() => saveScore(submission.id)} disabled={savingId === submission.id} className="inline-flex items-center gap-1 border border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {savingId === submission.id ? 'Đang lưu' : 'Lưu điểm'}</button></td>
                </tr>
              ))}
              {data.submissions.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Chưa có học viên nộp tệp.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
};

export default InstructorAssignmentResultsPage;
