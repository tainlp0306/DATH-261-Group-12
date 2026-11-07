import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Award, CheckCircle2, XCircle } from 'lucide-react';
import { courseApi } from '../api/courseApi';

const AssignmentReviewPage = () => {
  const { id: courseId, assignmentId, submissionId } = useParams();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    courseApi.getAssignmentReview(assignmentId, submissionId)
      .then((data) => { if (active) setReview(data); })
      .catch((error) => {
        if (active) toast.error(error.response?.data?.error || 'Không thể tải bài làm để xem lại.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assignmentId, submissionId]);

  if (loading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Đang tải bài làm...</main>;
  }
  if (!review) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-600">Bài làm hiện chưa được phép xem lại.</main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to={`/courses/${courseId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800">
        <ArrowLeft className="h-4 w-4" /> Quay lại khóa học
      </Link>
      <header className="mt-5 border-b border-slate-300 pb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Xem lại bài làm · Lượt {review.attempt_number}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{review.assignment_title}</h1>
        <p className="mt-2 text-xs text-slate-500">Đã nộp: {new Date(review.submitted_at).toLocaleString('vi-VN')}</p>
        {review.score != null && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <Award className="h-4 w-4" /> Điểm: {review.score} / 10
          </p>
        )}
      </header>
      <ol className="divide-y divide-slate-200">
        {review.questions.map((question, index) => {
          const options = ['A', 'B', 'C', 'D'].map((key) => ({
            key,
            text: question[`option_${key.toLowerCase()}`],
          }));
          return (
            <li key={question.id} className="py-5">
              <h2 className="font-semibold text-slate-900">{index + 1}. {question.content}</h2>
              <ul className="mt-3 space-y-2">
                {options.map((option) => {
                  const selected = question.selected_option === option.key;
                  const correct = question.correct_option === option.key;
                  const selectedIncorrect = selected && question.correct_option && !correct;
                  return (
                    <li key={option.key} className={`flex items-center gap-2 border px-3 py-2 text-sm ${
                      correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : selectedIncorrect ? 'border-rose-300 bg-rose-50 text-rose-900'
                          : 'border-slate-200 text-slate-700'
                    }`}>
                      {correct ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : selectedIncorrect ? <XCircle className="h-4 w-4 shrink-0" /> : <span className="w-4" />}
                      <span>{option.key}. {option.text}</span>
                      {selected && <span className="ml-auto text-xs font-semibold">Bạn chọn</span>}
                    </li>
                  );
                })}
              </ul>
              {question.explanation && <p className="mt-3 border-l-2 border-indigo-400 pl-3 text-sm text-slate-700">{question.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </main>
  );
};

export default AssignmentReviewPage;
