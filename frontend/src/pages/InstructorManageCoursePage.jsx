import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { courseApi } from '../api/courseApi';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowLeft,
  Layers,
  BookOpen,
  Users,
  PlusCircle,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Video,
  FileText,
  Presentation,
  CheckCircle2,
  AlertCircle,
  Save,
  Sparkles,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Settings,
  FolderPlus,
  Link2
} from 'lucide-react';

const InstructorManageCoursePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('curriculum'); // 'curriculum' | 'students' | 'settings'

  // Curriculum State
  const [openModules, setOpenModules] = useState({});

  // Module Modal / Form State
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleOrder, setModuleOrder] = useState(1);
  const [moduleLoading, setModuleLoading] = useState(false);

  // Lesson Modal / Form State
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedModuleForLesson, setSelectedModuleForLesson] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState('text');
  const [lessonContent, setLessonContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [lessonOrder, setLessonOrder] = useState(1);
  const [lessonLoading, setLessonLoading] = useState(false);

  // Course Settings Form State
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsRequirements, setSettingsRequirements] = useState('');
  const [settingsIsPublished, setSettingsIsPublished] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Students Progress State
  const [studentsProgress, setStudentsProgress] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const data = await courseApi.getCourseDetail(id);
      setCourse(data);
      setSettingsTitle(data.title || '');
      setSettingsDescription(data.description || '');
      setSettingsRequirements(data.requirements || '');
      setSettingsIsPublished(!!data.is_published);

      // Open all modules by default
      if (data.modules) {
        const openState = {};
        data.modules.forEach((m) => {
          openState[m.id] = true;
        });
        setOpenModules(openState);
      }
    } catch (err) {
      console.error('Failed to load course details:', err);
      toast.error('Không thể tải thông tin chi tiết khóa học.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsProgress = async () => {
    try {
      setStudentsLoading(true);
      const data = await courseApi.getCourseStudentsProgress(id);
      setStudentsProgress(data);
    } catch (err) {
      console.error('Failed to load students progress:', err);
      toast.error('Không thể tải danh sách học viên và tiến độ.');
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseData();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudentsProgress();
    }
  }, [activeTab, id]);

  const toggleModuleAccordion = (modId) => {
    setOpenModules((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  // Quick Toggle Publish
  const handleTogglePublish = async () => {
    if (!course) return;
    try {
      const updated = await courseApi.updateCourse(course.id, {
        title: course.title,
        description: course.description,
        requirements: course.requirements || '',
        is_published: !course.is_published,
      });
      setCourse((prev) => ({ ...prev, is_published: updated.is_published }));
      setSettingsIsPublished(updated.is_published);
      toast.success(`Khóa học đã được ${updated.is_published ? 'Xuất bản' : 'Chuyển sang trạng thái Ẩn'}!`);
    } catch (err) {
      console.error('Failed to toggle publish:', err);
      toast.error('Không thể thay đổi trạng thái xuất bản.');
    }
  };

  // Module Actions
  const handleOpenAddModule = () => {
    setEditingModule(null);
    setModuleTitle('');
    setModuleOrder((course?.modules?.length || 0) + 1);
    setShowModuleModal(true);
  };

  const handleOpenEditModule = (mod) => {
    setEditingModule(mod);
    setModuleTitle(mod.title);
    setModuleOrder(mod.order || 1);
    setShowModuleModal(true);
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;

    try {
      setModuleLoading(true);
      if (editingModule) {
        const updated = await courseApi.updateModule(editingModule.id, {
          course: editingModule.course,
          title: moduleTitle,
          order: Number(moduleOrder),
        });
        toast.success(`Đã cập nhật chương: "${updated.title}"`);
      } else {
        const created = await courseApi.createModule({
          course: Number(id),
          title: moduleTitle,
          order: Number(moduleOrder),
        });
        toast.success(`Đã thêm chương: "${created.title}"`);
      }
      setShowModuleModal(false);
      await fetchCourseData();
    } catch (err) {
      console.error('Save module error:', err);
      toast.error('Lưu chương học thất bại. Vui lòng thử lại!');
    } finally {
      setModuleLoading(false);
    }
  };

  const handleDeleteModule = async (modId, title) => {
    if (!window.confirm(`Bạn có chắc muốn xóa chương "${title}" và tất cả bài học bên trong?`)) {
      return;
    }

    try {
      await courseApi.deleteModule(modId);
      toast.success(`Đã xóa chương "${title}".`);
      await fetchCourseData();
    } catch (err) {
      console.error('Delete module error:', err);
      toast.error('Xóa chương thất bại.');
    }
  };

  // Lesson Actions
  const handleOpenAddLesson = (mod) => {
    setSelectedModuleForLesson(mod);
    setEditingLesson(null);
    setLessonTitle('');
    setLessonType('text');
    setLessonContent('');
    setMediaUrl('');
    setLessonOrder((mod.lessons?.length || 0) + 1);
    setShowLessonModal(true);
  };

  const handleOpenEditLesson = (mod, lesson) => {
    setSelectedModuleForLesson(mod);
    setEditingLesson(lesson);
    setLessonTitle(lesson.title);
    setLessonType(lesson.lesson_type || 'text');
    setLessonContent(lesson.content || '');
    setMediaUrl(lesson.media_url || '');
    setLessonOrder(lesson.order || 1);
    setShowLessonModal(true);
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    if (!lessonTitle.trim() || !selectedModuleForLesson) return;

    try {
      setLessonLoading(true);
      if (editingLesson) {
        const updated = await courseApi.updateLesson(editingLesson.id, {
          module: editingLesson.module,
          title: lessonTitle,
          lesson_type: lessonType,
          content: lessonContent,
          media_url: mediaUrl,
          order: Number(lessonOrder),
        });
        toast.success(`Đã cập nhật bài học: "${updated.title}"`);
      } else {
        const created = await courseApi.createLesson({
          module: selectedModuleForLesson.id,
          title: lessonTitle,
          lesson_type: lessonType,
          content: lessonContent,
          media_url: mediaUrl,
          order: Number(lessonOrder),
        });
        toast.success(`Đã thêm bài học: "${created.title}"`);
      }
      setShowLessonModal(false);
      await fetchCourseData();
    } catch (err) {
      console.error('Save lesson error:', err);
      toast.error('Lưu bài học thất bại. Vui lòng thử lại!');
    } finally {
      setLessonLoading(false);
    }
  };

  const handleDeleteLesson = async (lessonId, title) => {
    if (!window.confirm(`Bạn có chắc muốn xóa bài học "${title}"?`)) {
      return;
    }

    try {
      await courseApi.deleteLesson(lessonId);
      toast.success(`Đã xóa bài học "${title}".`);
      await fetchCourseData();
    } catch (err) {
      console.error('Delete lesson error:', err);
      toast.error('Xóa bài học thất bại.');
    }
  };

  // Course Settings Save
  const handleSaveCourseSettings = async (e) => {
    e.preventDefault();
    if (!settingsTitle.trim() || !settingsDescription.trim()) {
      toast.error('Tiêu đề và mô tả không được để trống!');
      return;
    }

    try {
      setSettingsLoading(true);
      const updated = await courseApi.updateCourse(id, {
        title: settingsTitle,
        description: settingsDescription,
        requirements: settingsRequirements,
        is_published: settingsIsPublished,
      });
      setCourse(updated);
      toast.success('Cập nhật thông tin khóa học thành công!');
    } catch (err) {
      console.error('Update course settings error:', err);
      toast.error('Cập nhật thất bại. Vui lòng thử lại!');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleDeleteCourseEntire = async () => {
    if (!window.confirm(`CẢNH BÁO: Xóa khóa học "${course?.title}" sẽ xóa toàn bộ chương, bài học và dữ liệu học tập liên quan. Bạn có chắc chắn không?`)) {
      return;
    }

    try {
      await courseApi.deleteCourse(id);
      toast.success('Đã xóa khóa học thành công!');
      navigate('/instructor/courses');
    } catch (err) {
      console.error('Delete course error:', err);
      toast.error('Xóa khóa học thất bại.');
    }
  };

  // Helper for Lesson Type Icon
  const getLessonTypeIcon = (type) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-indigo-500" />;
      case 'slide':
        return <Presentation className="w-4 h-4 text-amber-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="large" text="Đang tải dữ liệu khóa học..." />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Không tìm thấy khóa học</h2>
        <Link
          to="/instructor/courses"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  const filteredStudents = studentsProgress.filter(
    (s) =>
      s.username.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(studentSearch.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Navigation Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/instructor/courses"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Khóa học của tôi
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to={`/courses/${course.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4" /> Xem với tư cách học viên
          </Link>

          <button
            onClick={handleTogglePublish}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs ${
              course.is_published
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
            }`}
          >
            {course.is_published ? (
              <>
                <Eye className="w-3.5 h-3.5" /> Đang Xuất bản (Bấm để Ẩn)
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" /> Đang Ẩn (Bấm để Xuất bản)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Course Banner Info */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
            Quản lý khóa học #{course.id}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            {course.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 max-w-2xl">
            {course.description}
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 shrink-0">
          <div className="text-center px-3 border-r border-slate-200">
            <span className="block text-lg font-black text-indigo-600">
              {course.modules?.length || 0}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Chương</span>
          </div>
          <div className="text-center px-3">
            <span className="block text-lg font-black text-purple-600">
              {course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Bài học</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('curriculum')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'curriculum'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" /> Đề cương & Bài giảng
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'students'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" /> Danh sách Sinh viên & Tiến độ
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" /> Cài đặt khóa học
        </button>
      </div>

      {/* Tab 1: Curriculum Management */}
      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Cấu trúc Chương & Bài học</h2>
              <p className="text-xs text-slate-500">Tạo, chỉnh sửa, xóa hoặc bổ sung tài liệu học tập.</p>
            </div>

            <button
              onClick={handleOpenAddModule}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <FolderPlus className="w-4 h-4" /> Thêm Chương mới (Module)
            </button>
          </div>

          {/* Module list */}
          {(!course.modules || course.modules.length === 0) ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
              <Layers className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Chưa có chương học nào</h3>
              <p className="text-xs text-slate-500">Hãy thêm chương học đầu tiên để bắt đầu thêm bài giảng.</p>
              <button
                onClick={handleOpenAddModule}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 transition-colors"
              >
                + Thêm Chương đầu tiên
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {course.modules.map((mod, modIdx) => {
                const isOpen = !!openModules[mod.id];
                return (
                  <div
                    key={mod.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Module Row Header */}
                    <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-slate-50/60 border-b border-slate-100">
                      <div
                        onClick={() => toggleModuleAccordion(mod.id)}
                        className="flex items-center gap-3 cursor-pointer flex-1"
                      >
                        {isOpen ? (
                          <ChevronDown className="w-5 h-5 text-indigo-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                        )}
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                            Chương {modIdx + 1} (Thứ tự: {mod.order})
                          </span>
                          <h3 className="text-base font-bold text-slate-900">{mod.title}</h3>
                        </div>
                      </div>

                      {/* Module Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleOpenAddLesson(mod)}
                          title="Thêm bài học vào chương này"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Thêm Bài
                        </button>

                        <button
                          onClick={() => handleOpenEditModule(mod)}
                          title="Sửa tên chương"
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteModule(mod.id, mod.title)}
                          title="Xóa chương này"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Lessons inside module */}
                    {isOpen && (
                      <div className="p-4 sm:p-5 space-y-2">
                        {(!mod.lessons || mod.lessons.length === 0) ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
                            Chưa có bài học nào trong chương này.{' '}
                            <button
                              onClick={() => handleOpenAddLesson(mod)}
                              className="text-indigo-600 font-semibold underline ml-1"
                            >
                              Thêm bài học ngay
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                            {mod.lessons.map((lesson, lessonIdx) => (
                              <div
                                key={lesson.id}
                                className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-start sm:items-center gap-3 flex-1 overflow-hidden">
                                  <div className="p-2 bg-slate-100 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                                    {getLessonTypeIcon(lesson.lesson_type)}
                                  </div>

                                  <div className="overflow-hidden">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-800 truncate">
                                        Bài {lessonIdx + 1}: {lesson.title}
                                      </span>
                                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                        {lesson.lesson_type}
                                      </span>
                                    </div>

                                    {lesson.media_url && (
                                      <a
                                        href={lesson.media_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline mt-0.5 truncate max-w-md"
                                      >
                                        <Link2 className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{lesson.media_url}</span>
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {/* Lesson Actions */}
                                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                  <button
                                    onClick={() => handleOpenEditLesson(mod, lesson)}
                                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                  >
                                    <Edit className="w-3.5 h-3.5" /> Sửa
                                  </button>

                                  <button
                                    onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Students Progress Management */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Danh sách Sinh viên & Tiến độ</h2>
              <p className="text-xs text-slate-500">
                Theo dõi tiến độ hoàn thành các bài giảng của học viên đã đăng ký khóa học này.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm học viên theo tên/email..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {studentsLoading ? (
            <div className="py-16">
              <LoadingSpinner size="default" text="Đang tải danh sách học viên..." />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Chưa có học viên nào</h3>
              <p className="text-xs text-slate-500">
                {studentSearch ? 'Không tìm thấy học viên phù hợp với từ khóa.' : 'Chưa có sinh viên nào đăng ký tham gia khóa học này.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Học viên</th>
                      <th className="px-5 py-3.5">Email</th>
                      <th className="px-5 py-3.5">Ngày đăng ký</th>
                      <th className="px-5 py-3.5">Bài đã xong</th>
                      <th className="px-5 py-3.5 min-w-[180px]">Tiến độ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredStudents.map((stu) => (
                      <tr key={stu.student_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-900 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {stu.username ? stu.username.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span>{stu.username}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-500">{stu.email || 'Chưa cập nhật'}</td>
                        <td className="px-5 py-4 text-slate-500">
                          {stu.enrolled_at ? new Date(stu.enrolled_at).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="px-5 py-4 font-medium">
                          <span className="text-indigo-600 font-bold">{stu.completed_lessons}</span> / {stu.total_lessons}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-600">{stu.progress_percent}%</span>
                              {stu.progress_percent === 100 && (
                                <span className="text-emerald-600 text-[10px] font-bold">Hoàn thành</span>
                              )}
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  stu.progress_percent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${stu.progress_percent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Settings */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
              Thông tin Khóa học & Cấu hình
            </h2>

            <form onSubmit={handleSaveCourseSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  Tiêu đề Khóa học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  Mô tả Khóa học <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  Yêu cầu đầu vào (Requirements)
                </label>
                <textarea
                  rows={2}
                  value={settingsRequirements}
                  onChange={(e) => setSettingsRequirements(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="block text-xs font-bold text-slate-800">Xuất bản khóa học</span>
                  <span className="text-[11px] text-slate-500">
                    Khi bật, học viên có thể tìm thấy và đăng ký khóa học này.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settingsIsPublished}
                  onChange={(e) => setSettingsIsPublished(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={settingsLoading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                {settingsLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Lưu thay đổi
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="bg-rose-50/70 p-6 rounded-3xl border border-rose-200 space-y-3">
            <h3 className="text-sm font-bold text-rose-800">Vùng nguy hiểm</h3>
            <p className="text-xs text-rose-600">
              Xóa vĩnh viễn khóa học này cùng toàn bộ bài học và tiến độ của sinh viên.
            </p>
            <button
              onClick={handleDeleteCourseEntire}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Trash2 className="w-4 h-4" /> Xóa toàn bộ khóa học này
            </button>
          </div>
        </div>
      )}

      {/* Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <h3 className="text-base font-bold text-slate-900">
              {editingModule ? 'Chỉnh sửa Chương học' : 'Thêm Chương mới (Module)'}
            </h3>

            <form onSubmit={handleSaveModule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Tiêu đề Chương <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={moduleTitle}
                  onChange={(e) => setModuleTitle(e.target.value)}
                  placeholder="VD: Chương 1: Căn bản React"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Thứ tự hiển thị
                </label>
                <input
                  type="number"
                  min="1"
                  value={moduleOrder}
                  onChange={(e) => setModuleOrder(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModuleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={moduleLoading}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  {moduleLoading ? 'Đang lưu...' : editingModule ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <h3 className="text-base font-bold text-slate-900">
              {editingLesson
                ? `Sửa Bài học trong "${selectedModuleForLesson?.title}"`
                : `Thêm Bài học mới vào "${selectedModuleForLesson?.title}"`}
            </h3>

            <form onSubmit={handleSaveLesson} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Định dạng bài học
                </label>
                <select
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="text">Văn bản (Text content)</option>
                  <option value="video">Video (YouTube / Direct MP4 URL)</option>
                  <option value="slide">Slide thuyết trình (Google Drive / Canva / SlideShare)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Tiêu đề Bài học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="VD: Bài 1: Giới thiệu cấu trúc Component"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Liên kết Đa phương tiện / Drive / Slide / Video URL
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://drive.google.com/... hoặc https://youtube.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Đính kèm link Google Drive, YouTube, Vimeo hoặc tài liệu Slide trực tuyến.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nội dung chi tiết (Văn bản / Hướng dẫn)
                </label>
                <textarea
                  rows={4}
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Soạn thảo lý thuyết, bài tập hoặc ghi chú đính kèm..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Thứ tự bài học
                </label>
                <input
                  type="number"
                  min="1"
                  value={lessonOrder}
                  onChange={(e) => setLessonOrder(e.target.value)}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={lessonLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  {lessonLoading ? 'Đang lưu...' : editingLesson ? 'Cập nhật bài học' : 'Thêm bài học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorManageCoursePage;
