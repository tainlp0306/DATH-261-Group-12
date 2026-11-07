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
  const [attempts, setAttempts] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [attemptStartedAt, setAttemptStartedAt] = useState(null);
  const [answers, setAnswers] = useState({});
  const answersRef = useRef({});
  const answerSaveQueue = useRef(Promise.resolve(true));
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
        setAttempts(submissionList);
        setSubmission(assignmentData.assignment_type === 'file'
          ? submissionList.find((item) => item.status === 'submitted') || null
          : null);
        setNow(Date.now());
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
  }, [courseId, assignmentId, isAuthenticated, isLearner]);

  const expired = Boolean(assignment?.deadline && new Date(assignment.deadline).getTime() < now);
  const quizSeconds = assignment?.assignment_type === 'quiz' && attemptId
    ? Math.max(0, Math.ceil((quizEndTime - now) / 1000))
    : null;
  const remaining = assignment?.deadline
    ? Math.max(0, new Date(assignment.deadline).getTime() - now)
    : null;

  const submitQuizAnswers = async () => {
    setSubmitting(true);
    try {
      await answerSaveQueue.current;
      const result = await courseApi.submitAssignment(assignment.id, {
        answers: answersRef.current,
        submission_id: attemptId,
      });
      setQuizResult({ ...result, status: 'submitted', started_at: attemptStartedAt });
      setAttemptId(null);
      try {
        const history = await courseApi.getAssignmentSubmissions(assignment.id);
        setAttempts(Array.isArray(history) ? history : history?.results || []);
      } catch (error) {
        console.error('Failed to refresh quiz history:', error);
        toast.error('Đã nộp bài nhưng không tải được lịch sử mới nhất.');
      }
      toast.success(result.score == null ? 'Đã nộp bài.' : `Đã nộp bài. Điểm: ${result.score} / 10`);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      toast.error(error.response?.data?.error || 'Nộp bài thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const startNextAttempt = async () => {
    try {
      const attempt = await courseApi.startAssignmentAttempt(assignment.id);
      setAttemptId(attempt.id);
      setAttemptStartedAt(attempt.started_at);
      setQuizEndTime(new Date(attempt.started_at).getTime() + (attempt.time_limit_minutes || 15) * 60 * 1000);
      const savedAnswers = attempt.answers || {};
      answersRef.current = savedAnswers;
      setAnswers(savedAnswers);
      answerSaveQueue.current = Promise.resolve(true);
      setQuizResult(null);
      autoSubmitted.current = false;
      try {
        const history = await courseApi.getAssignmentSubmissions(assignment.id);
        setAttempts(Array.isArray(history) ? history : history?.results || []);
      } catch (error) {
        console.error('Failed to refresh quiz history:', error);
        toast.error('Không tải được lịch sử mới nhất; lượt làm vẫn đang mở.');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Không thể bắt đầu lượt làm mới.');
      try {
        const history = await courseApi.getAssignmentSubmissions(assignment.id);
        setAttempts(Array.isArray(history) ? history : history?.results || []);
      } catch (refreshError) {
        console.error('Failed to refresh quiz history after start error:', refreshError);
      }
    }
  };

  const updateQuizAnswer = (questionId, option) => {
    const nextAnswers = { ...answersRef.current, [String(questionId)]: option };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    answerSaveQueue.current = answerSaveQueue.current.then(() => (
      courseApi.saveAssignmentAttemptAnswers(assignment.id, attemptId, nextAnswers)
    )).then(() => true).catch((error) => {
      console.error('Failed to save quiz answers:', error);
      toast.error(error.response?.data?.error || 'Không lưu được đáp án. Hãy kiểm tra kết nối.');
      return false;
    });
  };

  const submitOnQuizTimeout = useEffectEvent(() => {
    if (autoSubmitted.current || !assignment || submitting) return;
    autoSubmitted.current = true;
    toast('Đã hết thời gian làm bài. Bài làm đang được tự động nộp.');
    submitQuizAnswers();
  });

  useEffect(() => {
    if (attemptId && quizSeconds === 0) submitOnQuizTimeout();
  }, [attemptId, quizSeconds]);

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

  const scoredAttempts = attempts.filter((attempt) => typeof attempt.score === 'number');
  const averageScore = scoredAttempts.length
    ? scoredAttempts.reduce((total, attempt) => total + attempt.score, 0) / scoredAttempts.length
    : null;
  const highestScore = scoredAttempts.length
    ? Math.max(...scoredAttempts.map((attempt) => attempt.score))
    : null;
  const activeHistoryAttempt = attempts.find((attempt) => attempt.status === 'in_progress');
  const hasAttemptCapacity = Boolean(activeHistoryAttempt)
    || assignment?.max_attempts == null
    || attempts.length < assignment.max_attempts;

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
          {assignment.deadline && <span className={`inline-flex items-center gap-1.5 ${expired ? 'font-semibold text-rose-700' : ''}`}><Clock3 className="h-4 w-4" /> {expired ? 'Đã quá hạn:' : 'Hạn nộp:'} {new Date(assignment.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>}
          {assignment.assignment_type === 'quiz' && attemptId && <span>Thời gian còn lại: {Math.floor((quizSeconds || 0) / 60)}:{String((quizSeconds || 0) % 60).padStart(2, '0')}</span>}
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
      ) : assignment.assignment_type === 'quiz' && quizResult ? (
        <section className="mt-6 space-y-4 border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold text-emerald-950">Lượt làm đã được nộp</h2>
          {quizResult.score != null
            ? <p className="text-sm text-emerald-900">Điểm: {quizResult.score} / 10</p>
            : <p className="text-sm text-emerald-900">Kết quả sẽ xuất hiện theo cài đặt của giảng viên.</p>}
          <div className="flex flex-wrap gap-3">
            {quizResult.review_available && (
              <Link to={`/courses/${courseId}/assignments/${assignmentId}/submissions/${quizResult.id}/review`} className="text-sm font-semibold text-emerald-900 underline">
                Xem lại bài làm
              </Link>
            )}
            <button type="button" onClick={() => setQuizResult(null)} className="text-sm font-semibold text-emerald-900 underline">Xem lịch sử các lượt</button>
          </div>
        </section>
      ) : assignment.assignment_type === 'quiz' && !attemptId ? (
        <section className="mt-6 space-y-5 border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-950">Lịch sử làm bài</h2>
              <p className="mt-1 text-xs text-slate-500">
                {assignment.max_attempts == null
                  ? `Đã làm ${attempts.length} lượt · Không giới hạn số lượt`
                  : `Đã dùng ${attempts.length} / ${assignment.max_attempts} lượt`}
              </p>
            </div>
            {scoredAttempts.length > 0 && (
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-slate-600">Điểm trung bình: <strong className="text-slate-900">{averageScore.toFixed(2)} / 10</strong></span>
                <span className="text-slate-600">Cao nhất: <strong className="text-emerald-800">{highestScore.toFixed(2)} / 10</strong></span>
              </div>
            )}
          </div>
          {attempts.length === 0 ? (
            <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">Bạn chưa làm bài kiểm tra này.</p>
          ) : (
            <ol className="divide-y divide-slate-100 border-y border-slate-100">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">Lượt {attempt.attempt_number}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {attempt.status === 'in_progress' ? 'Đang làm dở'
                        : attempt.status === 'expired' ? 'Hết giờ'
                          : `Đã nộp ${attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('vi-VN') : ''}`}
                      {attempt.status === 'in_progress' && attempt.started_at && ` · Bắt đầu ${new Date(attempt.started_at).toLocaleString('vi-VN')}`}
                      {attempt.duration_seconds != null && ` · ${Math.floor(attempt.duration_seconds / 60)} phút ${attempt.duration_seconds % 60} giây`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">{attempt.score == null ? 'Chưa có điểm' : `${attempt.score} / 10`}</span>
                    {attempt.review_available && (
                      <Link to={`/courses/${courseId}/assignments/${assignmentId}/submissions/${attempt.id}/review`} className="text-xs font-semibold text-indigo-700 underline">Xem lại</Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <button type="button" onClick={startNextAttempt} disabled={expired || !hasAttemptCapacity} className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
            {activeHistoryAttempt ? 'Tiếp tục lượt đang làm' : attempts.length ? 'Làm lại bài' : 'Bắt đầu làm bài'}
          </button>
          {!hasAttemptCapacity && !activeHistoryAttempt && <p className="text-xs font-medium text-rose-700">Bạn đã sử dụng hết số lượt được phép.</p>}
          {expired && <p className="text-xs font-medium text-rose-700">Bài kiểm tra đã quá hạn.</p>}
        </section>
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
                        <input type="radio" name={`question-${question.id}`} value={option} checked={answers[String(question.id)] === option} onChange={() => updateQuizAnswer(question.id, option)} />
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
              <label aria-disabled={expired || submitting} className={`mt-5 flex min-h-36 flex-col items-center justify-center border-2 border-dashed px-4 py-6 text-center ${expired || submitting ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-emerald-700 hover:bg-emerald-50/40'}`}>
                <Upload className="h-7 w-7 text-emerald-800" />
                <span className="mt-2 text-sm font-semibold text-slate-800">{expired ? 'Bài tập đã quá hạn' : file?.name || 'Chọn tệp từ thiết bị'}</span>
                <span className="mt-1 text-xs text-slate-500">{expired ? 'Không thể chọn hoặc nộp tệp.' : file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'PDF, tài liệu, hình ảnh hoặc tệp nén · Tối đa 20 MB'}</span>
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
