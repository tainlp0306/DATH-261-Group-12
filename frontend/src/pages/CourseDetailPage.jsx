import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import LessonComments from '../components/LessonComments';
import QuizModal from '../components/QuizModal';
import {
  ChevronDown,
  ChevronRight,
  PlayCircle,
  FileText,
  Presentation,
  CheckCircle2,
  BookOpen,
  User,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Award,
  Layers,
  AlertCircle,
  HelpCircle,
  Clock,
} from 'lucide-react';

const getYoutubeEmbedUrl = (mediaUrl, startPosition = 0) => {
  try {
    const videoUrl = new URL(mediaUrl);
    const videoId = videoUrl.hostname === 'youtu.be'
      ? videoUrl.pathname.slice(1)
      : videoUrl.searchParams.get('v') || videoUrl.pathname.split('/').pop();
    if (!videoId) return mediaUrl;
    const startParam = startPosition > 0 ? `?start=${Math.floor(startPosition)}` : '';
    return `https://www.youtube-nocookie.com/embed/${videoId}${startParam}`;
  } catch {
    return mediaUrl;
  }
};

const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Active lesson selected
  const [activeLesson, setActiveLesson] = useState(null);
  const [openModules, setOpenModules] = useState({});
  const [completedLessons, setCompletedLessons] = useState(new Set());
  const [lessonPositions, setLessonPositions] = useState({});
  const [savingProgress, setSavingProgress] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const lastSavedPosition = useRef({ lessonId: null, position: 0, saving: false });
  const videoPlayerRef = useRef(null);

  // Quizzes state
  const [quizzes, setQuizzes] = useState([]);
  const [activeQuizModal, setActiveQuizModal] = useState(null);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        setError('');
        const progressRequest = isAuthenticated
          ? courseApi.getMyProgress(id).catch((progressError) => {
              console.warn('Could not fetch user progress:', progressError);
              return null;
            })
          : Promise.resolve(null);
        const data = await courseApi.getCourseDetail(id);
        setCourse(data);

        // Fetch Quizzes for this course if available
        if (data.quizzes && Array.isArray(data.quizzes)) {
          setQuizzes(data.quizzes);
        } else {
          try {
            const courseQuizzes = await courseApi.getCourseQuizzes(id);
            setQuizzes(Array.isArray(courseQuizzes) ? courseQuizzes : []);
          } catch (e) {
            console.warn('Could not load course quizzes directly:', e);
          }
        }

        let lastPositionLessonId = null;

        // Check enrollment status and restore progress from backend
        if (isAuthenticated) {
          try {
            const [enrollments, myProgress] = await Promise.all([
              courseApi.getMyEnrollments(),
              progressRequest,
            ]);
            const enrolled = enrollments.some((e) => e.course === Number(id));
            setIsEnrolled(enrolled);

            if (Array.isArray(myProgress)) {
              setLessonPositions(
                Object.fromEntries(
                  myProgress.map((progress) => [progress.lesson_id, progress.last_position || 0])
                )
              );
              setCompletedLessons(
                new Set(myProgress.filter((progress) => progress.is_completed).map((progress) => progress.lesson_id))
              );

              const lastStudied = myProgress[0];
              if (lastStudied) {
                lastPositionLessonId = lastStudied.lesson_id;
              }
            }
          } catch (e) {
            console.warn('Could not fetch user enrollments/progress:', e);
          }
        }

        // Open modules and select appropriate lesson
        if (data.modules && data.modules.length > 0) {
          const initialOpenState = {};
          let targetLesson = null;

          data.modules.forEach((mod) => {
            initialOpenState[mod.id] = true; // Open modules for quick navigation
            if (lastPositionLessonId && !targetLesson) {
              const found = mod.lessons?.find((l) => l.id === lastPositionLessonId);
              if (found) targetLesson = found;
            }
          });

          setOpenModules(initialOpenState);

          if (!targetLesson) {
            targetLesson = data.modules[0]?.lessons?.[0];
          }

          if (targetLesson) {
            setActiveLesson(targetLesson);
          }
        }
      } catch (err) {
        console.error('Failed to load course details:', err);
        setError('Không thể tải thông tin khóa học. Khóa học có thể không tồn tại hoặc đã bị xóa.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [id, isAuthenticated]);

  const toggleModule = (moduleId) => {
    setOpenModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handleSelectLesson = (lesson) => {
    setActiveLesson(lesson);
    lastSavedPosition.current = {
      lessonId: lesson.id,
      position: lessonPositions[lesson.id] || 0,
      saving: false,
    };
  };

  const handleVideoTimeUpdate = async (event) => {
    if (!isAuthenticated || !activeLesson) return;
    const position = Math.floor(event.currentTarget.currentTime);
    const saved = lastSavedPosition.current;
    if (position < 1 || position % 10 !== 0 || saved.saving ||
        (saved.lessonId === activeLesson.id && saved.position === position)) return;

    lastSavedPosition.current = { lessonId: activeLesson.id, position, saving: true };
    try {
      await courseApi.updateLessonProgress(activeLesson.id, {
        is_completed: completedLessons.has(activeLesson.id),
        last_position: position,
      });
      setLessonPositions((previous) => ({ ...previous, [activeLesson.id]: position }));
      lastSavedPosition.current = { lessonId: activeLesson.id, position, saving: false };
    } catch (err) {
      lastSavedPosition.current = { lessonId: activeLesson.id, position: saved.position, saving: false };
      console.warn('Could not save video position:', err);
    }
  };

  const handleCompleteLesson = async () => {
    if (!activeLesson) return;
    if (!isAuthenticated) {
      toast.error('Vui lòng đăng nhập để lưu tiến độ học tập!');
      return;
    }

    const lastPosition = activeLesson.lesson_type === 'video'
      ? Math.floor(videoPlayerRef.current?.currentTime || lessonPositions[activeLesson.id] || 0)
      : 0;

    try {
      setSavingProgress(true);
      await courseApi.updateLessonProgress(activeLesson.id, {
        is_completed: true,
        last_position: lastPosition,
      });

      setCompletedLessons((prev) => new Set([...prev, activeLesson.id]));
      setLessonPositions((prev) => ({ ...prev, [activeLesson.id]: lastPosition }));
      toast.success('🎉 Tuyệt vời! Bạn đã hoàn thành bài học này.');
    } catch (err) {
      console.error('Failed to update progress:', err);
      toast.error('Không thể lưu tiến độ học tập. Vui lòng thử lại!');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleEnrollCourse = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      await courseApi.enrollCourse(course.id);
      setIsEnrolled(true);
      toast.success('Đăng ký khóa học thành công! Bắt đầu học ngay.');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Đăng ký thất bại';
      toast.error(msg);
    }
  };

  // Helper to get lesson icon
  const getLessonIcon = (type, isCompleted) => {
    if (isCompleted) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    switch (type) {
      case 'video':
        return <PlayCircle className="w-4 h-4 text-indigo-500 shrink-0" />;
      case 'slide':
        return <Presentation className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  // Calculate total lessons & completed percentage
  const totalLessonsCount = course?.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0;
  const progressPercent = totalLessonsCount > 0
    ? Math.round((completedLessons.size / totalLessonsCount) * 100)
    : 0;

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner size="large" text="Đang tải nội dung khóa học..." />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Không tìm thấy khóa học</h2>
        <p className="text-slate-500 text-sm">{error}</p>
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Tất cả khóa học
        </Link>

        {!isEnrolled && (
          <button
            onClick={handleEnrollCourse}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Đăng ký học khóa này
          </button>
        )}
      </div>

      {/* Course Title Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Khóa học LingoSphere
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            {course.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              Giảng viên: <strong className="text-slate-700 font-semibold">{course.instructor_username || 'LMS Instructor'}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              {course.modules?.length || 0} chương học
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
              {totalLessonsCount} bài học
            </span>
            {quizzes.length > 0 && (
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                {quizzes.length} bài kiểm tra
              </span>
            )}
          </div>
        </div>

        {/* Progress bar (if enrolled) */}
        {totalLessonsCount > 0 && (
          <div className="md:w-64 bg-slate-50 p-3.5 rounded-xl border border-slate-200 shrink-0">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-600 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" /> Tiến độ học tập
              </span>
              <span className="text-indigo-600">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Learning Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Module & Lesson Curriculum Accordions + Quizzes (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Đề cương khóa học
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Chọn bài học để bắt đầu học</p>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {(!course.modules || course.modules.length === 0) ? (
                <div className="p-6 text-center text-sm text-slate-400">
                  Chưa có chương học nào được tạo.
                </div>
              ) : (
                course.modules.map((mod, modIdx) => {
                  const isOpen = !!openModules[mod.id];
                  return (
                    <div key={mod.id} className="transition-colors">
                      {/* Module Accordion Header */}
                      <button
                        onClick={() => toggleModule(mod.id)}
                        className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-indigo-600 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div>
                            <span className="text-xs font-bold text-indigo-600 block uppercase tracking-wider">
                              Chương {modIdx + 1}
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              {mod.title}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-400">
                          {mod.lessons?.length || 0} bài
                        </span>
                      </button>

                      {/* Nested Lessons */}
                      {isOpen && (
                        <div className="bg-slate-50/50 py-1.5 px-2 space-y-1">
                          {(!mod.lessons || mod.lessons.length === 0) ? (
                            <p className="text-xs text-slate-400 px-4 py-2 italic">
                              Chưa có bài học trong chương này.
                            </p>
                          ) : (
                            mod.lessons.map((lesson, lessonIdx) => {
                              const isSelected = activeLesson?.id === lesson.id;
                              const isCompleted = completedLessons.has(lesson.id);

                              return (
                                <button
                                  key={lesson.id}
                                  onClick={() => handleSelectLesson(lesson)}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white font-medium shadow-xs'
                                      : 'text-slate-700 hover:bg-slate-100/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    {getLessonIcon(lesson.lesson_type, isCompleted)}
                                    <span className="text-xs truncate">
                                      {lessonIdx + 1}. {lesson.title}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                      isSelected
                                        ? 'bg-indigo-700 text-indigo-100'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {lesson.lesson_type}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quizzes Sidebar Card */}
          {quizzes.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                Bài kiểm tra trắc nghiệm ({quizzes.length})
              </h3>
              <div className="space-y-2">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/70 flex items-center justify-between gap-2"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{quiz.title}</h4>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {quiz.time_limit_minutes || 15} phút • {quiz.questions?.length || 0} câu hỏi
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveQuizModal(quiz)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-[11px] rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                    >
                      Làm bài
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Active Lesson Viewer & Comments (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeLesson ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
              {/* Header of Active Lesson */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 mb-2">
                    {getLessonIcon(activeLesson.lesson_type, completedLessons.has(activeLesson.id))}
                    Định dạng: {activeLesson.lesson_type.toUpperCase()}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {activeLesson.title}
                  </h2>
                </div>

                {/* Mark Completed Button */}
                <button
                  onClick={handleCompleteLesson}
                  disabled={savingProgress || completedLessons.has(activeLesson.id)}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-xs cursor-pointer ${
                    completedLessons.has(activeLesson.id)
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  } disabled:opacity-75`}
                >
                  {savingProgress ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : completedLessons.has(activeLesson.id) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Đã hoàn thành</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Hoàn thành bài học</span>
                    </>
                  )}
                </button>
              </div>

              {/* Media Player / Slide Viewer if exists */}
              {activeLesson.media_url && (
                <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner">
                  {activeLesson.lesson_type === 'video' ? (
                    activeLesson.media_url.includes('youtube.com') || activeLesson.media_url.includes('youtu.be') ? (
                      <div className="relative pb-[56.25%] h-0">
                        <iframe
                          src={getYoutubeEmbedUrl(activeLesson.media_url, lessonPositions[activeLesson.id])}
                          title={activeLesson.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute top-0 left-0 w-full h-full border-0"
                        />
                      </div>
                    ) : (
                      <video
                        ref={videoPlayerRef}
                        key={activeLesson.id}
                        controls
                        className="w-full aspect-video"
                        src={activeLesson.media_url}
                        onLoadedMetadata={(event) => {
                          const position = lessonPositions[activeLesson.id] || 0;
                          if (position > 0 && position < event.currentTarget.duration) {
                            event.currentTarget.currentTime = position;
                          }
                        }}
                        onTimeUpdate={handleVideoTimeUpdate}
                      />
                    )
                  ) : activeLesson.lesson_type === 'slide' ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center text-white space-y-3 bg-slate-800">
                      <Presentation className="w-16 h-16 text-amber-400" />
                      <h4 className="text-base font-bold">Tài liệu thuyết trình (Slide)</h4>
                      <p className="text-xs text-slate-300 max-w-md">
                        Xem trực tiếp hoặc mở bản trình chiếu của bài học tại liên kết đính kèm.
                      </p>
                      <a
                        href={activeLesson.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-xs transition-colors shadow-md"
                      >
                        <ExternalLink className="w-4 h-4" /> Xem Slide thuyết trình
                      </a>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Lesson Text Content */}
              <div className="prose prose-slate max-w-none">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Nội dung chi tiết bài học
                </h3>
                {activeLesson.content ? (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-normal">
                    {activeLesson.content}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    Bài học này không có phần văn bản bổ sung.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-slate-700">Chọn một bài học từ đề cương</h3>
              <p className="text-sm text-slate-500">
                Nhấp vào danh sách bài học bên trái để xem nội dung bài giảng và làm bài tập.
              </p>
            </div>
          )}

          {/* Discussion & Comments section for active lesson */}
          {activeLesson && (
            <LessonComments lessonId={activeLesson.id} />
          )}

          {/* Course Overview Details */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Giới thiệu khóa học</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {course.description || 'Chưa có mô tả chi tiết.'}
            </p>

            {course.requirements && (
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Yêu cầu đầu vào
                </h4>
                <p className="text-sm text-slate-600 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/60 leading-relaxed">
                  {course.requirements}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quiz Modal Popup */}
      {activeQuizModal && (
        <QuizModal
          quiz={activeQuizModal}
          onClose={() => setActiveQuizModal(null)}
          onCompleted={(res) => {
            console.log('Quiz completed result:', res);
          }}
        />
      )}
    </div>
  );
};

export default CourseDetailPage;
