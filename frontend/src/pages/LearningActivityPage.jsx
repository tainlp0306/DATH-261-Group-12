import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Eraser, Send } from 'lucide-react';
import { courseApi } from '../api/courseApi';
import LoadingSpinner from '../components/LoadingSpinner';

const ActivityWritingPad = ({ onChange, disabled }) => {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);

  const pointFromEvent = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    ];
  };

  const drawStroke = (points) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const context = canvas.getContext('2d');
    context.strokeStyle = '#0f172a';
    context.lineWidth = Math.max(canvas.width / 38, 4);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(points[0][0] * canvas.width, points[0][1] * canvas.height);
    points.slice(1).forEach(([x, y]) => context.lineTo(x * canvas.width, y * canvas.height));
    context.stroke();
  };

  const redraw = (strokes) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(drawStroke);
  };

  const startStroke = (event) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    currentStrokeRef.current = [pointFromEvent(event)];
  };

  const continueStroke = (event) => {
    if (!currentStrokeRef.current) return;
    event.preventDefault();
    currentStrokeRef.current.push(pointFromEvent(event));
    redraw([...strokesRef.current, currentStrokeRef.current]);
  };

  const finishStroke = () => {
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!stroke || stroke.length < 2) return;
    strokesRef.current = [...strokesRef.current, stroke];
    onChange(strokesRef.current);
  };

  const clear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    redraw([]);
    onChange([]);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={360}
        height={240}
        aria-label="Bảng luyện viết"
        className="mx-auto block w-full max-w-sm touch-none rounded-xl border border-dashed border-slate-400 bg-white"
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Kéo chuột hoặc ngón tay để viết.</span>
        <button type="button" disabled={disabled} onClick={clear} className="inline-flex items-center gap-1 font-semibold text-slate-700 disabled:opacity-40">
          <Eraser className="h-3.5 w-3.5" /> Xóa nét
        </button>
      </div>
    </div>
  );
};

export default function LearningActivityPage() {
  const { id: courseId, activityId } = useParams();
  const [course, setCourse] = useState(null);
  const [activity, setActivity] = useState(null);
  const [answers, setAnswers] = useState({});
  const [strokes, setStrokes] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      courseApi.getCourseDetail(courseId),
      courseApi.getLearningActivity(activityId),
    ]).then(([courseData, activityData]) => {
      if (!active) return;
      if (Number(activityData.course) !== Number(courseId)) {
        throw new Error('Bài luyện ngắn không thuộc khóa học này.');
      }
      setCourse(courseData);
      setActivity(activityData);
    }).catch((error) => {
      if (!active) return;
      console.error('Failed to load short activity:', error);
      toast.error(error.response?.data?.detail || error.message || 'Không thể tải bài luyện ngắn.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [courseId, activityId]);

  const setAnswer = (itemId, value) => {
    setAnswers((current) => ({ ...current, [itemId]: value }));
  };

  const canSubmit = activity?.items?.every((item) => (
    activity.activity_type === 'writing'
      ? (strokes[item.id] || []).length > 0
      : Boolean((answers[item.id] || '').trim())
  ));

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || submitting || result) return;
    setSubmitting(true);
    try {
      const responses = activity.items.map((item) => (
        activity.activity_type === 'writing'
          ? { item_id: item.id, strokes: strokes[item.id] }
          : { item_id: item.id, answer: answers[item.id] || '' }
      ));
      setResult(await courseApi.submitLearningActivity(activity.id, responses));
      toast.success(activity.activity_type === 'writing' ? 'Đã lưu lượt luyện viết.' : 'Đã hoàn thành và chấm hoạt động.');
    } catch (error) {
      console.error('Failed to submit short activity:', error);
      toast.error(error.response?.data?.detail || error.response?.data?.responses?.[0] || 'Không thể nộp bài luyện.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20"><LoadingSpinner size="large" text="Đang tải bài luyện ngắn..." /></div>;
  if (!activity || !course) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center"><p className="text-slate-700">Không thể mở hoạt động này.</p><Link to={`/courses/${courseId}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Quay lại khóa học</Link></main>;
  }

  const answerById = Object.fromEntries((result?.results || []).map((item) => [item.item_id, item]));
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link to={`/courses/${courseId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" /> {course.title}</Link>
      <header className="border-b border-slate-200 py-5">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Bài học ngắn</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{activity.title}</h1>
        {activity.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{activity.description}</p>}
      </header>

      <form onSubmit={submit} className="space-y-4 py-5">
        {activity.items.map((item, index) => {
          const itemResult = answerById[item.id];
          return (
            <section key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nội dung {index + 1}</p>
              <h2 className="mt-2 whitespace-pre-line font-semibold text-slate-900">{item.prompt}</h2>
              {activity.activity_type === 'quiz' ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-2">
                    {(item.options || []).map((option) => (
                      <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm ${answers[item.id] === option ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <input type="radio" name={`item-${item.id}`} value={option} checked={answers[item.id] === option} disabled={Boolean(result)} onChange={() => setAnswer(item.id, option)} />
                        <span>{option}</span>
                        {itemResult?.target === option && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-700" />}
                      </label>
                    ))}
                  </div>
                  {itemResult && <p className={`text-sm font-semibold ${itemResult.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>{itemResult.is_correct ? 'Chính xác.' : `Chưa đúng. Đáp án: ${itemResult.target}`}</p>}
                </div>
              ) : activity.activity_type === 'vocabulary' ? (
                <div className="mt-4 space-y-3">
                  <input value={answers[item.id] || ''} disabled={Boolean(result)} onChange={(event) => setAnswer(item.id, event.target.value)} aria-label={`Đáp án nội dung ${index + 1}`} className="w-full rounded-lg border border-slate-300 px-3 py-3 text-lg" placeholder="Nhập câu trả lời" />
                  {itemResult && <p className={`text-sm font-semibold ${itemResult.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>{itemResult.is_correct ? 'Chính xác.' : `Chưa đúng. Đáp án: ${itemResult.target}`}</p>}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <p lang="ja" className="text-center text-6xl font-medium text-indigo-900">{item.target}</p>
                  <ActivityWritingPad
                    disabled={Boolean(result)}
                    onChange={(value) => setStrokes((current) => ({ ...current, [item.id]: value }))}
                  />
                  {itemResult && <p className="text-center text-sm text-indigo-800">Đã lưu {itemResult.strokes.length} nét luyện tập. Đây là hoạt động thực hành, chưa có nhận diện/chấm tự động nét chữ.</p>}
                </div>
              )}
            </section>
          );
        })}
        {result && activity.activity_type !== 'writing' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="font-semibold text-emerald-900">Kết quả: {result.score}/10</p>
            <p className="mt-1 text-sm text-emerald-800">Đã trả lời đúng {result.correct_count} trên {result.total_items} nội dung.</p>
          </div>
        )}
        {result && activity.activity_type === 'writing' && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center text-sm text-indigo-900">
            Lượt luyện viết đã được lưu. Ký tự mẫu vẫn hiển thị để bạn tự đối chiếu; hệ thống không tự chấm hình dạng nét.
          </div>
        )}
        {!result && (
          <button type="submit" disabled={!canSubmit || submitting} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" /> {submitting ? 'Đang lưu…' : activity.activity_type === 'writing' ? 'Lưu lượt luyện viết' : 'Nộp và xem kết quả'}
          </button>
        )}
      </form>
    </main>
  );
}
