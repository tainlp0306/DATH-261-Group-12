export default function LessonProgress({
  current,
  total,
  label = 'Tiến độ học',
}) {
  const progress =
    total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <section className="w-full">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          {current}/{total}
        </span>
      </div>

      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}
