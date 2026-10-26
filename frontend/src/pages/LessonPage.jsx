import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, Presentation } from 'lucide-react';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';
import LessonComments from '../components/LessonComments';
import LessonPagination from '../components/LessonPagination';
import LoadingSpinner from '../components/LoadingSpinner';
import { buildPages } from '../utils/lessonPages';

const mediaUrl = (path) => path?.startsWith('http')
  ? path
  : `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${path || ''}`;

const youtubeEmbedUrl = (url, position = 0) => {
  try {
    const parsed = new URL(url);
    const videoId = parsed.hostname === 'youtu.be'
      ? parsed.pathname.slice(1)
      : parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
    if (!videoId) return url;
    return `https://www.youtube-nocookie.com/embed/${videoId}${position > 0 ? `?start=${Math.floor(position)}` : ''}`;
  } catch {
    return url;
  }
};

const slideEmbedUrl = (url, page) => {
  if (!url) return null;
  try {
    const parsed = new URL(mediaUrl(url));
    if (parsed.hostname === 'drive.google.com') {
      const fileId = parsed.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
      if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    if (parsed.hostname === 'docs.google.com' && parsed.pathname.includes('/presentation/d/')) {
      return `${parsed.origin}${parsed.pathname.replace(/\/edit.*$/, '/embed')}`;
    }
    if (/\.pdf$/i.test(parsed.pathname)) {
      parsed.hash = `page=${page}`;
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
};

const LessonPage = () => {
  const { id: courseId, lessonId } = useParams();
  const { isAuthenticated, isLearner } = useAuth();
  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [position, setPosition] = useState(0);
  const [page, setPage] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [courseData, lessonData, progressData] = await Promise.all([
          courseApi.getCourseDetail(courseId),
          courseApi.getLessonDetail(lessonId),
          isAuthenticated && isLearner ? courseApi.getMyProgress(courseId) : Promise.resolve([]),
        ]);
        if (!active) return;
        setCourse(courseData);
        setLesson(lessonData);
        const progress = progressData.find((item) => item.lesson_id === Number(lessonId));
        setPosition(progress?.last_position || 0);
        setPage(Math.min(progress?.last_page || 1, buildPages(lessonData).length));
        setCompleted(Boolean(progress?.is_completed));
        if (lessonData.module && lessonData.module !== courseData.modules?.find((item) => item.lessons?.some((entry) => entry.id === Number(lessonId)))?.id) {
          throw new Error('Bài học không thuộc khóa học này.');
        }
      } catch (error) {
        if (!active) return;
        console.error('Failed to load lesson:', error);
        toast.error(error.response?.data?.detail || error.message || 'Không thể tải nội dung bài học.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [courseId, lessonId, isAuthenticated, isLearner]);

  const saveProgress = async (progress) => {
    if (!isAuthenticated || !isLearner) return;
    try {
      await courseApi.updateLessonProgress(lessonId, progress);
    } catch (error) {
      console.error('Failed to save lesson progress:', error);
      toast.error('Không thể lưu tiến độ học tập.');
    }
  };

  const markComplete = async () => {
    if (!isAuthenticated) {
      toast.error('Vui lòng đăng nhập để lưu tiến độ học tập.');
      return;
    }
    setSaving(true);
    try {
      await courseApi.updateLessonProgress(lessonId, {
        is_completed: true,
        last_position: Math.floor(videoRef.current?.currentTime || position),
      });
      setCompleted(true);
      toast.success('Đã đánh dấu hoàn thành bài học.');
    } catch (error) {
      console.error('Failed to complete lesson:', error);
      toast.error('Không thể lưu tiến độ học tập.');
    } finally {
      setSaving(false);
    }
  };

  const changePage = async (nextPage) => {
    if (isAuthenticated && isLearner) {
      setSaving(true);
      try {
        await courseApi.updateLessonProgress(lessonId, { last_page: nextPage });
      } catch (error) {
        console.error('Failed to save lesson page:', error);
        toast.error('Không thể lưu trang học hiện tại.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setPage(nextPage);
  };

  if (loading) return <div className="py-20"><LoadingSpinner size="large" text="Đang tải bài học..." /></div>;
  if (!course || !lesson) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-center"><p className="text-slate-700">Không thể tìm thấy bài học này.</p><Link to={`/courses/${courseId}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Quay lại đề cương</Link></main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link to={`/courses/${courseId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" /> {course.title}</Link>
      <article className="mt-5 space-y-6 border-y border-slate-300 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{lesson.lesson_type} · {course.title}</p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-slate-950">{lesson.title}</h1>
          </div>
          {isLearner && <button type="button" onClick={markComplete} disabled={saving || completed} className="inline-flex items-center gap-2 border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {completed ? 'Đã hoàn thành' : saving ? 'Đang lưu…' : 'Đánh dấu hoàn thành'}
          </button>}
        </header>

        {(lesson.media_url || (lesson.lesson_type === 'slide' && lesson.attached_file)) && (
          lesson.lesson_type === 'video' ? (
            lesson.media_url.includes('youtube.com') || lesson.media_url.includes('youtu.be') ? (
              <div className="relative h-0 overflow-hidden bg-black pb-[56.25%]">
                <iframe className="absolute inset-0 h-full w-full border-0" src={youtubeEmbedUrl(lesson.media_url, position)} title={lesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            ) : (
              <video ref={videoRef} controls className="w-full bg-black" src={mediaUrl(lesson.media_url)} onLoadedMetadata={(event) => {
                if (position > 0 && position < event.currentTarget.duration) event.currentTarget.currentTime = position;
              }} onTimeUpdate={(event) => {
                const current = Math.floor(event.currentTarget.currentTime);
                setPosition(current);
                if (current > 0 && current % 10 === 0) saveProgress({ last_position: current, is_completed: completed });
              }} />
            )
          ) : lesson.lesson_type === 'slide' ? (() => {
            const slideSource = lesson.attached_file || lesson.media_url;
            const embedUrl = slideEmbedUrl(slideSource, page);
            return (
              <section className="space-y-3" aria-label="Tài liệu trình chiếu">
                {embedUrl ? (
                  <iframe key={`${slideSource}-${page}`} src={embedUrl} title={`Slide: ${lesson.title}`} className="h-[65vh] min-h-96 w-full border border-slate-300 bg-slate-100" allowFullScreen />
                ) : (
                  <div className="flex flex-col items-center gap-3 bg-slate-900 px-6 py-12 text-center text-white">
                    <Presentation className="h-12 w-12 text-amber-400" />
                    <h2 className="font-semibold">Tài liệu trình chiếu</h2>
                    {slideSource && <a href={mediaUrl(slideSource)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"><ExternalLink className="h-4 w-4" /> Mở slide</a>}
                  </div>
                )}
              </section>
            );
          })() : null
        )}
        {(lesson.attached_file || lesson.attachment) && <a href={mediaUrl(lesson.attached_file || lesson.attachment)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900"><FileText className="h-4 w-4" /> Tải tài liệu đính kèm</a>}
        <LessonPagination lesson={lesson} pageNumber={page} saving={saving} onPageChange={changePage} />
      </article>
      <section className="mt-8"><LessonComments lessonId={lesson.id} /></section>
    </main>
  );
};

export default LessonPage;
