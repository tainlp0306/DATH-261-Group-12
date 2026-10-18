import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import './PracticePrototypePage.css';

const sentence = '你好，很高兴认识你。';

function TypingPractice() {
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);

  const correct = answer.trim() === sentence;

  return (
    <section className="practice-card">
      <p className="eyebrow">EXERCISE 01 · TYPING</p>
      <h2>Practice your typing</h2>
      <p className="muted">
        Type the sentence below exactly as shown.
      </p>

      <div className="sentence">
        <span className="character">{sentence}</span>
        <p>Meaning: Hello, nice to meet you.</p>
      </div>

      <label htmlFor="typing-answer">Your answer</label>
      <textarea
        id="typing-answer"
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          setChecked(false);
        }}
        placeholder="Type the sentence here..."
        rows={3}
      />

      <div className="typing-meta">
        <span>{answer.length} characters typed</span>
        <span>{answer.length > 0
          ? Math.round(
              [...answer].filter((c, i) => c === [...sentence][i]).length
              / sentence.length * 100
            )
          : 0}% character match
        </span>
      </div>

      <button className="primary" onClick={() => setChecked(true)}>
        Check answer
      </button>

      {checked && (
        <p className={correct ? 'success feedback' : 'error feedback'}>
          {correct
            ? 'Excellent! Your answer is correct.'
            : 'Incorrect. Compare your answer with the sentence above.'}
        </p>
      )}
    </section>
  );
}

function WritingPractice() {
  const targetRef = useRef(null);
  const writerRef = useRef(null);
  const [status, setStatus] = useState('Loading character...');
  const [mistakes, setMistakes] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const writer = HanziWriter.create(targetRef.current, '好', {
      width: 280,
      height: 280,
      padding: 20,
      //renderer: 'canvas',
      showCharacter: false,
      showOutline: true,
      strokeColor: '#166534',
      outlineColor: '#cbd5e1',
      drawingColor: '#0f766e',
      highlightColor: '#d97706',
      showHintAfterMisses: 2,
      onLoadCharDataSuccess: () => {
        if (!cancelled) setStatus('Draw each stroke in the correct order.');
      },
      onLoadCharDataError: () => {
        if (!cancelled) {
          setStatus('Could not load character data. Check your internet connection.');
        }
      },
    });

    writerRef.current = writer;

    writer.quiz({
      onMistake: () => {
        if (!cancelled) {
          setMistakes((n) => n + 1);
          setStatus('Not quite. Try following the stroke direction.');
        }
      },
      onCorrectStroke: (data) => {
        if (!cancelled) {
          setStatus(
            data.strokesRemaining === 0
              ? 'Character completed!'
              : `${data.strokesRemaining} strokes remaining. Keep going!`
          );
        }
      },
      onComplete: () => {
        if (!cancelled) {
          setCompleted(true);
          setStatus('Great work! You completed 好.');
        }
      },
    });

    return () => {
      cancelled = true;
      writer.cancelQuiz();
      writerRef.current = null;
    };
  }, []);

  const restart = () => {
    setMistakes(0);
    setCompleted(false);
    setStatus('Draw each stroke in the correct order.');
    writerRef.current?.cancelQuiz();
    writerRef.current?.quiz({
      onMistake: () => {
        setMistakes((n) => n + 1);
        setStatus('Not quite. Try again!');
      },
      onComplete: () => {
        setCompleted(true);
        setStatus('Great work! You completed 好.');
      },
    });
  };

  return (
    <section className="practice-card">
      <p className="eyebrow">EXERCISE 02 · HANDWRITING</p>
      <h2>Character writing practice</h2>
      <p className="muted">
        Practise the stroke order of this character.
      </p>

      <div className="character-heading">
        <span className="big-character">好</span>
        <div>
          <strong>hǎo</strong>
          <p className="muted">Meaning: good; well</p>
        </div>
      </div>

      <div className="drawing-area">
        <div ref={targetRef} className="writer-target" />
      </div>

      <p className={completed ? 'success feedback' : 'muted feedback'}>
        {status}
      </p>
      <p className="muted">Mistakes: {mistakes}</p>

      <div className="actions">
        <button
          className="secondary"
          onClick={() => {
            const writer = writerRef.current;
            if (!writer) return;

            writer.cancelQuiz();
            setCompleted(false);
            setMistakes(0);
            setStatus('Watch the stroke order...');

            writer.animateCharacter({
              onComplete: () => {
                setStatus('Your turn! Draw each stroke in the correct order.');

                writer.quiz({
                  onMistake: () => {
                    setMistakes((n) => n + 1);
                    setStatus('Not quite. Try following the stroke direction.');
                  },
                  onCorrectStroke: (data) => {
                    setStatus(
                      data.strokesRemaining === 0
                        ? 'Character completed!'
                        : `${data.strokesRemaining} strokes remaining. Keep going!`
                    );
                  },
                  onComplete: () => {
                    setCompleted(true);
                    setStatus('Great work! You completed 好.');
                  },
                });
              },
            });
          }}
        >
          Watch strokes
        </button>

        <button className="primary" onClick={restart}>
          Try again
        </button>
      </div>
    </section>
  );
}


