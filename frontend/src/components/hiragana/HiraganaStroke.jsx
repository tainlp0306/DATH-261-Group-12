import { useCallback, useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

const KANA_DATA_URL = 'https://cdn.jsdelivr.net/gh/ailectra/kana-json@v0.0.1/data';

export default function HiraganaStroke({
  character,
  romaji,
  onComplete,
}) {
  const targetRef = useRef(null);
  const writerRef = useRef(null);
  const completedRef = useRef(false);

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Đang tải dữ liệu chữ...');
  const [mistakes, setMistakes] = useState(0);

  const startQuiz = useCallback(() => {
    const writer = writerRef.current;

    if (!writer) return;

    writer.cancelQuiz();
    completedRef.current = false;
    setStatus('drawing');
    setMessage('Hãy viết theo đúng thứ tự nét.');

    writer.quiz({
      onMistake: () => {
        setMistakes((count) => count + 1);
        setMessage('Chưa đúng, hãy thử lại theo hướng nét.');
      },

      onCorrectStroke: (data) => {
        if (data.strokesRemaining > 0) {
          setMessage(
            `Còn ${data.strokesRemaining} nét nữa. Tiếp tục nhé!`
          );
        }
      },

      onComplete: () => {
        if (completedRef.current) return;

        completedRef.current = true;
        setStatus('completed');
        setMessage(`Hoàn thành chữ ${character}!`);
        onComplete?.({
          character,
          romaji,
          mistakes,
        });
      },
    });
  }, [character, romaji, onComplete, mistakes]);

  useEffect(() => {
    let cancelled = false;

    setStatus('loading');
    setMessage('Đang tải dữ liệu chữ...');
    setMistakes(0);
    completedRef.current = false;

    if (targetRef.current) {
      targetRef.current.innerHTML = '';
    }

    const writer = HanziWriter.create(targetRef.current, character, {
      width: 280,
      height: 280,
      padding: 20,
      showCharacter: false,
      showOutline: true,
      strokeColor: '#166534',
      outlineColor: '#cbd5e1',
      drawingColor: '#0f766e',
      highlightColor: '#d97706',
      showHintAfterMisses: 2,

      charDataLoader: (char, onLoad, onError) => {
        fetch(
          `${KANA_DATA_URL}/${encodeURIComponent(char)}.json`
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error('Không thể tải dữ liệu nét chữ.');
            }
            return response.json();
          })
          .then((data) => {
            if (cancelled) return;
            onLoad(data);
          })
          .catch((err) => {
            if (cancelled) return;
            onError(err);
          });
      },

      onLoadCharDataSuccess: () => {
        if (cancelled) return;
        setStatus('ready');
        setMessage('Hãy viết theo đúng thứ tự nét.');
        
        setTimeout(() => {
          if (!cancelled && writerRef.current) {
            startQuiz();
          }
        }, 50);
      },

      onLoadCharDataError: () => {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          'Không thể tải dữ liệu chữ. Hãy kiểm tra kết nối rồi thử lại.'
        );
      },
    });

    writerRef.current = writer;

    return () => {
      cancelled = true;
      writer.cancelQuiz();

      if (writerRef.current === writer) {
        writerRef.current = null;
      }
    };
  }, [character]);

  const handleStart = () => {
    startQuiz();
  };

  const handleWatchStrokes = () => {
    const writer = writerRef.current;

    if (!writer || status === 'loading' || status === 'error') {
      return;
    }

    writer.cancelQuiz();
    setStatus('animating');
    setMessage('Hãy quan sát thứ tự nét...');

    writer.animateCharacter({
      onComplete: () => {
        setMessage('Đến lượt bạn luyện viết!');
        startQuiz();
      },
    });
  };

  const handleRestart = () => {
    const writer = writerRef.current;

    if (!writer) return;

    writer.cancelQuiz();
    writer.setCharacter(character);
    setMistakes(0);
    completedRef.current = false;
    setStatus('ready');
    setMessage('Hãy bắt đầu luyện viết lại.');
  };

  return (
    <section className="w-full max-w-lg mx-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-4">
        <div className="text-6xl font-medium text-slate-900">
          {character}
        </div>

        <div>
          <p className="text-2xl font-semibold text-[#145c45]">
            {romaji}
          </p>
          <p className="text-sm text-slate-500">Hiragana</p>
        </div>
      </div>

      <div className="flex justify-center rounded-xl bg-slate-50 p-3">
        <div
            ref={targetRef}
            className="h-[280px] w-[280px] max-w-full"
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`mt-4 text-center text-sm ${
          status === 'error'
            ? 'text-red-600'
            : status === 'completed'
              ? 'text-green-700'
              : 'text-slate-600'
        }`}
      >
        {message}
      </p>

      <p className="mt-2 text-center text-sm text-slate-500">
        Số lần mắc lỗi: {mistakes}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={handleWatchStrokes}
          disabled={status === 'loading' || status === 'error'}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Xem thứ tự nét
        </button>

        {status === 'ready' && (
          <button
            type="button"
            onClick={handleStart}
            className="rounded-lg bg-[#145c45] px-4 py-2 text-sm font-medium text-white hover:bg-[#145c45]"
          >
            Bắt đầu viết
          </button>
        )}

        {(status === 'completed' || status === 'drawing') && (
        <>
            <button
            type="button"
            onClick={handleRestart}
            className="rounded-lg bg-[#145c45] px-4 py-2 text-sm font-medium text-white hover:bg-[#104836]"
            >
            Viết lại
            </button>
        </>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-[#145c45] px-4 py-2 text-sm font-medium text-white hover:bg-[#145c45]"
          >
            Tải lại trang
          </button>
        )}
      </div>
    </section>
  );
}