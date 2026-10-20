export default function PrerequisitePicker({ options, selectedIds, onChange, disabled = false }) {
  const selected = new Set(selectedIds.map(Number));

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className="mt-1.5 rounded-xl border border-slate-200 bg-white">
      {options.length === 0 ? (
        <p className="px-3 py-2 text-xs font-normal normal-case text-slate-500">Chưa có khóa học nào để chọn.</p>
      ) : (
        <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto">
          {options.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm font-normal normal-case text-slate-800">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selected.has(option.id)}
                  disabled={disabled}
                  onChange={() => toggle(option.id)}
                />
                <span>{option.title} · {option.instructor_username}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
        <span className="text-xs font-normal normal-case text-slate-500">
          Đã chọn {selected.size} khóa. Có thể chọn nhiều khóa hoặc bỏ hết.
        </span>
        <button
          type="button"
          disabled={disabled || selected.size === 0}
          onClick={() => onChange([])}
          className="text-xs font-semibold text-rose-600 disabled:text-slate-300"
        >
          Bỏ chọn
        </button>
      </div>
    </div>
  );
}
