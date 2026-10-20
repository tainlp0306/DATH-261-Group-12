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
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='courses')
    prerequisites = models.ManyToManyField('self', blank=True, symmetrical=False, related_name='required_by')
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title

class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=255)
    order = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.course.title} - {self.title}"

class Lesson(models.Model):
    TYPE_CHOICES = [('text', 'Văn bản'), ('slide', 'Slide đính kèm'), ('video', 'Video Link')]
    
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    lesson_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='text')
    content = models.TextField(blank=True, null=True)
    media_url = models.URLField(blank=True, null=True)
    attached_file = models.FileField(upload_to='lessons/files/', blank=True, null=True)
    order = models.IntegerField(default=0)
    
    def __str__(self):
        return self.title

class Enrollment(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    is_passed = models.BooleanField(default=False)

class LessonProgress(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='progress')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    last_position = models.IntegerField(default=0)
    last_page = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

class Test(models.Model):
    TYPE_CHOICES = [('quiz', 'Trắc nghiệm'), ('file', 'Nộp tệp')]
    
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='tests')
    title = models.CharField(max_length=255)
    test_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='quiz')
    time_limit_minutes = models.IntegerField(blank=True, null=True)
    
    def __str__(self):
        return self.title

class TestSubmission(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submissions')
    test = models.ForeignKey(Test, on_delete=models.CASCADE)
    score = models.FloatField(blank=True, null=True)
    submitted_file_url = models.URLField(blank=True, null=True)
    submitted_file = models.FileField(upload_to='submissions/', blank=True, null=True)
    feedback = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

class Comment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='comments', null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='comments', null=True, blank=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class Report(models.Model):
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True)
    reason = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class Vocabulary(models.Model):
    TYPING = 'typing'
    STROKE = 'stroke'
    KIND_CHOICES = [
        (TYPING, 'Gõ'),
        (STROKE, 'Vẽ nét'),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='vocabularies')
    word = models.CharField(max_length=255)
    meaning = models.CharField(max_length=255, blank=True)
    romaji = models.CharField(max_length=255, blank=True)
    kind = models.CharField(max_length=16, choices=KIND_CHOICES, default=TYPING)
    stroke_data = models.JSONField(blank=True, null=True)

class PracticeLog(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    vocabulary = models.ForeignKey(Vocabulary, on_delete=models.CASCADE)
    is_correct = models.BooleanField(default=False)
    attempt_date = models.DateTimeField(auto_now_add=True)

class Quiz(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='quizzes')
    title = models.CharField(max_length=255)
    time_limit_minutes = models.IntegerField(default=15)



class QuizSubmission(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    score = models.FloatField()
    submitted_at = models.DateTimeField(auto_now_add=True)


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255, default='Thông báo')
    message = models.CharField(max_length=255)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class AdminLog(models.Model):
    admin = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

class EmailOTP(models.Model):
    PURPOSE_CHOICES = [
        ('registration', 'Registration'),
        ('password_reset', 'Password reset'),
    ]

    email = models.EmailField(db_index=True)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(blank=True, null=True)
    attempts = models.PositiveSmallIntegerField(default=0)

class LessonPage(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='pages')
    page_number = models.IntegerField(default=1)
    content = models.TextField()

class LearningEvent(models.Model):
    LESSON_COMPLETED = 'lesson_completed'
    QUIZ_SUBMITTED = 'quiz_submitted'
    FILE_SUBMITTED = 'file_submitted'
    PRACTICE_ATTEMPT = 'practice_attempt'
    ENROLLED = 'enrolled'
    EVENT_TYPES = [
        (LESSON_COMPLETED, 'Hoàn thành bài học'),
        (QUIZ_SUBMITTED, 'Nộp quiz'),
        (FILE_SUBMITTED, 'Nộp bài tệp'),
        (PRACTICE_ATTEMPT, 'Luyện tập'),
        (ENROLLED, 'Ghi danh'),
    ]

    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='learning_events')
    course = models.ForeignKey(Course, null=True, on_delete=models.CASCADE, related_name='learning_events')
    lesson = models.ForeignKey(Lesson, null=True, blank=True, on_delete=models.SET_NULL)
    assignment = models.ForeignKey('Assignment', null=True, blank=True, on_delete=models.SET_NULL)
    event_type = models.CharField(max_length=32, choices=EVENT_TYPES)
    payload = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(db_index=True)
    source = models.CharField(max_length=16, default='web')

    class Meta:
        indexes = [
            models.Index(fields=['course', 'occurred_at'], name='lms_core_le_course_occur_idx'),
            models.Index(fields=['actor', 'course', 'occurred_at'], name='lms_core_le_actor_course_idx'),
            models.Index(fields=['course', 'event_type', 'occurred_at'], name='lms_core_le_type_occur_idx'),
        ]


class Intervention(models.Model):
    NOTIFY = 'notify'
    SUGGEST_REVIEW = 'suggest_review'

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='interventions')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='interventions_received')
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='interventions_sent')
    action = models.CharField(max_length=32)
    notification = models.ForeignKey(Notification, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

class SystemLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)


class Assignment(models.Model):
    ASSIGNMENT_TYPES = [('quiz', 'Trắc nghiệm'), ('file', 'Bài tập nộp tệp')]
    
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    assignment_type = models.CharField(max_length=20, choices=ASSIGNMENT_TYPES, default='quiz')
    
    time_limit_minutes = models.IntegerField(blank=True, null=True) # Dành cho quiz
    deadline = models.DateTimeField(blank=True, null=True) # Hạn chót nộp bài
    
    created_at = models.DateTimeField(auto_now_add=True)

class Question(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='questions')
    content = models.TextField()
    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)
    correct_option = models.CharField(max_length=1)

class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    
    submitted_file = models.FileField(upload_to='submissions/files/', blank=True, null=True)
    
    score = models.FloatField(blank=True, null=True)
    feedback = models.TextField(blank=True, null=True)
    
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('assignment', 'student')

        


