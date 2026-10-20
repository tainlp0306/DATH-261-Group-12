from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from lms_core.models import (
    AdminLog,
    Assignment,
    Comment,
    Course,
    Enrollment,
    Lesson,
    LessonPage,
    LessonProgress,
    Module,
    Notification,
    Question,
    Report,
    Submission,
)


DEMO_PASSWORD = 'LingoDemo2026!'


class Command(BaseCommand):
    help = 'Create repeatable sample data for testing the LingoSphere LMS.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            default=DEMO_PASSWORD,
            help='Password to set for all demo accounts (default: LingoDemo2026!).',
        )

    def handle(self, *args, **options):
        password = options['password']
        User = get_user_model()

        instructor = self.get_user(
            User, 'demo_instructor', 'instructor', 'demo_instructor@lingosphere.local', password,
        )
        learner = self.get_user(
            User, 'demo_learner', 'learner', 'demo_learner@lingosphere.local', password,
        )
        learner_two = self.get_user(
            User, 'demo_learner2', 'learner', 'demo_learner2@lingosphere.local', password,
        )
        admin = self.get_user(
            User, 'demo_admin', 'admin', 'demo_admin@lingosphere.local', password,
        )

        prerequisite, _ = Course.objects.update_or_create(
            instructor=instructor,
            title='DEMO - Nhập môn tiếng Anh',
            defaults={
                'description': 'Khóa học demo ở trạng thái draft để kiểm tra quyền riêng tư và khóa tiên quyết.',
                'is_published': False,
            },
        )
        course, _ = Course.objects.update_or_create(
            instructor=instructor,
            title='DEMO - Tiếng Anh giao tiếp cơ bản',
            defaults={
                'description': 'Khóa học mẫu để kiểm tra nội dung, tiến độ, quiz và bài tập nộp tệp.',
                'is_published': True,
            },
        )
        course.prerequisites.set([prerequisite])

        module_one, _ = Module.objects.update_or_create(
            course=course,
            title='Chương 1 - Bắt đầu',
            defaults={'order': 1},
        )
        module_two, _ = Module.objects.update_or_create(
            course=course,
            title='Chương 2 - Luyện tập',
            defaults={'order': 2},
        )
        text_lesson, _ = Lesson.objects.update_or_create(
            module=module_one,
            title='Bài 1 - Chào hỏi cơ bản',
            defaults={
                'lesson_type': 'text',
                'content': (
                    'Mục tiêu: làm quen với lời chào và giới thiệu tên.\n\n'
                    'Hello! My name is Anna. Nice to meet you.\n\n'
                    'Thực hành: viết một câu giới thiệu bản thân.'
                ),
                'media_url': '',
                'order': 1,
            },
        )
        video_lesson, _ = Lesson.objects.update_or_create(
            module=module_one,
            title='Bài 2 - Luyện nghe',
            defaults={
                'lesson_type': 'video',
                'content': 'Xem video và ghi lại ba cụm từ nghe được.',
                'media_url': 'https://youtu.be/dQw4w9WgXcQ',
                'order': 2,
            },
        )
        slide_lesson, _ = Lesson.objects.update_or_create(
            module=module_two,
            title='Bài 3 - Từ vựng theo chủ đề',
            defaults={
                'lesson_type': 'slide',
                'content': 'Đọc từng trang tài liệu, sau đó tải tệp đính kèm để kiểm tra.',
                'media_url': '',
                'order': 1,
            },
        )
        Lesson.objects.update_or_create(
            module=module_two,
            title='Bài 4 - Chưa bắt đầu',
            defaults={
                'lesson_type': 'text',
                'content': 'Bài này chưa có tiến độ mẫu; dùng để kiểm tra trạng thái chưa học.',
                'media_url': '',
                'order': 2,
            },
        )

        if not slide_lesson.attached_file:
            slide_lesson.attached_file.save(
                'demo-vocabulary-notes.txt',
                ContentFile(b'DEMO LINGOSPHERE\nVocabulary: greeting, classroom, practice.\n'),
                save=True,
            )
        LessonPage.objects.update_or_create(
            lesson=slide_lesson,
            page_number=1,
            defaults={'content': 'Trang 1: Hello - Xin chao. Goodbye - Tam biet.'},
        )
        LessonPage.objects.update_or_create(
            lesson=slide_lesson,
            page_number=2,
            defaults={'content': 'Trang 2: Nice to meet you - Rat vui duoc gap ban.'},
        )

        Enrollment.objects.get_or_create(student=learner, course=course)
        Enrollment.objects.get_or_create(student=learner_two, course=course)
        Enrollment.objects.get_or_create(student=learner, course=prerequisite)
        LessonProgress.objects.update_or_create(
            student=learner,
            lesson=text_lesson,
            defaults={'is_completed': True, 'last_position': 0, 'last_page': 1},
        )
        LessonProgress.objects.update_or_create(
            student=learner,
            lesson=video_lesson,
            defaults={'is_completed': False, 'last_position': 74, 'last_page': 1},
        )
        LessonProgress.objects.update_or_create(
            student=learner,
            lesson=slide_lesson,
            defaults={'is_completed': False, 'last_position': 0, 'last_page': 2},
        )

        now = timezone.now()
        quiz, _ = Assignment.objects.update_or_create(
            course=course,
            title='DEMO - Quiz chương 1',
            defaults={
                'description': 'Quiz mẫu bốn câu, có thời gian giới hạn và hạn nộp trong tương lai.',
                'assignment_type': 'quiz',
                'time_limit_minutes': 12,
                'deadline': now + timedelta(days=14),
            },
        )
        question_data = [
            ('How do you say "Xin chao" in English?', 'Goodbye', 'Hello', 'Please', 'Thanks', 'B'),
            ('Choose the correct introduction.', 'My name Anna.', 'I name is Anna.', 'My name is Anna.', 'Name my Anna.', 'C'),
            ('What does "Nice to meet you" express?', 'A greeting when meeting someone', 'A farewell', 'An apology', 'A question about time', 'A'),
            ('Choose the correct response to "Thank you".', 'Good night', 'You are welcome', 'Excuse me', 'See you yesterday', 'B'),
        ]
        question_texts = [item[0] for item in question_data]
        quiz.questions.exclude(content__in=question_texts).delete()
        for content, option_a, option_b, option_c, option_d, correct_option in question_data:
            Question.objects.update_or_create(
                assignment=quiz,
                content=content,
                defaults={
                    'option_a': option_a,
                    'option_b': option_b,
                    'option_c': option_c,
                    'option_d': option_d,
                    'correct_option': correct_option,
                },
            )
        Submission.objects.update_or_create(
            assignment=quiz,
            student=learner_two,
            defaults={'score': 7.5, 'feedback': 'Hệ thống chấm tự động: đúng 3/4 câu.'},
        )

        file_assignment, _ = Assignment.objects.update_or_create(
            course=course,
            title='DEMO - Nộp bài giới thiệu bản thân',
            defaults={
                'description': 'Nộp tệp TXT hoặc PDF. Bài của demo_learner đang chờ chấm.',
                'assignment_type': 'file',
                'time_limit_minutes': None,
                'deadline': now + timedelta(days=10),
            },
        )
        self.create_file_submission(
            file_assignment,
            learner,
            'demo-learner-submission.txt',
            b'My name is Demo Learner. I am learning English at LingoSphere.\n',
        )
        past_assignment, _ = Assignment.objects.update_or_create(
            course=course,
            title='DEMO - Bài tệp đã chấm',
            defaults={
                'description': 'Bài mẫu đã có điểm và phản hồi để kiểm tra lịch sử học viên.',
                'assignment_type': 'file',
                'time_limit_minutes': None,
                'deadline': now + timedelta(days=5),
            },
        )
        graded_submission = self.create_file_submission(
            past_assignment,
            learner_two,
            'demo-graded-submission.txt',
            b'This sample submission is already graded.\n',
        )
        graded_submission.score = 8.5
        graded_submission.feedback = 'Bài làm rõ ràng. Hãy bổ sung thêm một ví dụ ở lần sau.'
        graded_submission.save(update_fields=['score', 'feedback'])
        Assignment.objects.update_or_create(
            course=course,
            title='DEMO - Bài tệp đã quá hạn',
            defaults={
                'description': 'Dùng để kiểm tra nút nộp bị khóa khi quá hạn.',
                'assignment_type': 'file',
                'time_limit_minutes': None,
                'deadline': now - timedelta(days=1),
            },
        )

        comment, _ = Comment.objects.get_or_create(
            user=learner,
            lesson=text_lesson,
            content='DEMO: Can you explain when to use "Nice to meet you"?',
        )
        Report.objects.get_or_create(
            reported_by=learner,
            comment=comment,
            reason='DEMO: sample report for the admin review screen.',
        )
        Notification.objects.get_or_create(
            user=learner,
            course=course,
            title='DEMO - Chào mừng',
            message='Bạn đã được ghi danh vào khóa học mẫu LingoSphere.',
        )
        AdminLog.objects.get_or_create(
            admin=admin,
            action='DEMO: sample admin audit log entry.',
        )

        self.stdout.write(self.style.SUCCESS('Đã tạo/cập nhật dữ liệu demo LingoSphere.'))
        self.stdout.write(f'Tài khoản demo dùng chung mật khẩu: {password}')
        self.stdout.write('Tài khoản: demo_admin, demo_instructor, demo_learner, demo_learner2')
        self.stdout.write(f'Khóa học chính: /courses/{course.pk}')
        self.stdout.write(f'Khóa học draft: /courses/{prerequisite.pk} (chỉ admin, giảng viên sở hữu hoặc học viên đã ghi danh xem được)')

    @staticmethod
    def get_user(User, username, role, email, password):
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={'email': email, 'role': role},
        )
        user.email = email
        user.role = role
        user.is_active = True
        if role == 'admin':
            user.is_staff = True
            user.is_superuser = True
        user.set_password(password)
        user.save()
        return user

    @staticmethod
    def create_file_submission(assignment, student, filename, content):
        submission, _ = Submission.objects.get_or_create(
            assignment=assignment,
            student=student,
        )
        if not submission.submitted_file:
            submission.submitted_file.save(filename, ContentFile(content), save=True)
        return submission