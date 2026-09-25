from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    RegisterView, UserProfileView, LogoutView, 
    ChangePasswordView, ToggleAccountStatusView,
    CourseListCreateView, CourseDetailView, ModuleCreateView, LessonCreaterView,
    EnrollmentListCreateView, LessonProgressUpdateView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('password/change/', ChangePasswordView.as_view(), name='change_password'),
    
    path('admin/users/<int:user_id>/toggle-status/', ToggleAccountStatusView.as_view(), name='toggle_status'),


    path('courses/', CourseListCreateView.as_view(), name='course_list_create'),
    path('courses/<int:pk>/', CourseDetailView.as_view(), name='course_detail'),
    path('modules/', ModuleCreateView.as_view(), name='module_create'),
    path('lessons/', LessonCreaterView.as_view(), name='lesson_create'),
    path('enrollments/', EnrollmentListCreateView.as_view(), name='enrollment_list_create'),
    path('lessons/<int:lesson_id>/progress/', LessonProgressUpdateView.as_view(), name='lesson_progress_update'),   

]