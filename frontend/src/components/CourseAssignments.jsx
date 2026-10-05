import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileUp, FileText } from 'lucide-react';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';

const CourseAssignments = ({ courseId, isEnrolled }) => {
  const { isAuthenticated, isLearner } = useAuth();
  const [tests, setTests] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const load = async () => {
      try {
        const testList = await courseApi.getCourseTests(courseId);
        setTests(Array.isArray(testList) ? testList : testList.results || []);
        if (isEnrolled && isLearner) {
          const fileTests = testList.filter((test) => test.test_type === 'file');
          const resultSets = await Promise.all(fileTests.map((test) => courseApi.getTestSubmissions(test.id)));
          setSubmissions(Object.fromEntries(fileTests.map((test, index) => [
            test.id,
            Array.isArray(resultSets[index]) ? resultSets[index] : resultSets[index].results || [],
          ])));
        }
      } catch {
        toast.error('Không thể tải bài tập của khóa học.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId, isAuthenticated, isEnrolled, isLearner]);

  const submitFile = async (test, file) => {
    if (!file) return;
    setUploadingId(test.id);
    try {
      const submission = await courseApi.submitTestFile(test.id, file);
      setSubmissions((current) => ({ ...current, [test.id]: [submission, ...(current[test.id] || [])] }));
      toast.success('Đã nộp bài tập.');
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.submitted_file?.[0] || 'Nộp bài thất bại.');
    } finally {
      setUploadingId(null);
    }
  };

  if (!isAuthenticated || loading || tests.length === 0) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-emerald-700">Đánh giá</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Bài tập khóa học</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {tests.map((test) => {
          const submissionsForTest = submissions[test.id] || [];
          const latest = submissionsForTest[0];
          return (
            <li key={test.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{test.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{test.test_type === 'file' ? 'Nộp tệp' : 'Trắc nghiệm'}</p>
                </div>
                {isLearner && isEnrolled && test.test_type === 'file' && (
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
                    <FileUp className="h-4 w-4" />
                    {uploadingId === test.id ? 'Đang tải...' : 'Chọn tệp'}
                    <input
                      type="file"
                      className="sr-only"
                      disabled={uploadingId === test.id}
                      onChange={(event) => submitFile(test, event.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
              {latest && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <a
                    href={latest.submitted_file?.startsWith('http') ? latest.submitted_file : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${latest.submitted_file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:underline"
                  >
                    <FileText className="h-4 w-4" /> Tệp đã nộp
                  </a>
                  <p className="mt-2 text-slate-700">Điểm: {latest.score ?? 'Chưa chấm'}</p>
                  {latest.feedback && <p className="mt-1 text-slate-600">Phản hồi: {latest.feedback}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default CourseAssignments;