from django.contrib import admin
from .models import (
    User, Course, Module, Lesson, Enrollment, LessonProgress,
    Vocabulary, VocabularyProgress, PracticeLog, Assignment, Submission
)

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'email', 'role', 'is_staff')
    list_filter = ('role', 'is_staff')

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'instructor', 'is_published', 'created_at')
    search_fields = ('title',)
    list_filter = ('is_published',)

@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'course', 'order')
    list_filter = ('course',)

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'module', 'lesson_type', 'order')
    list_filter = ('lesson_type',)

@admin.register(Vocabulary)
class VocabularyAdmin(admin.ModelAdmin):
    list_display = ('id', 'word', 'meaning', 'course')
    search_fields = ('word', 'meaning')

@admin.register(VocabularyProgress)
class VocabularyProgressAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'vocabulary', 'interval', 'repetitions', 'ease_factor', 'next_review_date')
    search_fields = ('student__username', 'vocabulary__word')

@admin.register(PracticeLog)
class PracticeLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'vocabulary', 'is_correct', 'response_time_ms', 'attempt_date')
    list_filter = ('is_correct',)
    search_fields = ('student__username', 'vocabulary__word')