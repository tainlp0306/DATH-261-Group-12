from rest_framework import serializers
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
    prerequisites = serializers.PrimaryKeyRelatedField(many=True, queryset=Course.objects.all(), required=False)

    class Meta:
        model = Course
        fields = (
            'id', 'title', 'description', 'prerequisites',
            'instructor', 'instructor_username', 'is_published', 
            'created_at', 'modules'
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

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'content', 'option_a', 'option_b', 'option_c', 'option_d'] 

class AssignmentQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'content', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option']
        read_only_fields = ['id']
        extra_kwargs = {'correct_option': {'write_only': True}}

    def validate_correct_option(self, value):
        normalized = value.upper()
        if normalized not in ('A', 'B', 'C', 'D'):
            raise serializers.ValidationError('Đáp án đúng phải là A, B, C hoặc D.')
        return normalized


class AssignmentSerializer(serializers.ModelSerializer):
    questions = AssignmentQuestionSerializer(many=True, required=False)

    class Meta:
        model = Assignment
        fields = ['id', 'course', 'title', 'description', 'assignment_type', 'time_limit_minutes', 'deadline', 'questions', 'created_at']
        read_only_fields = ['id', 'course', 'created_at']

    def validate(self, attrs):
        assignment_type = attrs.get('assignment_type', getattr(self.instance, 'assignment_type', 'quiz'))
        questions = attrs.get('questions', [])
        if assignment_type == 'quiz' and not questions and self.instance is None:
            raise serializers.ValidationError({'questions': ['Bài trắc nghiệm cần ít nhất một câu hỏi.']})
        if assignment_type == 'file' and questions:
            raise serializers.ValidationError({'questions': ['Bài nộp tệp không nhận câu hỏi trắc nghiệm.']})
        return attrs

    def create(self, validated_data):
        questions = validated_data.pop('questions', [])
        assignment = Assignment.objects.create(**validated_data)
        Question.objects.bulk_create([
            Question(assignment=assignment, **question) for question in questions
        ])
        return assignment

class SubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.username')

    class Meta:
        model = Submission
        fields = ['id', 'assignment', 'student', 'student_name', 'submitted_file', 'score', 'feedback', 'submitted_at']
        read_only_fields = ['student', 'score', 'feedback', 'submitted_at']




