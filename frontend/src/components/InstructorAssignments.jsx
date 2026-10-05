import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileUp, Save } from 'lucide-react';
import { courseApi } from '../api/courseApi';

const InstructorAssignments = ({ courseId }) => {
  const [tests, setTests] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [grades, setGrades] = useState({});

  useEffect(() => {
    let active = true;
    courseApi.getCourseTests(courseId)
      .then(async (data) => {
        const testList = Array.isArray(data) ? data : data.results || [];
        const fileTests = testList.filter((test) => test.test_type === 'file');
        const groups = await Promise.all(fileTests.map((test) => courseApi.getTestSubmissions(test.id)));
        const allSubmissions = groups.flatMap((group) => Array.isArray(group) ? group : group.results || []);
        if (!active) return;
        setTests(testList);
        setSubmissions(allSubmissions);
        setGrades(Object.fromEntries(allSubmissions.map((submission) => [submission.id, {
          score: submission.score ?? '',
          feedback: submission.feedback || '',
        }])));
      })
      .catch(() => toast.error('Không thể tải bài tập và bài nộp.'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  const createAssignment = async (event) => {
    event.preventDefault();
    try {
      const created = await courseApi.createCourseTest(courseId, {
        title: title.trim(),
        test_type: 'file',
      });
      setTests((current) => [...current, created]);
      setTitle('');
      toast.success('Đã tạo bài tập nộp tệp.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể tạo bài tập.');
    }
  };

  const saveGrade = async (submission) => {
    const grade = grades[submission.id] || {};
    setSavingId(submission.id);
    try {
      const updated = await courseApi.gradeSubmission(submission.id, {
        score: grade.score === '' ? null : Number(grade.score),
        feedback: grade.feedback || '',
      });
      setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success('Đã lưu điểm và phản hồi.');
    } catch (error) {
      toast.error(error.response?.data?.score?.[0] || error.response?.data?.error || 'Không thể lưu điểm.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-bold text-slate-900">Bài tập nộp tệp</h2>
        <p className="mt-1 text-sm text-slate-500">Tạo bài tập và chấm điểm các tệp học viên gửi.</p>
      </div>
      <form onSubmit={createAssignment} className="flex flex-col sm:flex-row gap-2">
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Tên bài tập"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
        <button className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
          Tạo bài tập
        </button>
      </form>
      {loading ? <p className="py-6 text-sm text-slate-500">Đang tải...</p> : (
        <div className="space-y-6">
          {tests.filter((test) => test.test_type === 'file').length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Chưa có bài tập nộp tệp.</p>
          ) : tests.filter((test) => test.test_type === 'file').map((test) => {
            const testSubmissions = submissions.filter((submission) => submission.test === test.id);
            return (
              <section key={test.id} className="border-t border-slate-200 pt-5">
                <h3 className="font-bold text-slate-900">{test.title}</h3>
                {testSubmissions.length === 0 ? <p className="mt-2 text-sm text-slate-500">Chưa có bài nộp.</p> : (
                  <ul className="mt-3 divide-y divide-slate-200">
                    {testSubmissions.map((submission) => {
                      const grade = grades[submission.id] || { score: '', feedback: '' };
                      const fileUrl = submission.submitted_file?.startsWith('http')
                        ? submission.submitted_file
                        : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${submission.submitted_file}`;
                      return (
                        <li key={submission.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(10rem,1fr)_7rem_minmax(12rem,2fr)_auto] lg:items-end">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{submission.student_username}</p>
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
                              <FileUp className="h-3.5 w-3.5" /> Mở tệp đã nộp
                            </a>
                          </div>
                          <label className="text-xs font-semibold text-slate-600">
                            Điểm
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={grade.score}
                              onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, score: event.target.value } }))}
                              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Phản hồi
                            <textarea
                              rows={2}
                              value={grade.feedback}
                              onChange={(event) => setGrades((current) => ({ ...current, [submission.id]: { ...grade, feedback: event.target.value } }))}
                              className="mt-1 block w-full resize-y rounded-md border border-slate-300 px-2 py-2 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={savingId === submission.id || grade.score === ''}
                            onClick={() => saveGrade(submission)}
                            title="Lưu chấm điểm"
                            aria-label="Lưu chấm điểm"
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-700 p-2.5 text-white hover:bg-emerald-800 disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                          </button>
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
  );
};

export default InstructorAssignments;