function JapaneseWritingPractice() {
  const targetRef = useRef(null);
  const writerRef = useRef(null);
  const [status, setStatus] = useState('Loading character...');
  const [mistakes, setMistakes] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const writer = HanziWriter.create(targetRef.current, 'あ', {
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
      
      charDataLoader: (character, onLoad, onError) => {
        fetch(
          `https://cdn.jsdelivr.net/gh/ailectra/kana-json@v0.0.1/data/${character}.json`
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error('Could not load kana data');
            }
            return response.json();
          })
          .then(onLoad)
          .catch(onError);
      },


      onLoadCharDataSuccess: () => {
        if (!cancelled) {
          setStatus('Draw each stroke in the correct order.');
        }
      },

      onLoadCharDataError: () => {
        if (!cancelled) {
          setStatus('Could not load character data. Check your internet connection.');
        }
      },
    });

    writerRef.current = writer;

    writer.quiz({
      onMistake: () => {
        if (!cancelled) {
          setMistakes((n) => n + 1);
          setStatus('Not quite. Try following the stroke direction.');
        }
      },

      onCorrectStroke: (data) => {
        if (!cancelled) {
          setStatus(
            data.strokesRemaining === 0
              ? 'Character completed!'
              : `${data.strokesRemaining} strokes remaining. Keep going!`
          );
        }
      },

      onComplete: () => {
        if (!cancelled) {
          setCompleted(true);
          setStatus('Great work! You completed あ.');
        }
      },
    });

    return () => {
      cancelled = true;
      writer.cancelQuiz();
      writerRef.current = null;
    };
  }, []);

  const startQuiz = () => {
    writerRef.current?.quiz({
      onMistake: () => {
        setMistakes((n) => n + 1);
        setStatus('Not quite. Try again!');
      },

      onCorrectStroke: (data) => {
        setStatus(
          data.strokesRemaining === 0
            ? 'Character completed!'
            : `${data.strokesRemaining} strokes remaining. Keep going!`
        );
      },

      onComplete: () => {
        setCompleted(true);
        setStatus('Great work! You completed あ.');
      },
    });
  };

  const restart = () => {
    const writer = writerRef.current;
    if (!writer) return;

    writer.cancelQuiz();
    setMistakes(0);
    setCompleted(false);
    setStatus('Draw each stroke in the correct order.');

    writer.setCharacter('あ');
    startQuiz();
  };

  const watchStrokes = () => {
    const writer = writerRef.current;
    if (!writer) return;

    writer.cancelQuiz();
    setCompleted(false);
    setMistakes(0);
    setStatus('Watch the stroke order...');

    writer.animateCharacter({
      onComplete: () => {
        setStatus('Your turn! Draw each stroke in the correct order.');
        startQuiz();
      },
    });
  };

  return (
    <section className="practice-card">
      <p className="eyebrow">EXERCISE 03 · JAPANESE</p>
      <h2>Japanese writing practice</h2>
      <p className="muted">
        Learn your first hiragana character.
      </p>

      <div className="character-heading">
        <span className="big-character">あ</span>
        <div>
          <strong>a</strong>
          <p className="muted">Hiragana</p>
          <p className="muted">The vowel a</p>
        </div>
      </div>

      <div className="drawing-area">
        <div ref={targetRef} className="writer-target" />
      </div>

      <p className={completed ? 'success feedback' : 'muted feedback'}>
        {status}
      </p>

      <p className="muted">Mistakes: {mistakes}</p>

      <div className="actions">
        <button className="secondary" onClick={watchStrokes}>
          Watch strokes
        </button>

        <button className="primary" onClick={restart}>
          Try again
        </button>
      </div>
    </section>
  );
}



export default function PracticePrototypePage() {
  const [screen, setScreen] = useState('typing');

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">文</span>
          <span>LingoSphere</span>
        </a>
        <span className="prototype-label">PRACTICE LAB · PROTOTYPE</span>
      </header>

      <section className="intro">
        <p className="eyebrow">ACTIVE LEARNING</p>
        <h1>Learn by doing.</h1>
        <p className="muted">
          Build confidence through typing and handwriting practice.
        </p>
      </section>

      <nav className="tabs" aria-label="Practice activities">
        <button
          className={screen === 'typing' ? 'tab active' : 'tab'}
          onClick={() => setScreen('typing')}
        >
          01&nbsp; Typing practice
        </button>
        <button
          className={screen === 'writing' ? 'tab active' : 'tab'}
          onClick={() => setScreen('writing')}
        >
          02&nbsp; Character writing
        </button>
        <button
          className={screen === 'japanese' ? 'tab active' : 'tab'}
          onClick={() => setScreen('japanese')}
        >
          03&nbsp; Japanese writing
        </button>
      </nav>

      {screen === 'typing' ? (
        <TypingPractice />
      ) : screen === 'writing' ? (
        <WritingPractice />
      ) : (
        <JapaneseWritingPractice />
      )}

      <footer>
        LingoSphere · Learning prototype · Sample exercises
      </footer>
    </main>
  );
}
