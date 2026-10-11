import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Award, ClipboardList, Clock3, FileDown, FileUp, History } from 'lucide-react';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';
import QuizModal from './QuizModal';

const mediaUrl = (path) => path?.startsWith('http')
  ? path
  : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${path || ''}`;

const CourseAssignments = ({ courseId, isEnrolled }) => {
  const { isAuthenticated, isLearner } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [activeTab, setActiveTab] = useState('assignments');
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || !isEnrolled) {
      return () => { active = false; };
    }
    const load = async () => {
      const response = await courseApi.getCourseAssignments(courseId);
      const list = Array.isArray(response) ? response : response?.results || [];
      let nextSubmissions = {};
      if (isLearner) {
        const resultSets = await Promise.all(list.map((assignment) => (
          courseApi.getAssignmentSubmissions(assignment.id)
        )));
        nextSubmissions = Object.fromEntries(list.map((assignment, index) => {
          const result = resultSets[index];
          return [assignment.id, Array.isArray(result) ? result : result?.results || []];
        }));
      }
      if (!active) return;
      setAssignments(list);
      setSubmissions(nextSubmissions);
    };
    load()
      .catch(() => {
        if (active) toast.error('Không thể tải bài tập của khóa học.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [courseId, isAuthenticated, isEnrolled, isLearner]);

  const submitFile = async (assignment, file) => {
    if (!file) return false;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingId(assignment.id);
    try {
      const submission = await courseApi.submitAssignment(assignment.id, formData);
      setSubmissions((current) => ({ ...current, [assignment.id]: [submission] }));
      toast.success('Đã tải bài nộp lên thành công.');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.file?.[0] || 'Nộp bài thất bại.');
      return false;
    } finally {
      setUploadingId(null);
    }
  };

  const refreshAssignmentSubmission = async (assignmentId) => {
    try {
      const response = await courseApi.getAssignmentSubmissions(assignmentId);
      const list = Array.isArray(response) ? response : response?.results || [];
      setSubmissions((current) => ({ ...current, [assignmentId]: list }));
    } catch {
      toast.error('Đã nộp bài nhưng không tải được lịch sử mới nhất.');
    }
  };

  if (!isAuthenticated || !isEnrolled) return null;

  return (
    <section className="border-y border-slate-200 py-5" aria-labelledby="course-assessments-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Đánh giá</p>
          <h2 id="course-assessments-heading" className="mt-1 text-lg font-semibold text-slate-950">Bài tập & kết quả</h2>
        </div>
        <div className="flex gap-1 border-b border-slate-300" role="tablist" aria-label="Bài tập và lịch sử điểm">
          <button type="button" role="tab" aria-selected={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')} className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold ${activeTab === 'assignments' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <ClipboardList className="h-4 w-4" /> Bài tập
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'history'} onClick={() => setActiveTab('history')} className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold ${activeTab === 'history' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <History className="h-4 w-4" /> Điểm số & Lịch sử làm bài
          </button>
        </div>
      </div>

      {loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải bài tập...</p> : assignments.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Khóa học chưa có bài tập.</p>
      ) : activeTab === 'assignments' ? (
        <ul className="mt-3 divide-y divide-slate-200">
          {assignments.map((assignment) => {
            const expired = assignment.deadline && new Date(assignment.deadline).getTime() < currentTime;
            return (
              <li key={assignment.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">{assignment.title}</h3>
                  {assignment.description && <p className="mt-1 text-sm text-slate-600">{assignment.description}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{assignment.assignment_type === 'file' ? 'Nộp tệp' : 'Trắc nghiệm'}</span>
                    {assignment.deadline && <span className={expired ? 'font-semibold text-rose-700' : ''}>Hạn nộp: {new Date(assignment.deadline).toLocaleString('vi-VN')}</span>}
                    {assignment.assignment_type === 'quiz' && <span>{assignment.time_limit_minutes || 15} phút</span>}
                  </p>
                </div>
                {isLearner && assignment.assignment_type === 'quiz' ? (
                  <button type="button" disabled={expired} onClick={() => setActiveQuiz(assignment)} className="inline-flex shrink-0 items-center justify-center gap-2 border border-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">
                    <Clock3 className="h-4 w-4" /> {expired ? 'Đã quá hạn' : 'Làm bài'}
                  </button>
                ) : isLearner && (
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <label className={`inline-flex items-center justify-center gap-2 border px-3 py-2 text-xs font-semibold ${expired ? 'cursor-not-allowed border-slate-300 text-slate-400' : 'cursor-pointer border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                      <FileUp className="h-4 w-4" /> <span className="max-w-44 truncate">{selectedFiles[assignment.id]?.name || 'Chọn tệp'}</span>
                      <input type="file" className="sr-only" disabled={expired || uploadingId === assignment.id} onChange={(event) => {
                        setSelectedFiles((current) => ({ ...current, [assignment.id]: event.target.files?.[0] || null }));
                      }} />
                    </label>
                    <button type="button" disabled={expired || uploadingId === assignment.id || !selectedFiles[assignment.id]} onClick={async () => {
                      const uploaded = await submitFile(assignment, selectedFiles[assignment.id]);
                      if (uploaded) setSelectedFiles((current) => ({ ...current, [assignment.id]: null }));
                    }} className="inline-flex items-center gap-2 border border-emerald-800 bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
                      <FileUp className="h-4 w-4" /> {expired ? 'Đã quá hạn' : uploadingId === assignment.id ? 'Đang tải...' : 'Tải lên'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200">
          {assignments.map((assignment) => {
            const submission = submissions[assignment.id]?.[0];
            return (
              <li key={assignment.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{assignment.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{submission ? `Nộp lúc ${new Date(submission.submitted_at).toLocaleString('vi-VN')}` : 'Chưa có bài nộp'}</p>
                  {submission?.submitted_file && <a href={mediaUrl(submission.submitted_file)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"><FileDown className="h-3.5 w-3.5" /> Tệp đã nộp</a>}
                  {submission?.feedback && <p className="mt-2 text-sm text-slate-600">Phản hồi: {submission.feedback}</p>}
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Award className="h-4 w-4 text-emerald-800" />
                  {submission?.score == null ? 'Chưa chấm' : `${submission.score} / 10`}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {activeQuiz && <QuizModal
        quiz={activeQuiz}
        submitAnswers={(assignmentId, answers) => courseApi.submitAssignment(assignmentId, { answers })}
        onClose={() => setActiveQuiz(null)}
        onCompleted={() => refreshAssignmentSubmission(activeQuiz.id)}
      />}
    </section>
  );
};

export default CourseAssignments;