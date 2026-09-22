from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    LEARNER = 'learner'
    INSTRUCTOR = 'instructor'
    ADMIN = 'admin'
    ROLE_CHOICES = [
        (LEARNER, 'Learner'),
        (INSTRUCTOR, 'Instructor'),
        (ADMIN, 'Admin'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=LEARNER)
    
    def __str__(self):
        return f"{self.username} ({self.role})"

class Course(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    requirements = models.TextField(blank=True, null=True) # Yêu cầu đầu vào
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='courses')
    is_published = models.BooleanField(default=False) # Trạng thái xuất bản/ẩn
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title

class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=255)
    order = models.IntegerField(default=0) # Thứ tự chương
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"

class Lesson(models.Model):
    TYPE_CHOICES = [('video', 'Video'), ('text', 'Văn bản'), ('slide', 'Slide')]
    
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    lesson_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='text')
    content = models.TextField(blank=True, null=True) # Nội dung chữ
    media_url = models.URLField(blank=True, null=True) # Link video/slide
    order = models.IntegerField(default=0)
    
    def __str__(self):
        return self.title

class Enrollment(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('student', 'course')

class LessonProgress(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='progress')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    last_position = models.IntegerField(default=0) # Lưu số giây video đã xem để học tiếp
    updated_at = models.DateTimeField(auto_now=True)

class Test(models.Model):
    TYPE_CHOICES = [('quiz', 'Trắc nghiệm'), ('file', 'Nộp tệp')]
    
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='tests')
    title = models.CharField(max_length=255)
    test_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='quiz')
    time_limit_minutes = models.IntegerField(blank=True, null=True) # Thời gian làm bài
    
    def __str__(self):
        return self.title

class TestSubmission(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submissions')
    test = models.ForeignKey(Test, on_delete=models.CASCADE)
    score = models.FloatField(blank=True, null=True) # Điểm số
    submitted_file_url = models.URLField(blank=True, null=True) # Link file bài làm (nếu có)
    submitted_at = models.DateTimeField(auto_now_add=True)

class Comment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class Report(models.Model):
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE)
    reason = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Vocabulary(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='vocabularies')
    word = models.CharField(max_length=100)
    meaning = models.CharField(max_length=255)
    stroke_data = models.JSONField(blank=True, null=True) # Lưu data nét vẽ/tọa độ

class PracticeLog(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.CASCADE)
    is_correct = models.BooleanField(default=False)
    attempt_date = models.DateTimeField(auto_now_add=True)