import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Award, CalendarClock, ClipboardList, Download, Plus, Save, Trash2 } from 'lucide-react';
import { courseApi } from '../api/courseApi';

const emptyQuestion = () => ({
  content: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A',
});

const mediaUrl = (path) => path?.startsWith('http')
  ? path
  : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${path || ''}`;

const InstructorAssignments = ({ courseId }) => {
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignmentType, setAssignmentType] = useState('quiz');
  const [timeLimit, setTimeLimit] = useState(15);
  const [deadline, setDeadline] = useState('');
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [grades, setGrades] = useState({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await courseApi.getCourseAssignments(courseId);
      const assignmentList = Array.isArray(response) ? response : response?.results || [];
      const submissionGroups = await Promise.all(assignmentList.map((assignment) => (
        courseApi.getAssignmentSubmissions(assignment.id)
      )));
      if (!active) return;
      setAssignments(assignmentList);
      const nextSubmissions = Object.fromEntries(assignmentList.map((assignment, index) => {
        const group = submissionGroups[index];
        return [assignment.id, Array.isArray(group) ? group : group?.results || []];
      }));
      setSubmissions(nextSubmissions);
      setGrades(Object.fromEntries(Object.values(nextSubmissions).flat().map((submission) => [submission.id, {
        score: submission.score ?? '',
        feedback: submission.feedback || '',
      }])));
    };
    load()
      .catch(() => toast.error('Không thể tải bài tập và bài nộp.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  const createAssignment = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        assignment_type: assignmentType,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        ...(assignmentType === 'quiz' ? {
          time_limit_minutes: Number(timeLimit),
          questions: questions.map((question) => ({ ...question, content: question.content.trim() })),
        } : {}),
      };
      const created = await courseApi.createCourseAssignment(courseId, payload);
      setAssignments((current) => [...current, created]);
      setSubmissions((current) => ({ ...current, [created.id]: [] }));
      setTitle('');
      setDescription('');
      setDeadline('');
      setTimeLimit(15);
      setAssignmentType('quiz');
      setQuestions([emptyQuestion()]);
      toast.success('Đã tạo bài tập.');
    } catch (error) {
      const detail = error.response?.data?.questions?.[0]
        || error.response?.data?.detail
        || error.response?.data?.error
        || 'Không thể tạo bài tập.';
      toast.error(Array.isArray(detail) ? detail[0] : detail);
    } finally {
      setCreating(false);
    }
  };

  const updateQuestion = (index, key, value) => {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, [key]: value } : question
    )));
  };

  const saveGrade = async (assignmentId, submission) => {
    const grade = grades[submission.id] || {};
    if (grade.score === '' || Number(grade.score) < 0 || Number(grade.score) > 10) {
      toast.error('Điểm phải nằm trong khoảng 0 đến 10.');
      return;
    }
    setSavingId(submission.id);
    try {
      const updated = await courseApi.gradeSubmission(submission.id, {
        score: Number(grade.score),
        feedback: grade.feedback || '',
      }, 'assignment');
      setSubmissions((current) => ({
        ...current,
        [assignmentId]: (current[assignmentId] || []).map((item) => item.id === updated.id ? updated : item),
      }));
      toast.success('Đã lưu điểm và phản hồi.');
    } catch (error) {
      toast.error(error.response?.data?.score?.[0] || error.response?.data?.error || 'Không thể lưu điểm.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Đánh giá khóa học</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Bài tập & chấm điểm</h2>
        <p className="mt-1 text-sm text-slate-600">Tạo câu hỏi trắc nghiệm hoặc bài nộp tệp, sau đó theo dõi bài làm của học viên.</p>
      </header>

      <form onSubmit={createAssignment} className="space-y-4 border-y border-slate-200 py-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">
            Tên bài tập
            <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Kiểm tra chương 1" className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Loại bài tập
            <select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700">
              <option value="quiz">Trắc nghiệm</option>
              <option value="file">Nộp tệp</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700 md:col-span-2">
            Mô tả
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Hướng dẫn làm bài hoặc yêu cầu nộp bài" className="mt-1 block w-full resize-y border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
          </label>
          {assignmentType === 'quiz' && (
            <label className="text-xs font-semibold text-slate-700">
              Thời gian làm bài (phút)
              <input type="number" required min="1" max="600" value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
            </label>
          )}
          <label className="text-xs font-semibold text-slate-700">
            Hạn nộp
            <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
          </label>
        </div>

        {assignmentType === 'quiz' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardList className="h-4 w-4 text-emerald-800" /> Câu hỏi</h3>
              <button type="button" onClick={() => setQuestions((current) => [...current, emptyQuestion()])} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"><Plus className="h-4 w-4" /> Thêm câu hỏi</button>
            </div>
            {questions.map((question, index) => (
              <fieldset key={index} className="space-y-3 border-l-2 border-emerald-700 pl-4">
                <div className="flex items-center justify-between">
                  <legend className="text-xs font-bold text-slate-700">Câu {index + 1}</legend>
                  {questions.length > 1 && <button type="button" aria-label={`Xóa câu ${index + 1}`} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="p-1 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nội dung câu hỏi
                  <textarea required value={question.content} onChange={(event) => updateQuestion(index, 'content', event.target.value)} rows={2} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['a', 'b', 'c', 'd'].map((letter) => (
                    <label key={letter} className="text-xs font-semibold text-slate-700">
                      Đáp án {letter.toUpperCase()}
                      <input required value={question[`option_${letter}`]} onChange={(event) => updateQuestion(index, `option_${letter}`, event.target.value)} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
                    </label>
                  ))}
                </div>
                <label className="block max-w-xs text-xs font-semibold text-slate-700">
                  Đáp án đúng
                  <select value={question.correct_option} onChange={(event) => updateQuestion(index, 'correct_option', event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700">
                    {['A', 'B', 'C', 'D'].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </fieldset>
            ))}
          </div>
        )}
        <div className="flex justify-end border-t border-slate-200 pt-4">
          <button type="submit" disabled={creating} className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"><Plus className="h-4 w-4" /> {creating ? 'Đang tạo...' : 'Tạo bài tập'}</button>
        </div>
      </form>

      <section aria-labelledby="grading-dashboard-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h3 id="grading-dashboard-heading" className="text-base font-semibold text-slate-950">Bảng chấm bài</h3>
          <span className="text-xs text-slate-500">{assignments.length} bài tập</span>
        </div>
        {loading ? <p className="py-8 text-sm text-slate-500">Đang tải bài nộp...</p> : assignments.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Chưa có bài tập trong khóa học.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {assignments.map((assignment) => {
              const assignmentSubmissions = submissions[assignment.id] || [];
              const isQuiz = assignment.assignment_type === 'quiz';
              return (
                <section key={assignment.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">{assignment.title}</h4>
                      <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{isQuiz ? 'Trắc nghiệm · tự động chấm' : 'Bài nộp tệp · cần chấm'}</span>
                        {assignment.deadline && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Hạn {new Date(assignment.deadline).toLocaleString('vi-VN')}</span>}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">{assignmentSubmissions.length} bài nộp</span>
                  </div>
                  {assignmentSubmissions.length === 0 ? <p className="mt-3 text-sm text-slate-500">Chưa có học viên nộp bài.</p> : (
                    <ul className="mt-3 divide-y divide-slate-200">
                      {assignmentSubmissions.map((submission) => {
                        const grade = grades[submission.id] || { score: submission.score ?? '', feedback: submission.feedback || '' };
                        return (
                          <li key={submission.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(10rem,1fr)_7rem_minmax(12rem,2fr)_auto] lg:items-end">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{submission.student_name}</p>
                              <p className="mt-1 text-xs text-slate-500">{new Date(submission.submitted_at).toLocaleString('vi-VN')}</p>
                              {submission.submitted_file && <a href={mediaUrl(submission.submitted_file)} download className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"><Download className="h-3.5 w-3.5" /> Tải bài làm về</a>}
                              {isQuiz && <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><Award className="h-3.5 w-3.5" /> Điểm tự động: {submission.score ?? '—'} / 10</p>}
                            </div>
                            {isQuiz ? (
                              <div className="lg:col-span-3 text-sm text-slate-600">{submission.feedback || 'Đã chấm tự động bởi hệ thống.'}</div>
                            ) : (
                              <>
                                <label className="text-xs font-semibold text-slate-600">
                                  Điểm (0–10)
                                  <input type="number" min="0" max="10" step="0.1" value={grade.score} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, score: event.target.value } }))} className="mt-1 block w-full border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                  Phản hồi
                                  <textarea rows={2} value={grade.feedback} onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, feedback: event.target.value } }))} className="mt-1 block w-full resize-y border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
                                </label>
                                <button type="button" disabled={savingId === submission.id || grade.score === ''} onClick={() => saveGrade(assignment.id, submission)} title="Lưu điểm và phản hồi" aria-label="Lưu điểm và phản hồi" className="inline-flex items-center justify-center bg-emerald-800 p-2.5 text-white hover:bg-emerald-900 disabled:opacity-50"><Save className="h-4 w-4" /></button>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
};

export default InstructorAssignments;