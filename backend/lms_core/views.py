from rest_framework import generics, status, filters, parsers
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from django.core.mail import send_mail
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
import secrets
from rest_framework.pagination import PageNumberPagination
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from .serializers import (
    UserSerializer, CourseSerializer, CourseOutlineSerializer,
    CourseOptionSerializer, ModuleSerializer,
    LessonSerializer, EnrollmentSerializer, LessonProgressSerializer,
    CommentSerializer, QuizSerializer, QuestionSerializer, TestSerializer,
    TestSubmissionSerializer, NotificationSerializer, ReportSerializer,
    AdminLogSerializer,
)
from .permissions import IsAdmin, IsInstructor, IsInstructorOrAdmin
from .models import (
    AdminLog, Comment, Course, EmailOTP, Enrollment, Lesson, LessonProgress, Module,
    Notification, Quiz, Question, QuizSubmission, Report, Test, TestSubmission, User,
)

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer

    def create(self, request, *args, **kwargs):
        return Response(
            {'error': 'Đăng ký cần xác minh email. Hãy dùng request-registration-otp và confirm-registration-otp.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


class OTPRequestView(APIView):
    permission_classes = [AllowAny]
    purpose = 'password_reset'

    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            return Response({'email': ['Email không hợp lệ.']}, status=status.HTTP_400_BAD_REQUEST)

        user_exists = User.objects.filter(email__iexact=email).exists()
        if self.purpose == 'registration' and user_exists:
            return Response({'error': 'Email này đã được sử dụng.'}, status=status.HTTP_400_BAD_REQUEST)
        if self.purpose == 'password_reset' and not User.objects.filter(email__iexact=email, is_active=True).exists():
            return Response({'message': 'Nếu email tồn tại, mã xác minh sẽ được gửi.'})

        recent_otp = EmailOTP.objects.filter(
            email=email,
            purpose=self.purpose,
            created_at__gte=timezone.now() - timedelta(seconds=60),
            consumed_at__isnull=True,
        ).exists()
        if recent_otp:
            if self.purpose == 'registration':
                return Response({'error': 'Vui lòng chờ 60 giây trước khi yêu cầu mã mới.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            return Response({'message': 'Nếu email tồn tại, mã xác minh sẽ được gửi.'})

        code = f'{secrets.randbelow(1_000_000):06d}'
        otp = EmailOTP.objects.create(
            email=email,
            purpose=self.purpose,
            code_hash=make_password(code),
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        try:
            send_mail(
                'Mã xác minh LingoSphere',
                f'Mã xác minh của bạn là {code}. Mã có hiệu lực trong 10 phút.',
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
        except Exception:
            otp.delete()
            return Response(
                {'error': 'Không gửi được email. Kiểm tra cấu hình SMTP Gmail của máy chủ.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({'message': 'Mã xác minh đã được gửi nếu email hợp lệ.'})


class RegistrationOTPRequestView(OTPRequestView):
    purpose = 'registration'


def verify_email_otp(email, purpose, code):
    otp = EmailOTP.objects.select_for_update().filter(
        email=email,
        purpose=purpose,
        consumed_at__isnull=True,
    ).order_by('-created_at').first()
    if otp is None or otp.expires_at <= timezone.now() or otp.attempts >= 5:
        return None
    if not check_password(code, otp.code_hash):
        otp.attempts += 1
        otp.save(update_fields=['attempts'])
        return None
    return otp


class PasswordOTPConfirmView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        code = str(request.data.get('otp', '')).strip()
        password = request.data.get('new_password', '')
        otp = verify_email_otp(email, 'password_reset', code)
        if otp is None:
            return Response({'error': 'Mã OTP không hợp lệ hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is None:
            return Response({'error': 'Mã OTP không hợp lệ hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(password, user)
        except ValidationError as error:
            return Response({'new_password': error.messages}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save(update_fields=['password'])
        otp.consumed_at = timezone.now()
        otp.save(update_fields=['consumed_at'])
        return Response({'message': 'Đổi mật khẩu thành công.'})


class RegistrationOTPConfirmView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        username = str(request.data.get('username', '')).strip()
        email = str(request.data.get('email', '')).strip().lower()
        role = request.data.get('role', 'learner')
        password = request.data.get('password', '')
        code = str(request.data.get('otp', '')).strip()
        if not username or role not in ('learner', 'instructor'):
            return Response({'error': 'Tên đăng nhập và vai trò hợp lệ là bắt buộc.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username__iexact=username).exists():
            return Response({'username': ['Tên đăng nhập đã được sử dụng.']}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=email).exists():
            return Response({'email': ['Email này đã được sử dụng.']}, status=status.HTTP_400_BAD_REQUEST)
        otp = verify_email_otp(email, 'registration', code)
        if otp is None:
            return Response({'error': 'Mã OTP không hợp lệ hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(password)
        except ValidationError as error:
            return Response({'password': error.messages}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                role=role,
            )
            otp.consumed_at = timezone.now()
            otp.save(update_fields=['consumed_at'])
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

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


class PasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'error': 'Email là bắt buộc'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            reset_url = f'{frontend_url.rstrip("/")}/reset-password?uid={uid}&token={token}'
            send_mail(
                'Đặt lại mật khẩu LingoSphere',
                f'Mở liên kết sau để đặt lại mật khẩu của bạn: {reset_url}',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
        return Response({'message': 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            user_id = force_str(urlsafe_base64_decode(request.data.get('uid', '')))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'error': 'Liên kết đặt lại không hợp lệ hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)

        token = request.data.get('token', '')
        password = request.data.get('new_password', '')
        if not password:
            return Response({'new_password': ['Mật khẩu mới là bắt buộc.']}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Liên kết đặt lại không hợp lệ hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(password, user)
        except ValidationError as error:
            return Response({'new_password': error.messages}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'message': 'Đổi mật khẩu thành công.'})


class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '')
        token = request.data.get('id_token')
        if not client_id:
            return Response({'error': 'Google OAuth chưa được cấu hình.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not token:
            return Response({'error': 'Thiếu id_token.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        except ValueError:
            return Response({'error': 'Google token không hợp lệ hoặc đã hết hạn.'}, status=status.HTTP_401_UNAUTHORIZED)
        email = payload.get('email', '').strip().lower()
        if not email or not payload.get('email_verified'):
            return Response({'error': 'Tài khoản Google chưa xác minh email.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                base_username = (payload.get('name') or email.split('@')[0]).strip().replace(' ', '_')[:120] or 'learner'
                username = base_username
                suffix = 1
                while User.objects.filter(username=username).exists():
                    username = f'{base_username[:110]}_{suffix}'
                    suffix += 1
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=None,
                    role='learner',
                )
                user.set_unusable_password()
                user.save(update_fields=['password'])
        if not user.is_active:
            return Response({'error': 'Tài khoản đã bị vô hiệu hóa.'}, status=status.HTTP_403_FORBIDDEN)
        refresh = RefreshToken.for_user(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})

class ToggleAccountStatusView(APIView):
    permission_classes = (IsAdmin,)

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user.is_active = not user.is_active
            user.save()
            action = 'Mở khóa' if user.is_active else 'Khóa'
            AdminLog.objects.create(admin=request.user, action=f'{action} tài khoản {user.username} (ID: {user.id})')
            status_text = "Hoạt động" if user.is_active else "Đã bị khoá"
            return Response({"message": f"Tài khoản {user.username} hiện trạng thái: {status_text}"})
        except User.DoesNotExist:
            return Response({"error": "User không tồn tại"}, status=status.HTTP_404_NOT_FOUND)

class CoursePagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 48


class CourseListCreateView(generics.ListCreateAPIView):
    queryset = Course.objects.filter(is_published=True) 
    serializer_class = CourseSerializer
    pagination_class = CoursePagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description'] 
    ordering_fields = ['title', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return CourseOutlineSerializer
        return CourseSerializer

    def perform_create(self, serializer):
        serializer.save(instructor=self.request.user)


class InstructorCourseOptionsView(generics.ListAPIView):
    serializer_class = CourseOptionSerializer
    permission_classes = [IsInstructorOrAdmin]
    pagination_class = None

    def get_queryset(self):
        return Course.objects.filter(
            Q(is_published=True) | Q(instructor=self.request.user)
        ).order_by('title').distinct()

class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

    def get_serializer_class(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS') and getattr(self.request.user, 'role', None) not in ('instructor', 'admin'):
            return CourseOutlineSerializer
        return CourseSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsInstructorOrAdmin()]
        return []

    def perform_destroy(self, instance):
        if self.request.user.role == 'admin':
            AdminLog.objects.create(
                admin=self.request.user,
                action=f'Xóa khóa học "{instance.title}" (ID: {instance.id})',
            )
        instance.delete()

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
    pagination_class = None

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

    def destroy(self, request, *args, **kwargs):
        enrollment_id = request.data.get('enrollment_id') or request.query_params.get('id')
        course_id = request.data.get('course_id') or request.query_params.get('course')
        enrollments = Enrollment.objects.filter(student=request.user)
        if enrollment_id:
            enrollments = enrollments.filter(pk=enrollment_id)
        elif course_id:
            enrollments = enrollments.filter(course_id=course_id)
        else:
            return Response({'error': 'Cần enrollment_id hoặc course_id.'}, status=status.HTTP_400_BAD_REQUEST)
        enrollment = enrollments.first()
        if enrollment is None:
            return Response({'error': 'Không tìm thấy đăng ký khóa học.'}, status=status.HTTP_404_NOT_FOUND)
        enrollment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)


class EnrollmentDetailView(generics.DestroyAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        return Enrollment.objects.filter(student=self.request.user)


class EnrollmentLeaveView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, course_id):
        enrollment = Enrollment.objects.filter(
            student=request.user,
            course_id=course_id,
        ).first()
        if enrollment is None:
            return Response({'error': 'Bạn chưa đăng ký khóa học này.'}, status=status.HTTP_404_NOT_FOUND)
        enrollment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class LessonProgressUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id):
        last_page = None
        if 'last_page' in request.data:
            try:
                last_page = int(request.data['last_page'])
            except (TypeError, ValueError):
                return Response({'last_page': ['Trang phải là số nguyên dương.']}, status=status.HTTP_400_BAD_REQUEST)
            if last_page < 1:
                return Response({'last_page': ['Trang phải là số nguyên dương.']}, status=status.HTTP_400_BAD_REQUEST)

        lesson = get_object_or_404(Lesson, id=lesson_id)
        progress, created = LessonProgress.objects.get_or_create(
            student=request.user,
            lesson=lesson
        )
        progress.is_completed = request.data.get('is_completed', progress.is_completed)
        progress.last_position = request.data.get('last_position', progress.last_position)
        if last_page is not None:
            progress.last_page = last_page
        progress.save()
        
        return Response({
            "message": "Cập nhật tiến độ thành công",
            "is_completed": progress.is_completed,
            "last_position": progress.last_position,
            "last_page": progress.last_page,
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

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsInstructor()]
        return []


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
        ).order_by('-updated_at').values('lesson_id', 'is_completed', 'last_position', 'last_page')

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


class CourseTestListCreateView(generics.ListCreateAPIView):
    serializer_class = TestSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Test.objects.filter(course_id=self.kwargs['course_id'])

    def perform_create(self, serializer):
        course = Course.objects.get(pk=self.kwargs['course_id'])
        if self.request.user.role not in ('instructor', 'admin') or (
            self.request.user.role != 'admin' and course.instructor_id != self.request.user.id
        ):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Bạn không có quyền tạo bài tập cho khóa học này.')
        serializer.save(course=course)


class TestSubmissionListCreateView(generics.ListCreateAPIView):
    serializer_class = TestSubmissionSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    pagination_class = None

    def get_test(self):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(Test.objects.select_related('course'), pk=self.kwargs['test_id'])

    def get_queryset(self):
        test = self.get_test()
        if self.request.user.role == 'admin' or (
            self.request.user.role == 'instructor' and test.course.instructor_id == self.request.user.id
        ):
            return TestSubmission.objects.filter(test=test).select_related('student', 'test').order_by('-submitted_at')
        return TestSubmission.objects.filter(test=test, student=self.request.user).select_related('student', 'test').order_by('-submitted_at')

    def create(self, request, *args, **kwargs):
        test = self.get_test()
        if request.user.role != 'learner':
            return Response({'error': 'Chỉ học viên mới được nộp bài.'}, status=status.HTTP_403_FORBIDDEN)
        if test.test_type != 'file':
            return Response({'error': 'Bài tập này không nhận tệp.'}, status=status.HTTP_400_BAD_REQUEST)
        if not Enrollment.objects.filter(student=request.user, course=test.course).exists():
            return Response({'error': 'Bạn cần đăng ký khóa học trước khi nộp bài.'}, status=status.HTTP_403_FORBIDDEN)
        if not request.FILES.get('submitted_file'):
            return Response({'submitted_file': ['Vui lòng chọn tệp cần nộp.']}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(student=request.user, test=test)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GradeSubmissionView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, submission_id):
        from django.shortcuts import get_object_or_404
        submission = get_object_or_404(TestSubmission.objects.select_related('test__course'), pk=submission_id)
        if request.user.role != 'admin' and not (
            request.user.role == 'instructor' and submission.test.course.instructor_id == request.user.id
        ):
            return Response({'error': 'Bạn không có quyền chấm bài này.'}, status=status.HTTP_403_FORBIDDEN)
        if 'score' not in request.data and 'feedback' not in request.data:
            return Response({'error': 'Cần cung cấp score hoặc feedback.'}, status=status.HTTP_400_BAD_REQUEST)
        if 'score' in request.data:
            try:
                score = float(request.data['score'])
            except (TypeError, ValueError):
                return Response({'score': ['Điểm phải là một số.']}, status=status.HTTP_400_BAD_REQUEST)
            if score < 0 or score > 100:
                return Response({'score': ['Điểm phải nằm trong khoảng 0 đến 100.']}, status=status.HTTP_400_BAD_REQUEST)
            submission.score = score
        if 'feedback' in request.data:
            submission.feedback = str(request.data['feedback'])
        submission.save(update_fields=['score', 'feedback'])
        Notification.objects.create(
            user=submission.student,
            message=f'Bài tập "{submission.test.title}" đã được chấm điểm.'
        )
        return Response(TestSubmissionSerializer(submission, context={'request': request}).data)


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')

    def patch(self, request):
        notifications = self.get_queryset().filter(is_read=False)
        ids = request.data.get('ids')
        if ids is not None:
            if not isinstance(ids, list):
                return Response({'ids': ['Phải là danh sách ID.']}, status=status.HTTP_400_BAD_REQUEST)
            notifications = notifications.filter(pk__in=ids)
        updated = notifications.update(is_read=True)
        return Response({'updated': updated})


class NotificationConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        notification = get_object_or_404(Notification, pk=notification_id, user=request.user)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)


class CourseAnnouncementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        is_owner = request.user.role == 'instructor' and course.instructor_id == request.user.id
        if request.user.role != 'admin' and not is_owner:
            return Response({'error': 'Bạn không có quyền gửi thông báo cho khóa học này.'}, status=status.HTTP_403_FORBIDDEN)

        title = str(request.data.get('title', '')).strip()
        message = str(request.data.get('message', '')).strip()
        if not title or not message:
            return Response({'error': 'Tiêu đề và nội dung thông báo là bắt buộc.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(title) > 255 or len(message) > 255:
            return Response({'error': 'Tiêu đề và nội dung tối đa 255 ký tự.'}, status=status.HTTP_400_BAD_REQUEST)

        recipient_ids = set(
            Enrollment.objects.filter(course=course, student__is_active=True)
            .values_list('student_id', flat=True)
        )
        recipient_ids.add(request.user.id)
        Notification.objects.bulk_create([
            Notification(user_id=user_id, course=course, title=title, message=message)
            for user_id in recipient_ids
        ])
        return Response({'created': len(recipient_ids)}, status=status.HTTP_201_CREATED)


class ReportCreateView(generics.CreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)


class AdminReportListView(generics.ListAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAdmin]
    pagination_class = None
    queryset = Report.objects.select_related('reported_by', 'comment').order_by('-created_at')


class AdminReportDetailView(generics.UpdateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsAdmin]
    queryset = Report.objects.select_related('reported_by', 'comment')
    http_method_names = ['patch', 'head', 'options']

    def patch(self, request, *args, **kwargs):
        if set(request.data.keys()) != {'is_resolved'} or not isinstance(request.data['is_resolved'], bool):
            return Response({'is_resolved': ['Chỉ nhận giá trị true hoặc false.']}, status=status.HTTP_400_BAD_REQUEST)
        report = self.get_object()
        report.is_resolved = request.data['is_resolved']
        report.save(update_fields=['is_resolved'])
        return Response(self.get_serializer(report).data)


class AdminLogListView(generics.ListAPIView):
    serializer_class = AdminLogSerializer
    permission_classes = [IsAdmin]
    pagination_class = None
    queryset = AdminLog.objects.select_related('admin').order_by('-created_at')

