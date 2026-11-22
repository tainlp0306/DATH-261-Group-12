import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { courseApi } from '../api/courseApi';

const HANZI_SRC = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';

function loadHanziWriter() {
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hanzi-writer]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.HanziWriter));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = HANZI_SRC;
    script.dataset.hanziWriter = 'true';
    script.onload = () => resolve(window.HanziWriter);
    script.onerror = () => reject(new Error('Không tải được Hanzi Writer.'));
    document.body.appendChild(script);
  });
}

export default function PracticePage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [items, setItems] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inked, setInked] = useState(false);
  const writerHost = useRef(null);
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const current = items.find((item) => item.id === currentId) || items[0] || null;

  useEffect(() => {
    let active = true;
    Promise.all([
      courseApi.getCourseDetail(id),
      courseApi.getCourseVocabulary(id),
      courseApi.getNextPracticeItem(id),
    ]).then(([courseData, vocabulary, next]) => {
      if (!active) return;
      setCourse(courseData);
      const list = Array.isArray(vocabulary) ? vocabulary : vocabulary.results || [];
      setItems(list);
      setCurrentId(next.item?.id ?? list[0]?.id ?? null);
    }).catch(() => toast.error('Không mở được phần luyện tập.'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    setAnswer('');
    setResult(null);
    setInked(false);
  }, [current?.id]);

  useEffect(() => {
    if (current?.kind !== 'stroke' || !writerHost.current) return undefined;
    let cancelled = false;
    writerHost.current.innerHTML = '';
    loadHanziWriter().then((HanziWriter) => {
      if (cancelled || !writerHost.current) return;
      HanziWriter.create(writerHost.current, current.word, {
        width: 220,
        height: 220,
        padding: 8,
        showOutline: true,
        showCharacter: false,
        onLoadCharDataError: () => {
          if (!cancelled) writerHost.current.dataset.fallback = 'true';
        },
      });
    }).catch(() => toast.error('Không tải được thư viện vẽ nét.'));
    return () => { cancelled = true; };
  }, [current]);

  const submit = async (value) => {
    if (!current) return;
    try {
      setSubmitting(true);
      const response = await courseApi.submitPractice(current.id, value);
      setResult(response);
    } catch (error) {
      const message = error.response?.data?.detail || error.response?.data?.answer?.[0] || 'Không nộp được bài luyện.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const startQuiz = async () => {
    if (!current || !window.HanziWriter || !writerHost.current) return;
    writerHost.current.innerHTML = '';
    const writer = window.HanziWriter.create(writerHost.current, current.word, {
      width: 220,
      height: 220,
      padding: 8,
      showOutline: true,
      showCharacter: false,
    });
    writer.quiz({
      onComplete: () => submit(current.word),
    });
  };

  const onPointerDown = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    context.strokeStyle = '#1e293b';
    context.lineWidth = 8;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  };

  const onPointerMove = (event) => {
    if (!drawing.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const context = canvasRef.current.getContext('2d');
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
    setInked(true);
  };

  if (loading) return <p className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">Đang tải phần luyện tập...</p>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Luyện tập chủ động</p>
          <h1 className="text-2xl font-black text-slate-900">{course?.title || 'Luyện tập'}</h1>
        </div>
        <Link to={`/courses/${id}`} className="text-sm font-semibold text-indigo-700">Về khóa học</Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">Chưa có mục luyện tập trong khóa này.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="practice-item"
                  data-word={item.word || item.prompt}
                  onClick={() => setCurrentId(item.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${current?.id === item.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                >
                  {item.kind === 'theory' || item.kind === 'choice' ? item.prompt : item.word}
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <p data-testid="practice-target" className={`text-center font-bold text-slate-900 ${current.kind === 'theory' || current.kind === 'choice' ? 'text-xl' : 'text-4xl'}`}>
                {current.kind === 'theory' || current.kind === 'choice' ? current.prompt : current.word}
              </p>
              {current.kind === 'typing' && (
                <p className="mt-2 text-center text-sm text-slate-500">
                  {current.romaji ? `Romaji: ${current.romaji}` : 'Không giới hạn số lần luyện.'}
                  {current.meaning ? ` · ${current.meaning}` : ''}
                </p>
              )}

              {current.kind === 'stroke' ? (
                <div className="mt-6 space-y-4">
                  <div ref={writerHost} data-testid="stroke-writer" className="mx-auto h-[220px] w-[220px] border border-slate-200" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={startQuiz} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Tập viết theo nét</button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    data-testid="stroke-canvas"
                    width={280}
                    height={180}
                    className="w-full touch-none rounded-xl border border-dashed border-slate-300 bg-slate-50"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={() => { drawing.current = false; }}
                    onPointerLeave={() => { drawing.current = false; }}
                  />
                  <button
                    type="button"
                    data-testid="stroke-submit"
                    disabled={!inked || submitting}
                    onClick={() => submit(current.word)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Nộp
                  </button>
                </div>
              ) : current.kind === 'choice' ? (
                <form
                  className="mt-6 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit(answer);
                  }}
                >
                  <div className="space-y-2">
                    {(current.options || []).map((option) => (
                      <label key={option} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                        <input
                          type="radio"
                          name="practice-choice"
                          value={option}
                          checked={answer === option}
                          onChange={() => setAnswer(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    data-testid="practice-submit"
                    disabled={submitting || !answer}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Nộp
                  </button>
                </form>
              ) : (
                <form
                  className="mt-6 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit(answer);
                  }}
                >
                  <input
                    data-testid="practice-answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder={current.kind === 'theory' ? 'Nhập câu trả lời ngắn' : 'Gõ chữ, câu, hoặc romaji'}
                    className="w-full rounded-xl border border-slate-300 px-3 py-3 text-lg"
                  />
                  <button
                    type="submit"
                    data-testid="practice-submit"
                    disabled={submitting}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Nộp
                  </button>
                </form>
              )}

              {result && (
                <p data-testid="practice-result" className={`mt-4 text-sm font-semibold ${result.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {result.is_correct ? 'Đúng.' : 'Chưa đúng, luyện lại.'} Lần thử: {result.attempt_count}.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
