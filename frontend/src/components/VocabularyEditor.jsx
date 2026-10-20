import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { courseApi } from '../api/courseApi';

const EMPTY = { word: '', meaning: '', romaji: '', kind: 'typing' };

export default function VocabularyEditor({ courseId }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await courseApi.getCourseVocabulary(courseId);
    setItems(Array.isArray(data) ? data : data.results || []);
  };

  useEffect(() => {
    let active = true;
    courseApi.getCourseVocabulary(courseId)
      .then((data) => {
        if (active) setItems(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => toast.error('Không tải được danh sách luyện tập.'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [courseId]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.word.trim()) {
      toast.error('Nhập nội dung cần luyện.');
      return;
    }
    try {
      setSaving(true);
      await courseApi.createVocabulary(courseId, {
        word: form.word.trim(),
        meaning: form.meaning.trim(),
        romaji: form.romaji.trim(),
        kind: form.kind,
      });
      setForm(EMPTY);
      await load();
      toast.success('Đã thêm mục luyện tập.');
    } catch {
      toast.error('Không thêm được mục luyện tập.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="vocabulary-editor">
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <label className="text-xs font-bold uppercase text-slate-600">
          Chữ hoặc câu
          <input
            data-testid="vocabulary-word"
            value={form.word}
            onChange={(event) => setForm((current) => ({ ...current, word: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
          />
        </label>
        <label className="text-xs font-bold uppercase text-slate-600">
          Romaji
          <input
            data-testid="vocabulary-romaji"
            value={form.romaji}
            onChange={(event) => setForm((current) => ({ ...current, romaji: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
          />
        </label>
        <label className="text-xs font-bold uppercase text-slate-600">
          Nghĩa
          <input
            data-testid="vocabulary-meaning"
            value={form.meaning}
            onChange={(event) => setForm((current) => ({ ...current, meaning: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
          />
        </label>
        <label className="text-xs font-bold uppercase text-slate-600">
          Hình thức
          <select
            data-testid="vocabulary-kind"
            value={form.kind}
            onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
          >
            <option value="typing">Gõ</option>
            <option value="stroke">Vẽ nét</option>
          </select>
        </label>
        <button
          type="submit"
          data-testid="vocabulary-save"
          disabled={saving}
          className="md:col-span-2 w-fit rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Thêm mục luyện tập
        </button>
      </form>

      {loading ? <p className="text-sm text-slate-500">Đang tải...</p> : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {items.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Chưa có mục luyện tập.</li>}
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-900">{item.word}</span>
              <span className="text-slate-500">{item.kind === 'stroke' ? 'Vẽ nét' : 'Gõ'}{item.meaning ? ` · ${item.meaning}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
