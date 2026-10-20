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
  const [mode, setMode] = useState('typing');
  const [currentId, setCurrentId] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inked, setInked] = useState(false);
  const writerHost = useRef(null);
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const visible = items.filter((item) => item.kind === mode);
  const current = visible.find((item) => item.id === currentId) || visible[0] || null;

  useEffect(() => {
    let active = true;
    Promise.all([
      courseApi.getCourseDetail(id),
      courseApi.getCourseVocabulary(id),
    ]).then(([courseData, vocabulary]) => {
      if (!active) return;
      setCourse(courseData);
      const list = Array.isArray(vocabulary) ? vocabulary : vocabulary.results || [];
      setItems(list);
      const firstTyping = list.find((item) => item.kind === 'typing');
      setCurrentId(firstTyping?.id ?? list[0]?.id ?? null);
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
  }, [current?.id, mode]);

  useEffect(() => {
    if (mode !== 'stroke' || !current || !writerHost.current) return undefined;
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
  }, [mode, current]);

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('typing');
            setCurrentId(items.find((item) => item.kind === 'typing')?.id ?? null);
          }}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'typing' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
        >
          Gõ
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('stroke');
            setCurrentId(items.find((item) => item.kind === 'stroke')?.id ?? null);
          }}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'stroke' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
        >
          Vẽ nét
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">Chưa có mục {mode === 'stroke' ? 'vẽ nét' : 'gõ'} trong khóa này.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="practice-item"
                  data-word={item.word}
                  onClick={() => setCurrentId(item.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${current?.id === item.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                >
                  {item.word}
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <p data-testid="practice-target" className="text-center text-4xl font-bold text-slate-900">{current.word}</p>
              <p className="mt-2 text-center text-sm text-slate-500">
                {current.romaji ? `Romaji: ${current.romaji}` : 'Không giới hạn số lần luyện.'}
                {current.meaning ? ` · ${current.meaning}` : ''}
              </p>

              {mode === 'typing' ? (
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
                    placeholder="Gõ chữ, câu, hoặc romaji"
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
              ) : (
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
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Nộp nét đã vẽ
                  </button>
                </div>
              )}

              {result && (
                <p data-testid="practice-result" className={`mt-4 text-sm font-semibold ${result.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {result.message} Lần thử: {result.attempt_count}.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
