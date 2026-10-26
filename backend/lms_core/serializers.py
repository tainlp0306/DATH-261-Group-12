from rest_framework import serializers
from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import (
    AdminLog, Comment, Course, Enrollment, Lesson, LessonProgress, Module,
    LessonPage, Notification, Question, Quiz, QuizSubmission, Report, Test, TestSubmission,
    Assignment, Submission
)

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'role', 'is_active', 'date_joined', 'last_login')
        extra_kwargs = {'password': {'write_only': True}}
        read_only_fields = ('is_active', 'date_joined', 'last_login')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data.get('role', 'learner')
        )
        return user

class LessonPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonPage
        fields = ('id', 'page_number', 'content')
        read_only_fields = ('id', 'page_number')


class LessonSerializer(serializers.ModelSerializer):
    pages = LessonPageSerializer(many=True, required=False)

    class Meta:
        model = Lesson
        fields = ('id', 'module', 'title', 'lesson_type', 'content', 'media_url', 'attached_file', 'pages', 'order')

    def create(self, validated_data):
        pages = validated_data.pop('pages', [])
        lesson = Lesson.objects.create(**validated_data)
        LessonPage.objects.bulk_create([
            LessonPage(lesson=lesson, page_number=index, content=page['content'])
            for index, page in enumerate(pages, start=1)
        ])
        return lesson

    def update(self, instance, validated_data):
        pages = validated_data.pop('pages', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if pages is not None:
            instance.pages.all().delete()
            LessonPage.objects.bulk_create([
                LessonPage(lesson=instance, page_number=index, content=page['content'])
                for index, page in enumerate(pages, start=1)
            ])
        return instance

    def validate_attached_file(self, value):
        if value and value.size > 25 * 1024 * 1024:
            raise serializers.ValidationError('Tệp học liệu không được vượt quá 25 MB.')
        return value


class LessonOutlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ('id', 'module', 'title', 'lesson_type', 'order')


class AssignmentOutlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = ('id', 'title', 'assignment_type', 'deadline', 'time_limit_minutes', 'is_published', 'publish_at')


class ModuleOutlineSerializer(serializers.ModelSerializer):
    lessons = LessonOutlineSerializer(many=True, read_only=True)
    assignments = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ('id', 'course', 'title', 'order', 'lessons', 'assignments')

    def get_assignments(self, module):
        request = self.context.get('request')
        if request and getattr(request.user, 'role', None) in ('instructor', 'admin'):
            assignments = module.assignments.all()
        else:
            from django.utils import timezone
            assignments = module.assignments.filter(
                is_published=True,
            ).filter(Q(publish_at__isnull=True) | Q(publish_at__lte=timezone.now()))
        return AssignmentOutlineSerializer(assignments, many=True, context=self.context).data

class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    assignments = AssignmentOutlineSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ('id', 'course', 'title', 'order', 'lessons', 'assignments')

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ('id', 'content', 'option_a', 'option_b', 'option_c', 'option_d')

class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = ('id', 'course', 'title', 'time_limit_minutes', 'questions')

class CourseSerializer(serializers.ModelSerializer):
    instructor_username = serializers.ReadOnlyField(source='instructor.username')
    modules = ModuleSerializer(many=True, read_only=True)
    prerequisites = serializers.PrimaryKeyRelatedField(many=True, queryset=Course.objects.all(), required=False)
    prerequisite_titles = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = (
            'id', 'title', 'description', 'prerequisites',
            'prerequisite_titles', 'instructor', 'instructor_username', 'is_published',
            'created_at', 'modules'
        )
        read_only_fields = ('instructor',)

    def get_prerequisite_titles(self, course):
        return list(course.prerequisites.order_by('title').values_list('title', flat=True))

    def validate_prerequisites(self, prerequisites):
        if self.instance and any(course.pk == self.instance.pk for course in prerequisites):
            raise serializers.ValidationError('Khóa học không thể là prerequisite của chính nó.')
        return prerequisites


class CourseOptionSerializer(serializers.ModelSerializer):
    instructor_username = serializers.ReadOnlyField(source='instructor.username')

    class Meta:
        model = Course
        fields = ('id', 'title', 'instructor_username')


class CourseOutlineSerializer(CourseSerializer):
    modules = ModuleOutlineSerializer(many=True, read_only=True)

    class Meta(CourseSerializer.Meta):
        fields = CourseSerializer.Meta.fields

class EnrollmentSerializer(serializers.ModelSerializer):
    course_title = serializers.ReadOnlyField(source='course.title')

    class Meta:
        model = Enrollment
        fields = ('id', 'student', 'course', 'course_title', 'enrolled_at')
        read_only_fields = ('student',)

class LessonProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonProgress
        fields = ('id', 'student', 'lesson', 'is_completed', 'last_position', 'last_page', 'updated_at')
        read_only_fields = ('student',)


class CommentSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Comment
        fields = ('id', 'lesson', 'user', 'username', 'content', 'created_at')
        read_only_fields = ('user', 'lesson')


class TestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Test
        fields = ('id', 'course', 'title', 'test_type', 'time_limit_minutes')
        read_only_fields = ('course',)


class TestSubmissionSerializer(serializers.ModelSerializer):
    student_username = serializers.ReadOnlyField(source='student.username')
    test_title = serializers.ReadOnlyField(source='test.title')

    class Meta:
        model = TestSubmission
        fields = (
            'id', 'student', 'student_username', 'test', 'test_title', 'score',
            'submitted_file', 'submitted_file_url', 'feedback', 'submitted_at',
        )
        read_only_fields = ('student', 'test', 'score', 'feedback', 'submitted_at')

    def validate_submitted_file(self, value):
        if value and value.size > 25 * 1024 * 1024:
            raise serializers.ValidationError('Tệp bài nộp không được vượt quá 25 MB.')
        return value


class NotificationSerializer(serializers.ModelSerializer):
    course_title = serializers.ReadOnlyField(source='course.title', default=None)

    class Meta:
        model = Notification
        fields = ('id', 'title', 'message', 'course', 'course_title', 'target_url', 'is_read', 'created_at')


class ReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.ReadOnlyField(source='reported_by.username')
    comment_content = serializers.ReadOnlyField(source='comment.content')

    class Meta:
        model = Report
        fields = (
            'id', 'reported_by', 'reporter_username', 'comment',
            'comment_content', 'reason', 'is_resolved', 'created_at',
        )
        read_only_fields = ('reported_by', 'created_at')


class AdminLogSerializer(serializers.ModelSerializer):
    admin_username = serializers.ReadOnlyField(source='admin.username')

    class Meta:
        model = AdminLog
        fields = ('id', 'admin', 'admin_username', 'action', 'created_at')

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'content', 'option_a', 'option_b', 'option_c', 'option_d'] 

class AssignmentQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'content', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'attachment']
        read_only_fields = ['id']
        extra_kwargs = {'correct_option': {'write_only': True}}

    def validate_correct_option(self, value):
        normalized = value.upper()
        if normalized not in ('A', 'B', 'C', 'D'):
            raise serializers.ValidationError('Đáp án đúng phải là A, B, C hoặc D.')
        return normalized

    def validate_attachment(self, value):
        if value and value.size > 20 * 1024 * 1024:
            raise serializers.ValidationError('Tệp đính kèm câu hỏi không được vượt quá 20 MB.')
        return value


class AssignmentSerializer(serializers.ModelSerializer):
    questions = AssignmentQuestionSerializer(many=True, required=False)

    class Meta:
        model = Assignment
        fields = [
            'id', 'course', 'module', 'title', 'description', 'prompt_file',
            'assignment_type', 'time_limit_minutes', 'deadline', 'is_published',
            'publish_at', 'questions', 'created_at',
        ]
        read_only_fields = ['id', 'course', 'created_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        assignment_type = attrs.get('assignment_type', getattr(self.instance, 'assignment_type', 'quiz'))
        questions = attrs.get('questions')
        question_count = len(questions) if questions is not None else (
            self.instance.questions.count() if self.instance else 0
        )
        if assignment_type == 'quiz' and question_count == 0:
            raise serializers.ValidationError({'questions': ['Bài trắc nghiệm cần ít nhất một câu hỏi.']})
        if assignment_type == 'file' and questions:
            raise serializers.ValidationError({'questions': ['Bài nộp tệp không nhận câu hỏi trắc nghiệm.']})
        if self.instance and assignment_type != self.instance.assignment_type and self.instance.submissions.exists():
            raise serializers.ValidationError({
                'assignment_type': ['Không thể đổi loại bài tập sau khi học viên đã nộp bài.'],
            })
        return attrs

    def get_fields(self):
        fields = super().get_fields()
        if self.context.get('include_correct_options'):
            fields['questions'].child.fields['correct_option'].write_only = False
        return fields

    def validate_module(self, value):
        view = self.context.get('view')
        course = view.get_course()
        if value and value.course_id != course.id:
            raise serializers.ValidationError('Chương phải thuộc khóa học đang quản lý.')
        return value

    def validate_prompt_file(self, value):
        if value and value.size > 25 * 1024 * 1024:
            raise serializers.ValidationError('Tệp đề bài không được vượt quá 25 MB.')
        return value

    def create(self, validated_data):
        questions = validated_data.pop('questions', [])
        assignment = Assignment.objects.create(**validated_data)
        Question.objects.bulk_create([
            Question(assignment=assignment, **question) for question in questions
        ])
        return assignment

    @transaction.atomic
    def update(self, instance, validated_data):
        questions = validated_data.pop('questions', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if questions is not None:
            existing = list(instance.questions.order_by('id'))
            for index, values in enumerate(questions):
                if index < len(existing):
                    question = existing[index]
                    for field, value in values.items():
                        setattr(question, field, value)
                    question.save()
                else:
                    question = Question.objects.create(assignment=instance, **values)
            for removed in existing[len(questions):]:
                removed.delete()

            current_questions = list(Question.objects.filter(assignment=instance))
            if current_questions:
                for submission in instance.submissions.all():
                    answers = submission.answers or {}
                    correct = sum(
                        1 for question in current_questions
                        if str(answers.get(str(question.id), '')).upper() == question.correct_option.upper()
                    )
                    submission.score = round(correct / len(current_questions) * 10, 2)
                    submission.save(update_fields=['score'])
        if hasattr(instance, '_prefetched_objects_cache'):
            instance._prefetched_objects_cache = {}
        return instance

class SubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.username')

    class Meta:
        model = Submission
        fields = [
            'id', 'assignment', 'student', 'student_name', 'submitted_file',
            'score', 'feedback', 'answers', 'submitted_at',
        ]
        read_only_fields = ['student', 'score', 'feedback', 'answers', 'submitted_at']

    def validate_submitted_file(self, value):
        if value and value.size > 20 * 1024 * 1024:
            raise serializers.ValidationError('Tệp bài nộp không được vượt quá 20 MB.')
        return value
