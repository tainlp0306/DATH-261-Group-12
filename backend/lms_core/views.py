from rest_framework import generics, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, CourseSerializer, ModuleSerializer, LessonSerializer, EnrollmentSerializer, LessonProgressSerializer
from .permissions import IsAdmin, IsInstructor
from .models import Course, Module, Lesson, Enrollment, LessonProgress

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
            return [IsInstructor()]
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
