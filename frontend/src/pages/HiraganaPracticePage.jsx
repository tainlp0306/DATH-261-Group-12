import { useState } from 'react';

import {
  hiraganaGroups,
  hiraganaCharacters,
  getHiraganaByGroup,
} from '../hiragana-data/hiragana';

import HiraganaStroke from '../components/hiragana/HiraganaStroke';
import LessonProgress from '../components/hiragana/LessonProgress';
import QuizQuestion from '../components/hiragana/QuizQuestion';

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function createQuizQuestions(groupId) {
  const characters = shuffle(getHiraganaByGroup(groupId));

  return characters.map((question) => {
    const distractors = shuffle(
      hiraganaCharacters.filter(
        (item) => item.character !== question.character
      )
    )
      .slice(0, 3)
      .map((item) => item.romaji);

    return {
      ...question,
      options: shuffle([question.romaji, ...distractors]),
    };
  });
}

export default function HiraganaPracticePage() {
  const [phase, setPhase] = useState('selection');
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);

  const currentCharacters = selectedGroup
    ? getHiraganaByGroup(selectedGroup.id)
    : [];

  const currentCharacter = currentCharacters[currentIndex];
  const currentQuestion = questions[questionIndex];

  function startPractice(group) {
    setSelectedGroup(group);
    setCurrentIndex(0);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);

    setQuestions(createQuizQuestions(group.id));

    setPhase(group.id === 'all' ? 'quiz' : 'introduction');
  }

  function finishIntroduction() {
    if (currentIndex < currentCharacters.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    setQuestionIndex(0);
    setSelectedAnswer(null);
    setPhase('quiz');
  }

  function handleAnswer(option) {
    if (selectedAnswer !== null || !currentQuestion) {
      return;
    }

    setSelectedAnswer(option);

    if (option === currentQuestion.romaji) {
      setScore((previousScore) => previousScore + 1);
    }
  }

  function nextQuestion() {
    if (selectedAnswer === null) return;

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((index) => index + 1);
      setSelectedAnswer(null);
      return;
    }

    setPhase('result');
  }

  function restartPractice() {
    if (!selectedGroup) return;

    setScore(0);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setQuestions(createQuizQuestions(selectedGroup.id));

    if (selectedGroup.id === 'all') {
      setPhase('quiz');
    } else {
      setCurrentIndex(0);
      setPhase('introduction');
    }
  }

  function backToSelection() {
    setPhase('selection');
    setSelectedGroup(null);
    setCurrentIndex(0);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setQuestions([]);
  }

  return (
    <div className="min-h-[70vh] bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">
            LingoSphere · Self Study
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Luyện tập Hiragana
          </h1>

          <p className="mt-2 text-slate-600">
            Học mặt chữ, luyện viết và kiểm tra khả năng ghi nhớ.
          </p>
        </header>

        {phase === 'selection' && (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-slate-800">
              Chọn nhóm chữ muốn học
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hiraganaGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => startPractice(group)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-slate-900">
                    {group.name}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    {group.description}
                  </p>

                  <p className="mt-4 text-lg leading-relaxed text-emerald-600">
                    {group.characters.join(' ')}
                  </p>

                  <p className="mt-3 text-sm font-medium text-emerald-600">
                    {group.id === 'all'
                      ? 'Làm quiz ngay →'
                      : `Học ${group.characters.length} chữ →`}
                  </p>
                </button>
              ))}

              <button
                type="button"
                onClick={() =>
                  startPractice({
                    id: 'all',
                    name: 'Toàn bộ Hiragana',
                    description: 'Ôn tập tất cả chữ',
                    characters: hiraganaCharacters.map(
                      (item) => item.character
                    ),
                  })
                }
                className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 text-left transition hover:border-emerald-500 hover:shadow-md"
              >
                <h3 className="text-lg font-semibold text-emerald-900">
                  Học tất cả
                </h3>

                <p className="mt-2 text-sm text-emerald-700">
                  Bỏ qua luyện nét và làm quiz toàn bộ bảng chữ.
                </p>

                <p className="mt-4 text-sm font-semibold text-emerald-700">
                  Bắt đầu quiz →
                </p>
              </button>
            </div>
          </section>
        )}

        {phase === 'introduction' && currentCharacter && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedGroup.name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Học từng chữ rồi luyện viết theo thứ tự nét.
                </p>
              </div>

              <button
                type="button"
                onClick={backToSelection}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Thoát bài học
              </button>
            </div>

            <LessonProgress
              current={currentIndex + 1}
              total={currentCharacters.length}
              label="Tiến độ học chữ"
            />

            <HiraganaStroke
              key={currentCharacter.character}
              character={currentCharacter.character}
              romaji={currentCharacter.romaji}
              onComplete={finishIntroduction}
              //onNext={handleNextCharacter}
            />

            <p className="text-center text-sm text-slate-500">
              Khi hoàn thành nét chữ, hệ thống sẽ chuyển sang chữ tiếp theo.
              Sau chữ cuối cùng, bạn sẽ bắt đầu quiz.
            </p>
          </section>
        )}

        {phase === 'quiz' && currentQuestion && (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Quiz Hiragana
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedGroup?.name}
                </p>
              </div>

              <button
                type="button"
                onClick={backToSelection}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Thoát quiz
              </button>
            </div>

            <LessonProgress
              current={questionIndex + (selectedAnswer !== null ? 1 : 0)}
              total={questions.length}
              label="Tiến độ quiz"
            />

            <QuizQuestion
              question={currentQuestion}
              options={currentQuestion.options}
              selectedAnswer={selectedAnswer}
              onSelect={handleAnswer}
              onNext={nextQuestion}
              questionNumber={questionIndex + 1}
              totalQuestions={questions.length}
            />

            <p className="text-center text-sm text-slate-500">
              Đúng {score}/{questions.length} câu hiện tại.
            </p>
          </section>
        )}

        {phase === 'result' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              {score === questions.length ? '🎉' : '📚'}
            </div>

            <h2 className="mt-5 text-2xl font-bold text-slate-900">
              Hoàn thành quiz!
            </h2>

            <p className="mt-2 text-slate-600">
              Bạn đã hoàn thành lượt ôn tập {selectedGroup?.name}.
            </p>

            <div className="my-8">
              <p className="text-sm font-medium text-slate-500">
                Kết quả của bạn
              </p>

              <p className="mt-2 text-5xl font-bold text-emerald-600">
                {questions.length > 0
                  ? Math.round((score / questions.length) * 100)
                  : 0}
                %
              </p>

              <p className="mt-3 text-slate-600">
                Trả lời đúng {score}/{questions.length} câu.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={restartPractice}
                className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
              >
                Học lại
              </button>

              <button
                type="button"
                onClick={backToSelection}
                className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Chọn nhóm khác
              </button>
            </div>

            <p className="mt-6 text-xs text-slate-400">
              Kết quả chỉ dùng cho lượt tự luyện tập này, không ảnh hưởng
              đến điểm số khóa học.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
