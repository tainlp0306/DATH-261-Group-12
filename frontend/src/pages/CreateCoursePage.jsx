import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { courseApi } from '../api/courseApi';
import { 
  PlusCircle, 
  Layers, 
  BookOpen, 
  Video, 
  FileText, 
  Presentation, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  Eye,
  Trash2,
  FolderPlus
} from 'lucide-react';

const CreateCoursePage = () => {
  const navigate = useNavigate();

  // Form State: Course Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [courseLoading, setCourseLoading] = useState(false);
  const [createdCourse, setCreatedCourse] = useState(null);

  // Form State: Module Creation
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleOrder, setModuleOrder] = useState(1);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [modulesList, setModulesList] = useState([]);

  // Form State: Lesson Creation
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState('text');
  const [lessonContent, setLessonContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [lessonOrder, setLessonOrder] = useState(1);
  const [lessonLoading, setLessonLoading] = useState(false);

  // Status Feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Step 1: Create Course
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showToast('Vui lòng nhập tên và mô tả khóa học!', 'error');
      return;
    }

    try {
      setCourseLoading(true);
      const res = await courseApi.createCourse({
        title,
        description,
        requirements,
        is_published: isPublished,
      });

      setCreatedCourse(res);
      showToast('Tạo thông tin khóa học thành công! Hãy thêm các chương và bài học.', 'success');
    } catch (err) {
      console.error('Create course error:', err);
      const msg = err.response?.data?.error || err.response?.data?.title?.[0] || 'Tạo khóa học thất bại!';
      showToast(msg, 'error');
    } finally {
      setCourseLoading(false);
    }
  };

  // Step 2: Add Module
  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!moduleTitle.trim() || !createdCourse) return;

    try {
      setModuleLoading(true);
      const newModule = await courseApi.createModule({
        course: createdCourse.id,
        title: moduleTitle,
        order: Number(moduleOrder) || (modulesList.length + 1),
      });

      const updated = [...modulesList, { ...newModule, lessons: [] }];
      setModulesList(updated);
      setSelectedModuleId(newModule.id);
      setModuleTitle('');
      setModuleOrder(updated.length + 1);
      showToast(`Đã thêm chương: "${newModule.title}"`, 'success');
    } catch (err) {
      console.error('Create module error:', err);
      showToast('Không thể thêm chương học. Vui lòng thử lại!', 'error');
    } finally {
      setModuleLoading(false);
    }
  };

  // Step 3: Add Lesson
  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!selectedModuleId || !lessonTitle.trim()) {
      showToast('Vui lòng chọn chương và nhập tiêu đề bài học!', 'error');
      return;
    }

    try {
      setLessonLoading(true);
      const newLesson = await courseApi.createLesson({
        module: selectedModuleId,
        title: lessonTitle,
        lesson_type: lessonType,
        content: lessonContent,
        media_url: mediaUrl,
        order: Number(lessonOrder) || 1,
      });

      // Update modulesList locally with new lesson
      setModulesList((prev) =>
        prev.map((mod) => {
          if (mod.id === selectedModuleId) {
            return {
              ...mod,
              lessons: [...(mod.lessons || []), newLesson],
            };
          }
          return mod;
        })
      );

      setLessonTitle('');
      setLessonContent('');
      setMediaUrl('');
      setLessonOrder(1);
      showToast(`Đã thêm bài học "${newLesson.title}" vào chương!`, 'success');
    } catch (err) {
      console.error('Create lesson error:', err);
      showToast('Không thể thêm bài học. Vui lòng thử lại!', 'error');
    } finally {
      setLessonLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium transition-all transform animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-200'
              : 'bg-rose-600 text-white shadow-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Studio Giảng viên
          </span>
          <h1 className="text-3xl font-black text-slate-900">
            Tạo & Xuất bản Khóa học Mới
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Soạn thảo giáo trình, thiết lập các chương học và bài giảng đa phương tiện.
          </p>
        </div>

        {createdCourse && (
          <Link
            to={`/courses/${createdCourse.id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Eye className="w-4 h-4" /> Xem trước khóa học
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Step 1 - Course Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                1
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Thông tin chung Khóa học</h2>
                <p className="text-xs text-slate-400">Tiêu đề, mô tả và cấu hình hiển thị</p>
              </div>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tên khóa học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!createdCourse}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Lập trình React & Django REST Framework từ Zero"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mô tả khóa học <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  disabled={!!createdCourse}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả mục tiêu, kiến thức học được sau khóa học..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Yêu cầu đầu vào (Requirements)
                </label>
                <textarea
                  rows={2}
                  disabled={!!createdCourse}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="VD: Kiến thức cơ bản về HTML/CSS/JavaScript..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-700">Xuất bản khóa học ngay (Publish)</span>
                <input
                  type="checkbox"
                  disabled={!!createdCourse}
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {!createdCourse ? (
                <button
                  type="submit"
                  disabled={courseLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {courseLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Khởi tạo khóa học</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Khóa học đã tạo thành công (ID: #{createdCourse.id})</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right column: Step 2 & 3 - Modules & Lessons Builder (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {!createdCourse ? (
            <div className="bg-slate-100/70 border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center text-slate-500 space-y-3">
              <Layers className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="font-bold text-slate-700 text-base">Xây dựng Đề cương & Bài học</h3>
              <p className="text-xs max-w-sm mx-auto">
                Vui lòng hoàn tất bước 1 (Khởi tạo thông tin khóa học) ở cột bên trái để mở khóa tính năng thêm chương và bài giảng.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Form Add Module */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Thêm Chương mới (Module)</h3>
                </div>

                <form onSubmit={handleAddModule} className="flex gap-3">
                  <input
                    type="text"
                    required
                    value={moduleTitle}
                    onChange={(e) => setModuleTitle(e.target.value)}
                    placeholder="VD: Chương 1 - Làm quen với nền tảng"
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="number"
                    min="1"
                    value={moduleOrder}
                    onChange={(e) => setModuleOrder(e.target.value)}
                    placeholder="Thứ tự"
                    className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-center focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={moduleLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <FolderPlus className="w-4 h-4" /> Thêm
                  </button>
                </form>
              </div>

              {/* Form Add Lesson to Selected Module */}
              {modulesList.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                      3
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Thêm Bài học (Lesson) vào Chương</h3>
                  </div>

                  <form onSubmit={handleAddLesson} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Chọn chương trực thuộc
                        </label>
                        <select
                          value={selectedModuleId || ''}
                          onChange={(e) => setSelectedModuleId(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        >
                          {modulesList.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Định dạng bài học
                        </label>
                        <select
                          value={lessonType}
                          onChange={(e) => setLessonType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="text">Văn bản (Text)</option>
                          <option value="video">Video</option>
                          <option value="slide">Slide thuyết trình</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Tiêu đề bài học <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={lessonTitle}
                        onChange={(e) => setLessonTitle(e.target.value)}
                        placeholder="VD: Bài 1: Cài đặt môi trường phát triển"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {(lessonType === 'video' || lessonType === 'slide') && (
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                          Liên kết đa phương tiện (Media URL - YouTube / Slide link)
                        </label>
                        <input
                          type="url"
                          value={mediaUrl}
                          onChange={(e) => setMediaUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Nội dung chi tiết bài học
                      </label>
                      <textarea
                        rows={3}
                        value={lessonContent}
                        onChange={(e) => setLessonContent(e.target.value)}
                        placeholder="Soạn thảo lý thuyết hoặc hướng dẫn cho bài học..."
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={lessonLoading}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <PlusCircle className="w-4 h-4" /> Thêm bài học vào chương
                    </button>
                  </form>
                </div>
              )}

              {/* Preview Curriculum Tree */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Cấu trúc Đề cương Hiện tại ({modulesList.length} chương)
                </h3>

                {modulesList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 italic">
                    Chưa có chương học nào được tạo.
                  </p>
                ) : (
                  <div className="space-y-3 pt-2">
                    {modulesList.map((m, mIdx) => (
                      <div
                        key={m.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-700">
                            Chương {mIdx + 1}: {m.title}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {m.lessons?.length || 0} bài học
                          </span>
                        </div>

                        {m.lessons && m.lessons.length > 0 ? (
                          <div className="pl-3 border-l-2 border-indigo-200 space-y-1">
                            {m.lessons.map((l, lIdx) => (
                              <div
                                key={l.id || lIdx}
                                className="text-xs text-slate-600 flex items-center justify-between py-0.5"
                              >
                                <span className="truncate">
                                  {lIdx + 1}. {l.title}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 uppercase font-semibold text-slate-600">
                                  {l.lesson_type}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 pl-3 italic">
                            Chưa có bài học nào trong chương này.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateCoursePage;
