from rest_framework import permissions

class IsInstructor(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'instructor')

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')

class IsInstructorOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ('instructor', 'admin')
        )


class IsCourseOwnerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ('instructor', 'admin')
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True

        if hasattr(obj, 'instructor_id'):
            course = obj
        elif hasattr(obj, 'module'):
            course = obj.module.course
        else:
            course = getattr(obj, 'course', None)

        return bool(
            course
            and course.instructor_id == request.user.id
        )