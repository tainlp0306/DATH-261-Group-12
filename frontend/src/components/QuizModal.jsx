import React, { useState, useEffect, useEffectEvent, useRef } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  Award, 
  RefreshCw, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { courseApi } from '../api/courseApi';

const QuizModal = ({ quiz, onClose, onCompleted }) => {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const answersRef = useRef(answers);
  const submittingRef = useRef(false);
  
  // Timer in seconds
  const initialSeconds = (quiz.time_limit_minutes || 15) * 60;
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const timerRef = useRef(null);

  const submitQuizAnswers = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    clearInterval(timerRef.current);
    try {
      setSubmitting(true);
      const res = await courseApi.submitQuiz(quiz.id, answersRef.current);
      setResult(res);
      toast.success('Đã chấm điểm xong!');
      if (onCompleted) {
        onCompleted(res);
      }
    } catch (err) {
      console.error('Quiz submit error:', err);
      toast.error(err.response?.data?.error || 'Nộp bài thất bại. Vui lòng thử lại!');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const submitOnTimeout = useEffectEvent(() => {
    if (submittingRef.current) return;
    clearInterval(timerRef.current);
    toast('Đã hết thời gian làm bài! Đang tự động nộp bài...', { icon: '⏰' });
    submitQuizAnswers();
  });

  useEffect(() => {
    if (result) return; // Stop timer if submitted

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitOnTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [result]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId, optionLetter) => {
    if (result) return;
    const nextAnswers = { ...answersRef.current, [questionId.toString()]: optionLetter };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
  };

  const handleSubmit = async () => {
    const questions = quiz.questions || [];
    const answeredCount = Object.keys(answers).length;

    if (answeredCount < questions.length) {
      const confirmSubmit = window.confirm(
        `Bạn mới trả lời ${answeredCount}/${questions.length} câu hỏi. Bạn có chắc chắn muốn nộp bài ngay không?`
      );
      if (!confirmSubmit) return;
    }

    submitQuizAnswers();
  };

  const handleRetry = () => {
    setResult(null);
    answersRef.current = {};
    setAnswers({});
    setTimeLeft(initialSeconds);
  };

  const questions = quiz.questions || [];
  const answeredCount = Object.keys(answers).length;
  const isTimeCritical = timeLeft < 120; // less than 2 mins

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Bài kiểm tra trắc nghiệm
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white line-clamp-1">
              {quiz.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer Badge */}
            {!result && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider ${
                  isTimeCritical
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* Result View */}
          {result ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200">
                <Award className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  {result.score >= 5.0 ? '🎉 Chúc mừng bạn đã hoàn thành!' : '💪 Hãy cố gắng hơn ở lần sau!'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Kết quả bài kiểm tra tự động của hệ thống LingoSphere
                </p>
              </div>

              {/* Score Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                  <span className="text-xs text-indigo-600 font-semibold block">Điểm số</span>
                  <span className="text-2xl font-black text-indigo-700">{result.score} / 10</span>
                </div>

                <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                  <span className="text-xs text-emerald-600 font-semibold block">Số câu đúng</span>
                  <span className="text-2xl font-black text-emerald-700">
                    {result.correct_count ?? 0} / {result.total_questions ?? questions.length}
                  </span>
                </div>

                <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl col-span-2 sm:col-span-1">
                  <span className="text-xs text-purple-600 font-semibold block">Đánh giá</span>
                  <span className="text-sm font-bold text-purple-700">
                    {result.score >= 8.0 ? 'Xuất sắc' : result.score >= 5.0 ? 'Đạt yêu cầu' : 'Chưa đạt'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> Làm lại bài
                </button>
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span>Hoàn tất & Đóng</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Questions List */
            <div className="space-y-6">
              {/* Progress info */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span>
                  Đã trả lời: <strong className="text-indigo-600 font-bold">{answeredCount}</strong> / {questions.length} câu
                </span>
                <span className="text-slate-400">
                  Thời lượng: {quiz.time_limit_minutes || 15} phút
                </span>
              </div>

              {questions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                  <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  Bài kiểm tra này hiện chưa có câu hỏi nào.
                </div>
              ) : (
                questions.map((q, idx) => {
                  const selectedOption = answers[q.id.toString()];

                  const options = [
                    { key: 'A', text: q.option_a },
                    { key: 'B', text: q.option_b },
                    { key: 'C', text: q.option_c },
                    { key: 'D', text: q.option_d },
                  ];

                  return (
                    <div
                      key={q.id}
                      className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100">
                          {idx + 1}
                        </span>
                        <p className="text-sm font-bold text-slate-800 leading-relaxed">
                          {q.content}
                        </p>
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-10">
                        {options.map((opt) => {
                          const isSelected = selectedOption === opt.key;

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => handleSelectOption(q.id, opt.key)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold ring-1 ring-indigo-500 shadow-2xs'
                                  : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                              }`}
                            >
                              <span
                                className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white border border-slate-300 text-slate-600'
                                }`}
                              >
                                {opt.key}
                              </span>
                              <span className="line-clamp-2">{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!result && questions.length > 0 && (
          <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500">
              {answeredCount === questions.length ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Đã trả lời hết tất cả câu hỏi
                </span>
              ) : (
                <span>Còn {questions.length - answeredCount} câu chưa trả lời</span>
              )}
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Nộp bài & Chấm điểm</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizModal;
