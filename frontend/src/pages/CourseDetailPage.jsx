import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Award, BookOpen, CheckCircle2, Clock3, FileText, Layers, PlayCircle, Presentation, User } from 'lucide-react';
import { courseApi } from '../api/courseApi';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const lessonIcon = (type) => {
  if (type === 'video') return <PlayCircle className="h-4 w-4 text-indigo-600" />;
  if (type === 'slide') return <Presentation className="h-4 w-4 text-amber-600" />;
  return <FileText className="h-4 w-4 text-slate-500" />;
};

const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLearner, isInstructor } = useAuth();
  const [course, setCourse] = useState(null);
  const [unassignedAssignments, setUnassignedAssignments] = useState([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [courseData, enrollments] = await Promise.all([
          courseApi.getCourseDetail(id),
          isAuthenticated ? courseApi.getMyEnrollments() : Promise.resolve([]),
        ]);
        if (!active) return;
        setCourse(courseData);
        const enrolled = enrollments.some((enrollment) => enrollment.course === Number(id));
        setIsEnrolled(enrolled);
        if (isInstructor || enrolled) {
          try {
            const assignmentResponse = await courseApi.getCourseAssignments(id);
            const assignmentList = Array.isArray(assignmentResponse) ? assignmentResponse : assignmentResponse?.results || [];
            if (active) setUnassignedAssignments(assignmentList.filter((assignment) => !assignment.module));
          } catch (assignmentError) {
            console.warn('Could not load unassigned course assignments:', assignmentError);
          }
        }
      } catch (loadError) {
        if (!active) return;
        console.error('Failed to load course outline:', loadError);
        setError('Không thể tải khóa học. Khóa học có thể không tồn tại hoặc bạn chưa có quyền truy cập.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, isAuthenticated, isInstructor]);

  const enroll = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      await courseApi.enrollCourse(course.id);
      setIsEnrolled(true);
      toast.success('Đăng ký khóa học thành công.');
    } catch (enrollError) {
      toast.error(enrollError.response?.data?.error || enrollError.response?.data?.message || 'Đăng ký khóa học thất bại.');
    }
  };

  if (loading) return <div className="py-20"><LoadingSpinner size="large" text="Đang tải đề cương khóa học..." /></div>;
  if (error || !course) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Không tìm thấy khóa học</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <Link to="/courses" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><ArrowLeft className="h-4 w-4" /> Danh sách khóa học</Link>
      </main>
    );
  }

  const modules = [...(course.modules || [])].sort((left, right) => left.order - right.order);
  const totalLessons = modules.reduce((total, module) => total + (module.lessons?.length || 0), 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-5">
        <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" /> Tất cả khóa học</Link>
        {isLearner && !isEnrolled && (
          <button type="button" onClick={enroll} className="bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Đăng ký khóa học</button>
        )}
      </div>

      <header className="py-6">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Đề cương khóa học</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-slate-950">{course.title}</h1>
        <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate-600">{course.description}</p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4" /> {course.instructor_username || 'Giảng viên LingoSphere'}</span>
          <span className="inline-flex items-center gap-1.5"><Layers className="h-4 w-4" /> {modules.length} chương</span>
          <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {totalLessons} bài học</span>
        </div>
        {course.prerequisite_titles?.length > 0 && (
          <p className="mt-3 text-xs text-slate-600">Tiên quyết: {course.prerequisite_titles.join(', ')}</p>
        )}
        {isLearner && !isEnrolled && <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-amber-900">Đăng ký khóa học để mở nội dung bài học và bài tập.</p>}
      </header>

      <section className="border-y border-slate-300" aria-label="Chương, bài học và bài tập">
        {modules.length === 0 ? <p className="py-8 text-sm text-slate-500">Khóa học chưa có chương học.</p> : modules.map((module, index) => {
          const lessons = [...(module.lessons || [])].sort((left, right) => left.order - right.order);
          const assignments = module.assignments || [];
          const canOpenContent = isInstructor || isEnrolled;
          return (
            <section key={module.id} className="border-b border-slate-200 last:border-b-0">
              <header className="flex flex-wrap items-baseline justify-between gap-2 bg-slate-50 px-4 py-4">
                <h2 className="font-semibold text-slate-900">Chương {index + 1}: {module.title}</h2>
                <span className="text-xs text-slate-500">{lessons.length} bài học · {assignments.length} bài tập</span>
              </header>
              <ul className="divide-y divide-slate-100">
                {lessons.map((lesson, lessonIndex) => (
                  <li key={lesson.id}>
                    {canOpenContent ? (
                      <Link to={`/courses/${course.id}/lessons/${lesson.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-slate-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">
                        {lessonIcon(lesson.lesson_type)}<span className="flex-1">{lessonIndex + 1}. {lesson.title}</span><span className="text-xs capitalize text-slate-500">{lesson.lesson_type}</span>
                      </Link>
                    ) : (
                      <div className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-slate-700">
                        {lessonIcon(lesson.lesson_type)}<span className="flex-1">{lessonIndex + 1}. {lesson.title}</span><span className="text-xs text-amber-800">Đăng ký để mở</span>
                      </div>
                    )}
                  </li>
                ))}
                {assignments.map((assignment) => (
                  <li key={`assignment-${assignment.id}`}>
                    {canOpenContent ? (
                      <Link to={`/courses/${course.id}/assignments/${assignment.id}`} className="flex min-h-14 items-center gap-3 border-l-2 border-amber-400 bg-amber-50/30 px-4 py-3 text-sm text-slate-800 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700">
                        <Award className="h-4 w-4 text-amber-700" /><span className="flex-1">{assignment.title}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">{assignment.assignment_type === 'quiz' ? <Clock3 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}{assignment.assignment_type === 'quiz' ? 'Trắc nghiệm' : 'Nộp tệp'}</span>
                      </Link>
                    ) : (
                      <div className="flex min-h-14 items-center gap-3 border-l-2 border-amber-400 bg-amber-50/30 px-4 py-3 text-sm text-slate-700">
                        <Award className="h-4 w-4 text-amber-700" /><span className="flex-1">{assignment.title}</span><span className="text-xs text-amber-800">Đăng ký để mở</span>
                      </div>
                    )}
                  </li>
                ))}
                {!lessons.length && !assignments.length && <li className="px-4 py-4 text-sm text-slate-500">Chương này chưa có bài học hoặc bài tập.</li>}
              </ul>
            </section>
          );
        })}
      </section>
      {unassignedAssignments.length > 0 && (
        <section className="mt-8 border-y border-slate-300" aria-label="Bài tập chưa gắn chương">
          <h2 className="bg-slate-50 px-4 py-4 font-semibold text-slate-900">Bài tập khác</h2>
          <ul className="divide-y divide-slate-100">
            {unassignedAssignments.map((assignment) => (
              <li key={assignment.id}>
                <Link to={`/courses/${course.id}/assignments/${assignment.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm text-slate-800 hover:bg-amber-50">
                  <Award className="h-4 w-4 text-amber-700" /><span className="flex-1">{assignment.title}</span><span className="text-xs text-slate-500">{assignment.assignment_type === 'quiz' ? 'Trắc nghiệm' : 'Nộp tệp'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {isEnrolled && <p className="mt-4 inline-flex items-center gap-2 text-xs text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Bạn đã đăng ký khóa học này.</p>}
    </main>
  );
};

export default CourseDetailPage;
