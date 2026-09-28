from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    RegisterView, UserProfileView, LogoutView, 
    ChangePasswordView, ToggleAccountStatusView,
    CourseListCreateView, CourseDetailView, ModuleCreateView, LessonCreaterView,
    EnrollmentListCreateView, LessonProgressUpdateView,
    AdminUserListView, AdminUserDeleteView, AdminCourseListView,
    ModuleDetailView, LessonDetailView,
    CourseStudentsProgressView, StudentCourseProgressView,
    SubmitQuizView, LessonCommentView, AdminDashboardStatsView,
    QuizDetailView, CourseQuizListView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('password/change/', ChangePasswordView.as_view(), name='change_password'),
    
    path('admin/users/<int:user_id>/toggle-status/', ToggleAccountStatusView.as_view(), name='toggle_status'),
    path('admin/users/<int:user_id>/', AdminUserDeleteView.as_view(), name='admin_user_delete'),


    path('courses/', CourseListCreateView.as_view(), name='course_list_create'),
    path('courses/<int:pk>/', CourseDetailView.as_view(), name='course_detail'),
    path('modules/', ModuleCreateView.as_view(), name='module_create'),
    path('lessons/', LessonCreaterView.as_view(), name='lesson_create'),
    path('enrollments/', EnrollmentListCreateView.as_view(), name='enrollment_list_create'),
    path('lessons/<int:lesson_id>/progress/', LessonProgressUpdateView.as_view(), name='lesson_progress_update'),   

    path('admin/users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/courses/', AdminCourseListView.as_view(), name='admin_course_list'),

    path('modules/<int:pk>/', ModuleDetailView.as_view(), name='module_detail'),
    path('lessons/<int:pk>/', LessonDetailView.as_view(), name='lesson_detail'),
    path('courses/<int:course_id>/students-progress/', CourseStudentsProgressView.as_view(), name='course_students_progress'),

    path('courses/<int:course_id>/my-progress/', StudentCourseProgressView.as_view(), name='student_course_progress'),
    path('courses/<int:course_id>/quizzes/', CourseQuizListView.as_view(), name='course_quizzes'),
    path('quizzes/<int:pk>/', QuizDetailView.as_view(), name='quiz_detail'),
    path('quizzes/<int:quiz_id>/submit/', SubmitQuizView.as_view(), name='submit_quiz'),
    path('lessons/<int:lesson_id>/comments/', LessonCommentView.as_view(), name='lesson_comments'),    
    path('admin/dashboard-stats/', AdminDashboardStatsView.as_view(), name='admin_dashboard_stats'),
]