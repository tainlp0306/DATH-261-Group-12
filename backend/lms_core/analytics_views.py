from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Course, Enrollment, Intervention, Notification
from .services.analytics import analyze_course

LEVEL_FILTERS = {
    'at_risk': {'at_risk', 'critical'},
    'critical': {'critical'},
    'watch': {'watch'},
    'ok': {'ok'},
    'all': {'ok', 'watch', 'at_risk', 'critical'},
}


def _can_manage(user, course):
    if not user.is_authenticated:
        return False
    if user.role == 'admin':
        return True
    return user.role == 'instructor' and course.instructor_id == user.id


def _row_payload(row):
    return {
        'student_id': row['student_id'],
        'username': row['username'],
        'full_name': row['full_name'],
        'enrolled_at': row['enrolled_at'],
        'completed_lessons': row['completed_lessons'],
        'total_lessons': row['total_lessons'],
        'completion_ratio': row['completion_ratio'],
        'expected_ratio': row['expected_ratio'],
        'pace_gap': row['pace_gap'],
        'days_since_last_active': row['days_since_last_active'],
        'avg_quiz_score': row['avg_quiz_score'],
        'consecutive_low_quizzes': row['consecutive_low_quizzes'],
        'practice_attempts': row['practice_attempts'],
        'retention_score': row['retention_score'],
        'risk_score': row['risk_score'],
        'risk_level': row['risk_level'],
        'reasons': row['reasons'],
        'suggested_actions': row['suggested_actions'],
        'baseline_positive': row['baseline_positive'],
    }


def _overview_payload(course, report):
    return {
        'course_id': course.id,
        'course_title': course.title,
        'as_of': report['as_of'],
        'plan_days': 28,
        'enrolled_count': len(report['rows']),
        'mean_completion_ratio': report['mean_completion_ratio'],
        'mean_retention': report['mean_retention'],
        'at_risk_count': report['at_risk_count'],
        'weekly_progress': report['weekly_progress'],
        'completion_buckets': report['completion_buckets'],
    }


class CourseAnalyticsOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not _can_manage(request.user, course):
            return Response({'error': 'Bạn không phụ trách khóa này.'}, status=403)
        report = analyze_course(course)
        return Response(_overview_payload(course, report))


class CourseAtRiskView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not _can_manage(request.user, course):
            return Response({'error': 'Bạn không phụ trách khóa này.'}, status=403)
        level = request.query_params.get('level', 'at_risk')
        if level not in LEVEL_FILTERS:
            return Response({'level': ['Mức lọc không hợp lệ.']}, status=400)
        report = analyze_course(course)
        allowed = LEVEL_FILTERS[level]
        results = [_row_payload(row) for row in report['rows'] if row['risk_level'] in allowed]
        results.sort(key=lambda row: (-{'critical': 3, 'at_risk': 2, 'watch': 1, 'ok': 0}[row['risk_level']], -row['risk_score'], row['username']))
        return Response({'results': results})


class CourseInterveneView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not _can_manage(request.user, course):
            return Response({'error': 'Bạn không phụ trách khóa này.'}, status=403)
        action = request.data.get('action')
        if action not in (Intervention.NOTIFY, Intervention.SUGGEST_REVIEW):
            return Response({'action': ['Hành động không hợp lệ.']}, status=400)
        try:
            student_id = int(request.data.get('student_id'))
        except (TypeError, ValueError):
            return Response({'student_id': ['Học viên không hợp lệ.']}, status=400)
        enrollment = Enrollment.objects.filter(course=course, student_id=student_id).select_related('student').first()
        if enrollment is None:
            return Response({'error': 'Học viên không còn trong khóa.'}, status=404)

        report = analyze_course(course)
        row = next((item for item in report['rows'] if item['student_id'] == student_id), None)
        if row is None or action not in row['suggested_actions']:
            return Response({'action': ['Hành động này không khớp tình trạng của học viên.']}, status=400)

        cutoff = timezone.now() - timedelta(hours=24)
        existing = Intervention.objects.filter(
            course=course, student_id=student_id, action=action, created_at__gte=cutoff,
        ).order_by('-created_at').first()
        if existing is not None:
            return Response({
                'deduplicated': True,
                'intervention_id': existing.id,
                'notification_id': existing.notification_id,
            })

        reason = row['reasons'][0]['text'] if row['reasons'] else 'Hãy tiếp tục khóa học.'
        if action == Intervention.NOTIFY:
            title = 'Nhắc tiến độ'
            message = reason[:255]
        else:
            title = 'Ôn lại phần đã học'
            message = 'Độ ghi nhớ đang thấp. Hãy học lại các bài đã hoàn thành trước khi học tiếp.'
        notification = Notification.objects.create(
            user=enrollment.student,
            title=title,
            message=message,
            course=course,
        )
        intervention = Intervention.objects.create(
            course=course,
            student=enrollment.student,
            actor=request.user,
            action=action,
            notification=notification,
        )
        return Response({
            'deduplicated': False,
            'intervention_id': intervention.id,
            'notification_id': notification.id,
        }, status=201)


class MyAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            course_id = int(request.query_params.get('course'))
        except (TypeError, ValueError):
            return Response({'course': ['Thiếu mã khóa học.']}, status=400)
        course = get_object_or_404(Course, pk=course_id)
        if not Enrollment.objects.filter(course=course, student=request.user).exists():
            return Response({'error': 'Bạn chưa ghi danh khóa này.'}, status=404)
        report = analyze_course(course)
        row = next((item for item in report['rows'] if item['student_id'] == request.user.id), None)
        if row is None:
            return Response({'error': 'Bạn chưa ghi danh khóa này.'}, status=404)
        message = row['reasons'][0]['text'] if row['risk_level'] != 'ok' and row['reasons'] else ''
        return Response({
            'course_id': course.id,
            'completion_ratio': row['completion_ratio'],
            'completed_lessons': row['completed_lessons'],
            'total_lessons': row['total_lessons'],
            'retention_score': row['retention_score'],
            'days_since_last_active': row['days_since_last_active'],
            'risk_level': row['risk_level'],
            'message': message,
        })
