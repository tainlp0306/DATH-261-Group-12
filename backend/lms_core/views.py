from rest_framework import generics, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from .serializers import (
    UserSerializer, CourseSerializer, ModuleSerializer, 
    LessonSerializer, EnrollmentSerializer, LessonProgressSerializer,
    CommentSerializer, QuizSerializer, QuestionSerializer
)
from .permissions import IsAdmin, IsInstructor, IsInstructorOrAdmin
from .models import Course, Module, Lesson, Enrollment, LessonProgress, User, Quiz, Question, QuizSubmission, Comment

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer

class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Đăng xuất thành công"}, status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response({"error": "Token không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        user = request.user
        new_password = request.data.get("new_password")
        if new_password:
            user.set_password(new_password)
            user.save()
            return Response({"message": "Đổi mật khẩu thành công"})
        return Response({"error": "Thiếu mật khẩu mới"}, status=status.HTTP_400_BAD_REQUEST)

class ToggleAccountStatusView(APIView):
    permission_classes = (IsAdmin,)

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user.is_active = not user.is_active
            user.save()
            status_text = "Hoạt động" if user.is_active else "Đã bị khoá"
            return Response({"message": f"Tài khoản {user.username} hiện trạng thái: {status_text}"})
        except User.DoesNotExist:
            return Response({"error": "User không tồn tại"}, status=status.HTTP_404_NOT_FOUND)

class CourseListCreateView(generics.ListCreateAPIView):
    queryset = Course.objects.filter(is_published=True) 
    serializer_class = CourseSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description'] 

    def perform_create(self, serializer):
        serializer.save(instructor=self.request.user)

class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsInstructorOrAdmin()]
        return []

class ModuleCreateView(generics.CreateAPIView):
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsInstructor]

class LessonCreaterView(generics.CreateAPIView):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsInstructor]

class EnrollmentListCreateView(generics.ListCreateAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Enrollment.objects.filter(student=self.request.user)

    def create(self, request, *args, **kwargs):
        course_id = request.data.get('course')
        
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({"error": "Khóa học không tồn tại"}, status=status.HTTP_404_NOT_FOUND)

        if Enrollment.objects.filter(student=request.user, course=course).exists():
            return Response({"message": "Bạn đã đăng ký khóa học này rồi"}, status=status.HTTP_400_BAD_REQUEST)

        enrollment = Enrollment.objects.create(student=request.user, course=course)
        serializer = self.get_serializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class LessonProgressUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = Lesson.objects.get(id=lesson_id)
        progress, created = LessonProgress.objects.get_or_create(
            student=request.user,
            lesson=lesson
        )
        progress.is_completed = request.data.get('is_completed', progress.is_completed)
        progress.last_position = request.data.get('last_position', progress.last_position)
        progress.save()
        
        return Response({
            "message": "Cập nhật tiến độ thành công",
            "is_completed": progress.is_completed,
            "last_position": progress.last_position
        })

class AdminUserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        role = self.request.query_params.get('role')
        queryset = User.objects.all()
        if role:
            queryset = queryset.filter(role=role)
        return queryset

class AdminUserDeleteView(generics.DestroyAPIView):
    queryset = User.objects.all()
    permission_classes = [IsAdmin]
    lookup_url_kwarg = 'user_id'

    def delete(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"error": "Không thể tự xóa tài khoản quản trị đang đăng nhập"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class AdminCourseListView(generics.ListAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAdmin]


class ModuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsInstructor]

class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsInstructor]


class CourseStudentsProgressView(generics.GenericAPIView):
    permission_classes = [IsInstructor]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({"error": "Khóa học không tồn tại"}, status=status.HTTP_404_NOT_FOUND)

        enrollments = Enrollment.objects.filter(course=course).select_related('student')
        total_lessons = Lesson.objects.filter(module__course=course).count()

        result = []
        for enroll in enrollments:
            completed_count = LessonProgress.objects.filter(
                student=enroll.student, 
                lesson__module__course=course, 
                is_completed=True
            ).count()
            
            progress_percent = int((completed_count / total_lessons) * 100) if total_lessons > 0 else 0
            
            result.append({
                "student_id": enroll.student.id,
                "username": enroll.student.username,
                "email": enroll.student.email,
                "enrolled_at": enroll.enrolled_at,
                "completed_lessons": completed_count,
                "total_lessons": total_lessons,
                "progress_percent": progress_percent
            })

        return Response(result, status=status.HTTP_200_OK)


class StudentCourseProgressView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        progresses = LessonProgress.objects.filter(
            student=request.user,
            lesson__module__course_id=course_id
        ).order_by('-updated_at').values('lesson_id', 'is_completed', 'last_position')

        return Response(list(progresses), status=status.HTTP_200_OK)


class QuizDetailView(generics.RetrieveAPIView):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]


class CourseQuizListView(generics.ListCreateAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return Quiz.objects.filter(course_id=course_id)

    def perform_create(self, serializer):
        course_id = self.kwargs['course_id']
        serializer.save(course_id=course_id)


class SubmitQuizView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, quiz_id):
        try:
            quiz = Quiz.objects.get(id=quiz_id)
        except Quiz.DoesNotExist:
            return Response({"error": "Bài kiểm tra không tồn tại"}, status=status.HTTP_404_NOT_FOUND)

        answers = request.data.get('answers', {}) # Format: {"question_id": "A", ...}
        questions = quiz.questions.all()
        
        if not questions.exists():
            return Response({"error": "Bài kiểm tra chưa có câu hỏi"}, status=status.HTTP_400_BAD_REQUEST)

        correct_count = 0
        for q in questions:
            user_ans = answers.get(str(q.id))
            if user_ans and user_ans.upper() == q.correct_option.upper():
                correct_count += 1

        score = round((correct_count / questions.count()) * 10, 2)
        submission = QuizSubmission.objects.create(student=request.user, quiz=quiz, score=score)

        return Response({
            "message": "Nộp bài thành công!",
            "score": score,
            "correct_count": correct_count,
            "total_questions": questions.count()
        }, status=status.HTTP_201_CREATED)


class LessonCommentView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        lesson_id = self.kwargs['lesson_id']
        return Comment.objects.filter(lesson_id=lesson_id).order_by('-created_at')

    def perform_create(self, serializer):
        lesson_id = self.kwargs['lesson_id']
        serializer.save(user=self.request.user, lesson_id=lesson_id)


class AdminDashboardStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        total_students = User.objects.filter(role='learner').count()
        total_instructors = User.objects.filter(role='instructor').count()
        total_courses = Course.objects.count()
        total_enrollments = Enrollment.objects.count()

        return Response({
            "total_students": total_students,
            "total_instructors": total_instructors,
            "total_courses": total_courses,
            "total_enrollments": total_enrollments
        })

