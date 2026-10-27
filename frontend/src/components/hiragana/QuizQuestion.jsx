export default function QuizQuestion({
  question,
  options,
  selectedAnswer,
  onSelect,
  onNext,
  questionNumber,
  totalQuestions,
}) {
  if (!question) return null;

  const answered = selectedAnswer !== null;
  const correct = selectedAnswer === question.romaji;

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-center text-sm font-medium text-slate-500">
        Câu {questionNumber}/{totalQuestions}
      </p>

      <h2 className="mt-4 text-center text-lg font-semibold text-slate-800">
        Chữ này đọc là gì?
      </h2>

      <div
        lang="ja"
        className="my-6 text-center text-8xl text-slate-900"
      >
        {question.character}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const isCorrect = option === question.romaji;
          const isSelected = option === selectedAnswer;

          let style =
            'border-slate-200 bg-white hover:border-indigo-400';

          if (answered && isCorrect) {
            style = 'border-green-500 bg-green-50 text-green-800';
          } else if (isSelected && !isCorrect) {
            style = 'border-red-500 bg-red-50 text-red-800';
          }

          return (
            <button
              key={option}
              type="button"
              disabled={answered}
              onClick={() => onSelect(option)}
              className={`rounded-xl border-2 px-4 py-4 text-lg font-semibold transition ${style} disabled:cursor-default`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered && (
        <div
          role="status"
          className={`mt-5 rounded-lg p-3 text-center text-sm ${
            correct
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {correct
            ? 'Chính xác! Làm tốt lắm.'
            : `Chưa chính xác. Đáp án đúng là ${question.romaji}.`}
        </div>
      )}

      <button
        type="button"
        disabled={!answered}
        onClick={onNext}
        className="mt-6 w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {questionNumber === totalQuestions
          ? 'Xem kết quả'
          : 'Câu tiếp theo'}
      </button>
    </section>
  );
}
