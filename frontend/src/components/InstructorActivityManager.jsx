import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { BookOpenCheck, Plus, Save, Send, WandSparkles } from 'lucide-react';
import { courseApi } from '../api/courseApi';

const emptyItem = (type = 'quiz') => ({
  prompt: '',
  answer: '',
  options: type === 'quiz' ? 'Lựa chọn A\nLựa chọn B\nLựa chọn C\nLựa chọn D' : '',
});

const emptyForm = () => ({
  title: '',
  description: '',
  activity_type: 'quiz',
  module: '',
  is_published: true,
  notify_students: true,
  items: [emptyItem()],
});

const activityLabels = {
  quiz: 'Trắc nghiệm ngắn',
  vocabulary: 'Luyện từ vựng',
  writing: 'Luyện viết ký tự',
};

export default function InstructorActivityManager({ courseId, modules }) {
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loadedCourseId, setLoadedCourseId] = useState(null);
  const [saving, setSaving] = useState(false);
  const loadRequest = useRef(0);

  const fetchActivities = useCallback(
    () => courseApi.getCourseLearningActivities(courseId),
    [courseId],
  );

  const loadActivities = useCallback(async () => {
    const requestId = ++loadRequest.current;
    try {
      const data = await fetchActivities();
      if (requestId === loadRequest.current) setActivities(data);
    } catch (error) {
      if (requestId === loadRequest.current) {
        console.error('Failed to load short activities:', error);
        setActivities([]);
        toast.error(error.response?.data?.detail || 'Không thể tải bài luyện ngắn.');
      }
    } finally {
      if (requestId === loadRequest.current) setLoadedCourseId(courseId);
    }
  }, [courseId, fetchActivities]);

  useEffect(() => {
    let active = true;
    const requestId = ++loadRequest.current;
    const load = async () => {
      try {
        const data = await fetchActivities();
        if (active && requestId === loadRequest.current) setActivities(data);
      } catch (error) {
        if (active && requestId === loadRequest.current) {
          console.error('Failed to load short activities:', error);
          setActivities([]);
          toast.error(error.response?.data?.detail || 'Không thể tải bài luyện ngắn.');
        }
      } finally {
        if (active && requestId === loadRequest.current) setLoadedCourseId(courseId);
      }
    };
    load();
    return () => {
      active = false;
      loadRequest.current += 1;
    };
  }, [courseId, fetchActivities]);

  const setItem = (index, key, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    }));
  };

  const changeType = (activityType) => {
    setForm((current) => ({
      ...current,
      activity_type: activityType,
      items: current.items.map(() => emptyItem(activityType)),
    }));
  };

  const editActivity = (activity) => {
    setEditingId(activity.id);
    setForm({
      title: activity.title,
      description: activity.description || '',
      activity_type: activity.activity_type,
      module: activity.module || '',
      is_published: activity.is_published,
      notify_students: true,
      items: activity.items.map((item) => ({
        prompt: item.prompt,
        answer: item.answer,
        options: (item.options || []).join('\n'),
      })),
    });
    document.getElementById('activity-editor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const saveActivity = async (event) => {
    event.preventDefault();
    const items = form.items.map((item) => ({
      prompt: item.prompt.trim(),
      answer: item.answer.trim(),
      options: form.activity_type === 'quiz'
        ? item.options.split('\n').map((option) => option.trim()).filter(Boolean)
        : [],
    }));
    setSaving(true);
    try {
      const payload = {
        ...form,
        module: form.module ? Number(form.module) : null,
        items,
      };
      delete payload.notify_students;
      if (editingId) {
        await courseApi.updateLearningActivity(editingId, {
          ...payload,
          notify_students: form.notify_students,
        });
        toast.success('Đã cập nhật bài luyện ngắn.');
      } else {
        await courseApi.createCourseLearningActivity(courseId, payload);
        toast.success(form.is_published ? 'Đã tạo và mở bài luyện ngắn.' : 'Đã lưu bài luyện ở trạng thái nháp.');
      }
      clearForm();
      await loadActivities();
    } catch (error) {
      console.error('Failed to save short activity:', error);
      const details = error.response?.data;
      const message = details?.items?.[0] || details?.detail || 'Không thể lưu bài luyện. Hãy kiểm tra nội dung và đáp án.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-7">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Bài học ngắn dùng chung</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">Tạo hoạt động luyện tập</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Dùng trắc nghiệm cho mọi môn, gõ đáp án để ôn từ vựng, hoặc tạo mục luyện viết ký tự. Phần viết lưu nét người học nhưng không tự nhận diện/chấm chữ viết.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <form id="activity-editor" onSubmit={saveActivity} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">{editingId ? 'Chỉnh sửa hoạt động' : 'Hoạt động mới'}</h3>
            {editingId && <button type="button" onClick={clearForm} className="text-xs font-semibold text-slate-600 underline">Hủy sửa</button>}
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Tên hoạt động
            <input required maxLength={255} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Ví dụ: Ôn từ vựng Unit 1" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Dạng hoạt động
              <select value={form.activity_type} onChange={(event) => changeType(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5">
                {Object.entries(activityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Chương (không bắt buộc)
              <select value={form.module} onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5">
                <option value="">Toàn khóa học</option>
                {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Hướng dẫn
            <textarea rows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>

          <div className="space-y-4">
            {form.items.map((item, index) => (
              <fieldset key={index} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-semibold text-slate-800">Nội dung {index + 1}</legend>
                  {form.items.length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} className="text-xs font-semibold text-rose-700">Xóa</button>}
                </div>
                <label className="block text-sm text-slate-700">
                  {form.activity_type === 'writing' ? 'Hướng dẫn luyện viết' : 'Câu hỏi / gợi ý'}
                  <input required value={item.prompt} onChange={(event) => setItem(index, 'prompt', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" placeholder={form.activity_type === 'writing' ? 'Viết theo mẫu bên dưới' : 'Nhập câu hỏi hoặc nghĩa cần ôn'} />
                </label>
                <label className="block text-sm text-slate-700">
                  {form.activity_type === 'writing' ? 'Ký tự mẫu' : 'Đáp án'}
                  <input required value={item.answer} onChange={(event) => setItem(index, 'answer', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" placeholder={form.activity_type === 'writing' ? 'あ, 漢字, 한글…' : 'Đáp án đúng'} />
                </label>
                {form.activity_type === 'quiz' && (
                  <>
                    <label className="block text-sm text-slate-700">
                      Các lựa chọn (mỗi dòng một lựa chọn)
                      <textarea required rows={4} value={item.options} onChange={(event) => setItem(index, 'options', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                    </label>
                    <p className="text-xs text-slate-500">Đáp án phải khớp chính xác một dòng lựa chọn.</p>
                  </>
                )}
              </fieldset>
            ))}
            <button type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyItem(current.activity_type)] }))} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Plus className="h-4 w-4" /> Thêm nội dung
            </button>
          </div>

          <div className="flex flex-wrap gap-5 border-t border-slate-200 pt-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_published} onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))} />
              {form.is_published ? 'Mở cho học viên' : 'Lưu ở trạng thái nháp'}
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.notify_students} onChange={(event) => setForm((current) => ({ ...current, notify_students: event.target.checked }))} />
              Gửi thông báo khi mở hoặc cập nhật
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
              {editingId ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo hoạt động'}
            </button>
            {editingId && <button type="button" onClick={clearForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button>}
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-indigo-950"><WandSparkles className="h-4 w-4" /> Dùng cho nhiều môn</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-indigo-950/80">
              <li>Ngôn ngữ: luyện nhận diện và gõ từ vựng.</li>
              <li>Chữ phi Latin: xem ký tự mẫu rồi luyện viết trên bảng vẽ.</li>
              <li>Lập trình, triết học và môn khác: tạo quiz ngắn nhiều lựa chọn.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><BookOpenCheck className="h-4 w-4" /> Hoạt động trong khóa học</div>
            {loadedCourseId !== courseId ? <p className="mt-3 text-sm text-slate-500">Đang tải…</p> : activities.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Chưa có hoạt động nào.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {activities.map((activity) => (
                  <li key={activity.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{activity.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{activityLabels[activity.activity_type]} · {activity.is_published ? 'Đang mở' : 'Bản nháp'}</p>
                    </div>
                    <button type="button" onClick={() => editActivity(activity)} className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Sửa</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
