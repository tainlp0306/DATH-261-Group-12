from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Course, Module, Lesson, Enrollment, LessonProgress

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'role')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            role=validated_data.get('role', 'learner')
        )
        return user

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ('id', 'module', 'title', 'lesson_type', 'content', 'media_url', 'order')

class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ('id', 'course', 'title', 'order', 'lessons')

class CourseSerializer(serializers.ModelSerializer):
    instructor_username = serializers.ReadOnlyField(source='instructor.username')
    modules = ModuleSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = (
            'id', 'title', 'description', 'requirements', 
            'instructor', 'instructor_username', 'is_published', 
            'created_at', 'modules'
        )
        read_only_fields = ('instructor',)

class EnrollmentSerializer(serializers.ModelSerializer):
    course_title = serializers.ReadOnlyField(source='course.title')

    class Meta:
        model = Enrollment
        fields = ('id', 'student', 'course', 'course_title', 'enrolled_at')
        read_only_fields = ('student',)

class LessonProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonProgress
        fields = ('id', 'student', 'lesson', 'is_completed', 'last_position', 'updated_at')
        read_only_fields = ('student',)







