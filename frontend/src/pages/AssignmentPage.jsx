import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Clock3, FileText, Paperclip, Upload, X } from 'lucide-react';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const mediaUrl = (path) => path?.startsWith('http')
  ? path
  : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${path || ''}`;
const isImage = (path) => /\.(avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(path || '');
const isPdf = (path) => /\.pdf(?:\?|$)/i.test(path || '');

const AssignmentPage = () => {
  const { id: courseId, assignmentId } = useParams();
  const { isAuthenticated, isLearner } = useAuth();
  const [course, setCourse] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [answers, setAnswers] = useState({});
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(0);
  const [quizEndTime, setQuizEndTime] = useState(0);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [courseData, assignmentData] = await Promise.all([
          courseApi.getCourseDetail(courseId),
          courseApi.getAssignmentDetail(assignmentId),
        ]);
        if (Number(assignmentData.course) !== Number(courseId)) throw new Error('Bài tập không thuộc khóa học này.');
        const submissions = isAuthenticated ? await courseApi.getAssignmentSubmissions(assignmentId) : [];
        const submissionList = Array.isArray(submissions) ? submissions : submissions?.results || [];
        if (!active) return;
        setCourse(courseData);
        setAssignment(assignmentData);
        setSubmission(submissionList[0] || null);
        setNow(Date.now());
        if (assignmentData.assignment_type === 'quiz') {
          setQuizEndTime(Date.now() + (assignmentData.time_limit_minutes || 15) * 60 * 1000);
          autoSubmitted.current = false;
        }
        if (submissionList[0]?.answers) setAnswers(submissionList[0].answers);
      } catch (error) {
        if (!active) return;
        console.error('Failed to load assignment:', error);
        toast.error(error.response?.data?.detail || error.message || 'Không thể tải bài tập.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [courseId, assignmentId, isAuthenticated]);

  const expired = Boolean(assignment?.deadline && new Date(assignment.deadline).getTime() < now);
  const quizSeconds = assignment?.assignment_type === 'quiz'
    ? Math.max(0, Math.ceil((quizEndTime - now) / 1000))
    : null;
  const remaining = assignment?.deadline
    ? Math.max(0, new Date(assignment.deadline).getTime() - now)
    : null;

  const submitQuizAnswers = async () => {
    setSubmitting(true);
    try {
      const result = await courseApi.submitAssignment(assignment.id, { answers });
      setSubmission((current) => ({ ...current, ...result, submitted_at: new Date().toISOString(), answers: { ...answers } }));
      toast.success(`Đã nộp bài. Điểm: ${result.score} / 10`);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      toast.error(error.response?.data?.error || 'Nộp bài thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitOnQuizTimeout = useEffectEvent(() => {
    if (autoSubmitted.current || !assignment || submitting) return;
    autoSubmitted.current = true;
    toast('Đã hết thời gian làm bài. Bài làm đang được tự động nộp.');
    submitQuizAnswers();
  });

  useEffect(() => {
    if (quizSeconds === 0) submitOnQuizTimeout();
  }, [quizSeconds]);

  const submit = async (event) => {
    event.preventDefault();
    if (!isAuthenticated || !isLearner) {
      toast.error('Chỉ học viên đã đăng nhập mới có thể nộp bài.');
      return;
    }
    if (expired || (assignment.assignment_type === 'quiz' && quizSeconds === 0)) {
      toast.error('Bài tập đã quá hạn.');
      return;
    }
    if (assignment.assignment_type === 'quiz') {
      const answeredCount = Object.keys(answers).length;
      if (answeredCount < (assignment.questions || []).length && !window.confirm(`Bạn mới trả lời ${answeredCount}/${assignment.questions.length} câu hỏi. Bạn có chắc chắn muốn nộp bài ngay không?`)) return;
      await submitQuizAnswers();
      return;
    }
    if (assignment.assignment_type === 'file' && !file) {
      toast.error('Vui lòng chọn tệp cần nộp.');
      return;
    }
    if (file && file.size > MAX_FILE_SIZE) {
      toast.error('Tệp không được vượt quá 20 MB.');
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await courseApi.submitAssignment(assignment.id, form);
      const submissions = await courseApi.getAssignmentSubmissions(assignment.id);
      const list = Array.isArray(submissions) ? submissions : submissions?.results || [];
      setSubmission(list[0] || result);
      setFile(null);
      toast.success('Đã tải bài nộp lên thành công.');
    } catch (error) {
      console.error('Failed to submit assignment:', error);
      toast.error(error.response?.data?.error || error.response?.data?.file?.[0] || 'Nộp bài thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectFile = (event) => {
    const selected = event.target.files?.[0] || null;
    if (selected && selected.size > MAX_FILE_SIZE) {
      toast.error('Tệp không được vượt quá 20 MB.');
      event.target.value = '';
      return;
    }
    setFile(selected);
  };

  if (loading) return <div className="py-20"><LoadingSpinner size="large" text="Đang tải bài tập..." /></div>;
  if (!course || !assignment) return <main className="mx-auto max-w-3xl px-4 py-16 text-center"><p className="text-slate-700">Không thể tìm thấy bài tập này.</p><Link to={`/courses/${courseId}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Quay lại đề cương</Link></main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to={`/courses/${courseId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" /> {course.title}</Link>
      <header className="border-b border-slate-300 py-5">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-800">{assignment.assignment_type === 'quiz' ? 'Bài kiểm tra trắc nghiệm' : 'Bài tập nộp tệp'}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-slate-950">{assignment.title}</h1>
        {assignment.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{assignment.description}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          {assignment.deadline && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> Hạn nộp: {new Date(assignment.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>}
          {assignment.assignment_type === 'quiz' && <span>Thời gian: {Math.floor((quizSeconds || 0) / 60)}:{String((quizSeconds || 0) % 60).padStart(2, '0')}</span>}
        </div>
      </header>

      {assignment.prompt_file && (
        <section className="mt-5 border border-emerald-200 bg-emerald-50 p-4" aria-label="Tệp đề bài">
          <h2 className="font-semibold text-emerald-950">Tệp đề bài</h2>
          <a href={mediaUrl(assignment.prompt_file)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 underline">
            <FileText className="h-4 w-4" /> Mở hoặc tải đề bài
          </a>
          {isPdf(assignment.prompt_file) && <iframe title="Đề bài PDF" src={mediaUrl(assignment.prompt_file)} className="mt-3 h-[65vh] w-full border border-slate-300 bg-white" />}
        </section>
      )}

      {!isAuthenticated || !isLearner ? (
        <p className="mt-6 border-l-2 border-amber-500 pl-3 text-sm text-amber-900">Đăng nhập bằng tài khoản học viên đã đăng ký khóa học để làm và nộp bài.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-6">
          {assignment.assignment_type === 'quiz' ? (
            <ol className="divide-y divide-slate-200">
              {(assignment.questions || []).map((question, index) => (
                <li key={question.id} className="py-5">
                  <h2 className="font-semibold text-slate-900">{index + 1}. {question.content}</h2>
                  {question.attachment && <div className="mt-3">
                    {isImage(question.attachment)
                      ? <img src={mediaUrl(question.attachment)} alt={`Hình minh họa câu ${index + 1}`} className="max-h-96 max-w-full border border-slate-200 object-contain" />
                      : <a href={mediaUrl(question.attachment)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 underline"><FileText className="h-4 w-4" /> Mở tệp đính kèm câu hỏi</a>}
                  </div>}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <label key={option} className={`flex cursor-pointer items-start gap-2 border px-3 py-3 text-sm ${answers[String(question.id)] === option ? 'border-emerald-800 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" name={`question-${question.id}`} value={option} checked={answers[String(question.id)] === option} onChange={() => setAnswers((current) => ({ ...current, [String(question.id)]: option }))} />
                        <span><strong>{option}.</strong> {question[`option_${option.toLowerCase()}`]}</span>
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <section className="border border-slate-300 bg-white p-5 sm:p-7" aria-label="Khu vực nộp tệp">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-50 p-2 text-emerald-800"><Paperclip className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-semibold text-slate-900">Tệp bài làm</h2>
                  <p className="mt-1 text-xs text-slate-500">Chọn một tệp để nộp. Dung lượng tối đa 20 MB.</p>
                </div>
              </div>
              {submission?.submitted_file && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-slate-50 px-3 py-3">
                  <a href={mediaUrl(submission.submitted_file)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><FileText className="h-4 w-4" /> Bài nộp hiện tại</a>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Đã nộp</span>
                </div>
              )}
              <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-emerald-700 hover:bg-emerald-50/40">
                <Upload className="h-7 w-7 text-emerald-800" />
                <span className="mt-2 text-sm font-semibold text-slate-800">{file?.name || 'Chọn tệp từ thiết bị'}</span>
                <span className="mt-1 text-xs text-slate-500">{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF, tài liệu, hình ảnh hoặc tệp nén · Tối đa 20 MB'}</span>
                <input type="file" className="sr-only" onChange={selectFile} disabled={expired || submitting} />
              </label>
              {file && <button type="button" onClick={() => setFile(null)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-700"><X className="h-4 w-4" /> Bỏ tệp đã chọn</button>}
            </section>
          )}
          {submission?.score != null && <p className="border-l-2 border-emerald-700 pl-3 text-sm font-semibold text-emerald-900">Điểm hiện tại: {submission.score} / 10</p>}
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button type="submit" disabled={expired || (assignment.assignment_type === 'quiz' && quizSeconds === 0) || submitting || (assignment.assignment_type === 'file' && !file)} className="inline-flex items-center gap-2 bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? 'Đang nộp…' : expired ? 'Đã quá hạn' : assignment.assignment_type === 'quiz' && quizSeconds === 0 ? 'Đã hết giờ' : submission ? 'Nộp lại bài' : 'Nộp bài'}
            </button>
          </div>
        </form>
      )}
      {remaining != null && !expired && <p className="mt-4 text-right text-xs text-slate-500">Còn lại: {Math.floor(remaining / 3600000)} giờ {Math.floor((remaining % 3600000) / 60000)} phút</p>}
    </main>
  );
};

export default AssignmentPage;
