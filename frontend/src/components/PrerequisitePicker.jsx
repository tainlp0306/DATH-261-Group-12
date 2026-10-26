import React from 'react';

const PrerequisitePicker = ({ options, selected, onChange, disabled = false }) => {
  const selectedIds = new Set(selected.map(Number));
  const toggle = (id, checked) => {
    onChange(checked
      ? [...selectedIds, Number(id)]
      : [...selectedIds].filter((selectedId) => selectedId !== Number(id)));
  };

  return (
    <div className="mt-2 max-h-52 space-y-1 overflow-y-auto border border-slate-300 bg-white p-2">
      {options.length === 0 ? <p className="px-2 py-3 text-xs font-normal normal-case text-slate-500">Chưa có khóa học phù hợp.</p> : options.map((option) => (
        <label key={option.id} className="flex cursor-pointer items-start gap-2 px-2 py-2 text-xs font-normal normal-case text-slate-700 hover:bg-slate-50">
          <input type="checkbox" checked={selectedIds.has(Number(option.id))} disabled={disabled} onChange={(event) => toggle(option.id, event.target.checked)} className="mt-0.5 accent-emerald-800" />
          <span>{option.title}<span className="ml-1 text-slate-500">· {option.instructor_username}</span></span>
        </label>
      ))}
    </div>
  );
};

export default PrerequisitePicker;
