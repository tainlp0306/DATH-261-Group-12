import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { courseApi } from '../api/courseApi';

const EMPTY = {
  word: '', meaning: '', romaji: '', prompt: '', options: '', answer: '', kind: 'typing',
};

const kindLabels = {
  typing: 'Gõ',
  stroke: 'Vẽ nét',
  theory: 'Lý thuyết',
  choice: 'Trắc nghiệm',
};

const optionLines = (value) => value.split('\n').map((line) => line.trim()).filter(Boolean);

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
    const options = optionLines(form.options);
    const answer = form.kind === 'theory' || form.kind === 'choice' ? form.answer.trim() : form.word.trim();
    if ((form.kind === 'typing' || form.kind === 'stroke') && !form.word.trim()) {
      toast.error('Nhập nội dung cần luyện.');
      return;
    }
    if ((form.kind === 'theory' || form.kind === 'choice') && !form.prompt.trim()) {
      toast.error('Nhập câu hỏi.');
      return;
    }
    try {
      setSaving(true);
      await courseApi.createVocabulary(courseId, {
        word: answer,
        meaning: form.kind === 'typing' ? form.meaning.trim() : '',
        romaji: form.kind === 'typing' ? form.romaji.trim() : '',
        prompt: form.kind === 'theory' || form.kind === 'choice' ? form.prompt.trim() : '',
        options: form.kind === 'choice' ? options : [],
        kind: form.kind,
      });
      setForm(EMPTY);
      await load();
      toast.success('Đã thêm mục luyện tập.');
    } catch (error) {
      const data = error.response?.data;
      const first = data && Object.values(data).flat()[0];
      toast.error(first || 'Không thêm được mục luyện tập.');
    } finally {
      setSaving(false);
    }
  };

  const labelOf = (item) => (
    item.kind === 'theory' || item.kind === 'choice' ? item.prompt : item.word
  );

  return (
    <div className="space-y-6" data-testid="vocabulary-editor">
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
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
            <option value="theory">Lý thuyết</option>
            <option value="choice">Trắc nghiệm</option>
          </select>
        </label>

        {(form.kind === 'typing' || form.kind === 'stroke') && (
          <label className="text-xs font-bold uppercase text-slate-600">
            {form.kind === 'stroke' ? 'Ký tự' : 'Chữ hoặc câu'}
            <input
              data-testid="vocabulary-word"
              value={form.word}
              onChange={(event) => setForm((current) => ({ ...current, word: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
            />
          </label>
        )}

        {form.kind === 'typing' && (
          <>
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
          </>
        )}

        {(form.kind === 'theory' || form.kind === 'choice') && (
          <label className="text-xs font-bold uppercase text-slate-600 md:col-span-2">
            Câu hỏi
            <input
              data-testid="vocabulary-prompt"
              value={form.prompt}
              onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
            />
          </label>
        )}

        {form.kind === 'theory' && (
          <label className="text-xs font-bold uppercase text-slate-600 md:col-span-2">
            Đáp án ngắn
            <input
              data-testid="vocabulary-answer"
              value={form.answer}
              onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
            />
          </label>
        )}

        {form.kind === 'choice' && (
          <>
            <label className="text-xs font-bold uppercase text-slate-600 md:col-span-2">
              Các lựa chọn, mỗi dòng một lựa chọn
              <textarea
                data-testid="vocabulary-options"
                value={form.options}
                onChange={(event) => setForm((current) => ({ ...current, options: event.target.value }))}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
              />
            </label>
            <label className="text-xs font-bold uppercase text-slate-600">
              Đáp án đúng
              <select
                data-testid="vocabulary-correct"
                value={form.answer}
                onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case"
              >
                <option value="">Chọn đáp án đúng</option>
                {optionLines(form.options).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </>
        )}

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
              <span className="font-semibold text-slate-900">{labelOf(item)}</span>
              <span className="text-slate-500">{kindLabels[item.kind] || item.kind}{item.meaning ? ` · ${item.meaning}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
