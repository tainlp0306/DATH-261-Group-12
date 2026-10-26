import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Award, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { courseApi } from '../api/courseApi';

const emptyQuestion = () => ({
  content: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A',
});

const vnLocalDateTime = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

const vnLocalToIso = (value) => (value ? `${value}:00+07:00` : null);
const mediaUrl = (path) => path?.startsWith('http')
  ? path
  : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${path || ''}`;

const InstructorAssignments = ({ courseId, modules = [] }) => {
  const [assignments, setAssignments] = useState([]);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [assignmentType, setAssignmentType] = useState('quiz');
  const [timeLimit, setTimeLimit] = useState(15);
  const [deadline, setDeadline] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [promptFile, setPromptFile] = useState(null);
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    courseApi.getCourseAssignments(courseId)
      .then((response) => {
        if (active) setAssignments(Array.isArray(response) ? response : response?.results || []);
      })
      .catch((error) => {
        console.error('Failed to load course assignments:', error);
        toast.error('Không thể tải danh sách bài tập.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const resetForm = () => {
    setEditingAssignment(null);
    setTitle('');
    setDescription('');
    setModuleId('');
    setDeadline('');
    setPublishAt('');
    setPromptFile(null);
    setNotifyStudents(true);
    setTimeLimit(15);
    setAssignmentType('quiz');
    setQuestions([emptyQuestion()]);
  };

  const editAssignment = async (assignment) => {
    try {
      const detail = await courseApi.getAssignmentDetail(assignment.id);
      setEditingAssignment(detail);
      setTitle(detail.title || '');
      setDescription(detail.description || '');
      setModuleId(detail.module ? String(detail.module) : '');
      setAssignmentType(detail.assignment_type);
      setTimeLimit(detail.time_limit_minutes || 15);
      setDeadline(detail.deadline ? vnLocalDateTime(new Date(detail.deadline)) : '');
      setPublishAt(detail.publish_at ? vnLocalDateTime(new Date(detail.publish_at)) : '');
      setPromptFile(null);
      setNotifyStudents(true);
      setQuestions(detail.questions?.length ? detail.questions.map((question) => ({
        ...question,
        attachment_file: null,
      })) : [emptyQuestion()]);
      document.getElementById('assignment-editor')?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Failed to load assignment for editing:', error);
      toast.error(error.response?.data?.detail || 'Không thể tải bài tập để chỉnh sửa.');
    }
  };

  const saveAssignment = async (event) => {
    event.preventDefault();
    const action = event.nativeEvent.submitter?.value || 'publish';
    if (action === 'schedule' && !publishAt) {
      toast.error('Vui lòng chọn thời điểm xuất bản theo giờ Việt Nam.');
      return;
    }
    if (action === 'schedule' && new Date(vnLocalToIso(publishAt)).getTime() <= Date.now()) {
      toast.error('Thời điểm xuất bản phải nằm trong tương lai theo giờ Việt Nam.');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        assignment_type: assignmentType,
        module: moduleId ? Number(moduleId) : null,
        deadline: vnLocalToIso(deadline),
        is_published: action !== 'draft',
        publish_at: action === 'schedule' ? vnLocalToIso(publishAt) : null,
        notify_students: notifyStudents,
        ...(promptFile ? { prompt_file: promptFile } : {}),
        questions: assignmentType === 'quiz' ? questions.map((question) => {
          const questionData = { ...question };
          delete questionData.attachment_file;
          delete questionData.attachment;
          questionData.content = question.content.trim();
          return questionData;
        }) : [],
        ...(assignmentType === 'quiz' ? {
          time_limit_minutes: Number(timeLimit),
        } : {}),
      };
      const saved = editingAssignment
        ? await courseApi.updateCourseAssignment(editingAssignment.id, payload)
        : await courseApi.createCourseAssignment(courseId, payload);
      setAssignments((current) => (
        editingAssignment
          ? current.map((assignment) => assignment.id === saved.id ? saved : assignment)
          : [...current, saved]
      ));
      try {
        for (const [index, question] of (saved.questions || []).entries()) {
          const file = questions[index]?.attachment_file;
          if (file) await courseApi.uploadQuestionAttachment(question.id, file);
        }
      } catch (error) {
        console.error('Assignment saved but question attachment upload failed:', error);
        setEditingAssignment(saved);
        toast.error('Bài tập đã lưu nhưng tải tệp câu hỏi thất bại. Hãy thử lưu lại để tải tệp.');
        return;
      }
      toast.success(action === 'draft' ? 'Đã lưu bài tập ở trạng thái nháp.' : action === 'schedule' ? 'Đã lên lịch xuất bản bài tập.' : editingAssignment ? 'Đã cập nhật bài tập.' : 'Đã xuất bản bài tập.');
      resetForm();
    } catch (error) {
      console.error('Failed to save assignment:', error);
      const detail = error.response?.data?.questions?.[0]
        || error.response?.data?.module?.[0]
        || error.response?.data?.detail
        || error.response?.data?.error
        || 'Không thể lưu bài tập.';
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

  return (
    <section className="space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Đánh giá khóa học</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Bài tập & chấm điểm</h2>
        <p className="mt-1 text-sm text-slate-600">Gắn bài tập vào chương; kết quả và thao tác chấm được mở trên một trang riêng.</p>
      </header>

      <form id="assignment-editor" onSubmit={saveAssignment} className="space-y-4 border-y border-slate-200 py-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Tên bài tập
            <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Kiểm tra chương 1" className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Chương
            <select value={moduleId} onChange={(event) => setModuleId(event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Chọn chương (không bắt buộc)</option>
              {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Loại bài tập
            <select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="quiz">Trắc nghiệm</option><option value="file">Nộp tệp</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Hạn nộp
            <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm" />
            <span className="mt-1 block text-[11px] font-normal text-slate-500">Giờ Việt Nam (UTC+7)</span>
          </label>
          <label className="text-xs font-semibold text-slate-700 md:col-span-2">Mô tả
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Hướng dẫn làm bài hoặc yêu cầu nộp bài" className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>
          {assignmentType === 'quiz' && <label className="text-xs font-semibold text-slate-700">Thời gian làm bài (phút)
            <input type="number" required min="1" max="600" value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">Tạo hạn nộp nhanh (tính từ hiện tại)</p>
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20, 30].map((minutes) => (
              <button key={minutes} type="button" onClick={() => setDeadline(vnLocalDateTime(new Date(Date.now() + minutes * 60 * 1000)))} className="border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">{minutes} phút</button>
            ))}
            <button type="button" onClick={() => setDeadline('')} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900">Xóa hạn</button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Tệp đề bài (tối đa 25 MB)
            <input type="file" onChange={(event) => {
              const selected = event.target.files?.[0] || null;
              if (selected && selected.size > 25 * 1024 * 1024) {
                toast.error('Tệp đề bài không được vượt quá 25 MB.');
                event.target.value = '';
                return;
              }
              setPromptFile(selected);
            }} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-xs" />
            {editingAssignment?.prompt_file && <a href={mediaUrl(editingAssignment.prompt_file)} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-emerald-800 underline">Xem tệp đề bài hiện tại</a>}
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={notifyStudents} onChange={(event) => setNotifyStudents(event.target.checked)} />
              Gửi thông báo cho học viên (mặc định bật)
            </label>
            <label className="block text-xs font-semibold text-slate-700">Lên lịch xuất bản (giờ Việt Nam)
              <input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
        </div>
        {assignmentType === 'quiz' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-emerald-800" /> Câu hỏi</h3>
              <button type="button" onClick={() => setQuestions((current) => [...current, emptyQuestion()])} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><Plus className="h-4 w-4" /> Thêm câu hỏi</button>
            </div>
            {questions.map((question, index) => (
              <fieldset key={index} className="space-y-3 border-l-2 border-emerald-700 pl-4">
                <div className="flex items-center justify-between"><legend className="text-xs font-bold">Câu {index + 1}</legend>
                  {questions.length > 1 && <button type="button" aria-label={`Xóa câu ${index + 1}`} onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="p-1 text-rose-700"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <label className="block text-xs font-semibold">Nội dung câu hỏi
                  <textarea required value={question.content} onChange={(event) => updateQuestion(index, 'content', event.target.value)} rows={2} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs font-semibold">Tệp hoặc hình ảnh minh họa
                  <input type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt" onChange={(event) => {
                    const selected = event.target.files?.[0] || null;
                    if (selected && selected.size > 20 * 1024 * 1024) {
                      toast.error('Tệp đính kèm câu hỏi không được vượt quá 20 MB.');
                      event.target.value = '';
                      return;
                    }
                    updateQuestion(index, 'attachment_file', selected);
                  }} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-xs" />
                  {question.attachment && <a href={mediaUrl(question.attachment)} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-emerald-800 underline">Mở tệp hiện tại</a>}
                  {question.attachment_file && <span className="mt-1 block text-xs text-slate-500">{question.attachment_file.name}</span>}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['a', 'b', 'c', 'd'].map((letter) => <label key={letter} className="text-xs font-semibold">Đáp án {letter.toUpperCase()}
                    <input required value={question[`option_${letter}`]} onChange={(event) => updateQuestion(index, `option_${letter}`, event.target.value)} className="mt-1 block w-full border border-slate-300 px-3 py-2 text-sm" />
                  </label>)}
                </div>
                <label className="block max-w-xs text-xs font-semibold">Đáp án đúng
                  <select value={question.correct_option} onChange={(event) => updateQuestion(index, 'correct_option', event.target.value)} className="mt-1 block w-full border border-slate-300 bg-white px-3 py-2 text-sm">{['A', 'B', 'C', 'D'].map((option) => <option key={option}>{option}</option>)}</select>
                </label>
              </fieldset>
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          {editingAssignment && <button type="button" onClick={resetForm} disabled={creating} className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Hủy chỉnh sửa</button>}
          <button type="submit" value="draft" disabled={creating} className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{creating ? 'Đang lưu…' : 'Lưu nháp'}</button>
          <button type="submit" value="schedule" disabled={creating} className="border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50">Lên lịch</button>
          <button type="submit" value="publish" disabled={creating} className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> {creating ? 'Đang lưu...' : editingAssignment ? 'Lưu & xuất bản' : 'Xuất bản ngay'}</button>
        </div>
      </form>

      <section aria-labelledby="assignment-list-heading">
        <h3 id="assignment-list-heading" className="border-b border-slate-200 pb-3 text-base font-semibold text-slate-950">Danh sách bài tập</h3>
        {loading ? <p className="py-8 text-sm text-slate-500">Đang tải bài tập...</p> : assignments.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Chưa có bài tập trong khóa học.</p>
        ) : <ul className="divide-y divide-slate-200">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3"><Award className="h-4 w-4 text-amber-700" /><div>
                <p className="font-semibold text-slate-900">{assignment.title}</p>
                <p className="mt-1 text-xs text-slate-500">{modules.find((module) => module.id === assignment.module)?.title || 'Chưa gắn chương'} · {assignment.assignment_type === 'quiz' ? 'Trắc nghiệm' : 'Nộp tệp'} · {!assignment.is_published ? 'Nháp' : assignment.publish_at && new Date(assignment.publish_at).getTime() > currentTime ? `Lên lịch ${new Date(assignment.publish_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Đã xuất bản'}</p>
              </div></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => editAssignment(assignment)} className="border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Chỉnh sửa</button>
                <Link to={`/instructor/courses/${courseId}/assignments/${assignment.id}`} className="border border-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">Xem bài nộp & chấm điểm</Link>
              </div>
            </li>
          ))}
        </ul>}
      </section>
    </section>
  );
};

export default InstructorAssignments;
