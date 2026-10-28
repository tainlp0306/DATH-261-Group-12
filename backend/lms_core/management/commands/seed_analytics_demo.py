from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from lms_core.analytics import log_learning_event
from lms_core.models import (
    Assignment,
    Course,
    Enrollment,
    LearningEvent,
    Lesson,
    LessonProgress,
    Module,
    Question,
    Submission,
)

DEMO_COURSE_TITLE = 'DEMO - Learning Analytics Early Warning'
DEMO_PASSWORD = 'LingoDemo2026!'


class Command(BaseCommand):
    help = 'Create a repeatable simulated cohort for the Learning Analytics demo.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Replace only this command’s demo course and accounts.')
        parser.add_argument('--password', default=DEMO_PASSWORD, help='Password assigned to demo accounts.')

    def handle(self, *args, **options):
        User = get_user_model()
        instructor, _ = User.objects.get_or_create(
            username='analytics_demo_instructor',
            defaults={
                'email': 'analytics_demo_instructor@lingosphere.local',
                'role': 'instructor',
            },
        )
        instructor.email = 'analytics_demo_instructor@lingosphere.local'
        instructor.role = 'instructor'
        instructor.is_active = True
        instructor.set_password(options['password'])
        instructor.save()

        if options['reset']:
            Course.objects.filter(
                title=DEMO_COURSE_TITLE,
                instructor=instructor,
            ).delete()
            User.objects.filter(username__startswith='analytics_demo_learner_').delete()

        course, _ = Course.objects.update_or_create(
            title=DEMO_COURSE_TITLE,
            instructor=instructor,
            defaults={
                'description': 'Cohort mô phỏng để trình diễn tiến độ, kết quả và cảnh báo sớm.',
                'is_published': True,
            },
        )
        module, _ = Module.objects.update_or_create(
            course=course,
            title='Nội dung mẫu',
            defaults={'order': 1},
        )
        lessons = []
        for index in range(10):
            lesson, _ = Lesson.objects.update_or_create(
                module=module,
                title=f'Bài học mô phỏng {index + 1}',
                defaults={
                    'lesson_type': 'text',
                    'content': f'Nội dung mô phỏng {index + 1}',
                    'order': index + 1,
                },
            )
            lessons.append(lesson)

        assignments = []
        for index in range(3):
            assignment, _ = Assignment.objects.update_or_create(
                course=course,
                title=f'Quiz mô phỏng {index + 1}',
                defaults={'assignment_type': 'quiz', 'is_published': True},
            )
            Question.objects.get_or_create(
                assignment=assignment,
                content='Câu hỏi mô phỏng',
                defaults={
                    'option_a': 'A',
                    'option_b': 'B',
                    'option_c': 'C',
                    'option_d': 'D',
                    'correct_option': 'A',
                },
            )
            assignments.append(assignment)

        LearningEvent.objects.filter(course=course).delete()
        now = timezone.now()
        personas = ('on_track', 'slow_progress', 'inactive', 'quiz_struggle')
        counts = {'at_risk': 0, 'watch': 0, 'ok': 0}
        for index in range(24):
            persona = personas[index % len(personas)]
            username = f'analytics_demo_learner_{index + 1:02d}'
            learner, _ = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@lingosphere.local',
                    'role': 'learner',
                },
            )
            learner.email = f'{username}@lingosphere.local'
            learner.role = 'learner'
            learner.is_active = True
            learner.set_password(options['password'])
            learner.save()

            enrolled_days, completed_count, active_days_ago = {
                'on_track': (18, 8, 1),
                'slow_progress': (18, 2, 1),
                'inactive': (21, 5, 10),
                'quiz_struggle': (18, 7, 1),
            }[persona]
            enrollment, _ = Enrollment.objects.get_or_create(student=learner, course=course)
            enrolled_at = now - timedelta(days=enrolled_days)
            Enrollment.objects.filter(pk=enrollment.pk).update(enrolled_at=enrolled_at)

            for lesson in lessons:
                LessonProgress.objects.filter(student=learner, lesson=lesson).delete()
            for lesson_index, lesson in enumerate(lessons[:completed_count]):
                completed_at = now - timedelta(days=max(active_days_ago, completed_count - lesson_index))
                progress = LessonProgress.objects.create(
                    student=learner,
                    lesson=lesson,
                    is_completed=True,
                )
                LessonProgress.objects.filter(pk=progress.pk).update(updated_at=completed_at)
                log_learning_event(
                    actor=learner,
                    course=course,
                    lesson=lesson,
                    event_type='lesson_completed',
                    payload={'lesson_id': lesson.id},
                    occurred_at=completed_at,
                    source='seed',
                )

            scores = {
                'on_track': (8, 9, 8),
                'slow_progress': (7, 7, 8),
                'inactive': (7, 6, 8),
                'quiz_struggle': (3, 4, 2),
            }[persona]
            for assignment_index, score in enumerate(scores):
                submitted_at = now - timedelta(days=max(active_days_ago, 3 - assignment_index))
                submission, _ = Submission.objects.update_or_create(
                    assignment=assignments[assignment_index],
                    student=learner,
                    defaults={'score': score, 'feedback': 'Dữ liệu mô phỏng'},
                )
                Submission.objects.filter(pk=submission.pk).update(submitted_at=submitted_at)
                log_learning_event(
                    actor=learner,
                    course=course,
                    assignment=assignments[assignment_index],
                    event_type='quiz_submitted',
                    payload={
                        'assignment_id': assignments[assignment_index].id,
                        'score': score,
                    },
                    occurred_at=submitted_at,
                    source='seed',
                )

        self.stdout.write(self.style.SUCCESS(
            f'Cohort mô phỏng sẵn sàng: khóa học "{course.title}", '
            f'giảng viên analytics_demo_instructor, 24 học viên. '
            f'Mật khẩu demo: {options["password"]}'
        ))
