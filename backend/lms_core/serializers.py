from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    AdminLog, Comment, Course, Enrollment, Lesson, LessonProgress, Module,
    LessonPage, Notification, Question, Quiz, QuizSubmission, Report, Test, TestSubmission,
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

class LessonSerializer(serializers.ModelSerializer):
    pages = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = ('id', 'module', 'title', 'lesson_type', 'content', 'media_url', 'attached_file', 'pages', 'order')

    def get_pages(self, lesson):
        return LessonPageSerializer(lesson.pages.order_by('page_number'), many=True).data

    def validate_attached_file(self, value):
        if value and value.size > 25 * 1024 * 1024:
            raise serializers.ValidationError('Tệp học liệu không được vượt quá 25 MB.')
        return value


class LessonPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonPage
        fields = ('id', 'page_number', 'content')


class LessonOutlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ('id', 'module', 'title', 'lesson_type', 'order')


class ModuleOutlineSerializer(serializers.ModelSerializer):
    lessons = LessonOutlineSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ('id', 'course', 'title', 'order', 'lessons')

class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ('id', 'course', 'title', 'order', 'lessons')

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
    quizzes = QuizSerializer(many=True, read_only=True)
    prerequisites = serializers.PrimaryKeyRelatedField(many=True, queryset=Course.objects.all(), required=False)

    class Meta:
        model = Course
        fields = (
            'id', 'title', 'description', 'prerequisites',
            'instructor', 'instructor_username', 'is_published', 
            'created_at', 'modules', 'quizzes'
        )
        read_only_fields = ('instructor',)

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
    class Meta:
        model = Notification
        fields = ('id', 'title', 'message', 'course', 'is_read', 'created_at')


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





