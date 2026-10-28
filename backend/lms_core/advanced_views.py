import unicodedata
from datetime import timedelta
from math import isfinite

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import parsers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .analytics import analyze_course, log_learning_event
from .models import (
    Course,
    Enrollment,
    Intervention,
    LearningActivity,
    LearningActivityAttempt,
    LearningActivityItem,
    LearningEvent,
    Module,
    Notification,
)
from .serializers import LearningActivityAttemptSerializer, LearningActivitySerializer


def _can_manage_course(user, course):
    return user.role == 'admin' or (
        user.role == 'instructor' and course.instructor_id == user.id
    )


def _can_access_activity(user, activity):
    if _can_manage_course(user, activity.course):
        return True
    return user.role == 'learner' and Enrollment.objects.filter(
        student=user,
        course=activity.course,
    ).exists()


class CourseAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not _can_manage_course(request.user, course):
            raise PermissionDenied('Chỉ giảng viên phụ trách hoặc quản trị viên mới được xem phân tích này.')

        report = analyze_course(course)
        levels = {'critical': 3, 'at_risk': 2, 'watch': 1, 'ok': 0}
        report['rows'].sort(
            key=lambda row: (
                -levels[row['risk_level']],
                -row['pace_gap'],
                row['username'],
            )
        )
        return Response({
            'course_id': course.id,
            'course_title': course.title,
            'as_of': report['as_of'],
            'plan_days': report['plan_days'],
            'total_lessons': report['total_lessons'],
            'enrolled_count': report['enrolled_count'],
            'at_risk_count': report['at_risk_count'],
            'mean_completion_ratio': report['mean_completion_ratio'],
            'weekly_progress': report['weekly_progress'],
            'completion_buckets': report['completion_buckets'],
            'risk_counts': report['risk_counts'],
            'students': report['rows'],
        })


class CourseInterventionView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        if not _can_manage_course(request.user, course):
            raise PermissionDenied('Bạn không phụ trách khóa học này.')
        if request.data.get('action') != Intervention.NOTIFY:
            return Response({'action': ['Hành động không hợp lệ.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            student_id = int(request.data.get('student_id'))
        except (TypeError, ValueError):
            return Response({'student_id': ['Học viên không hợp lệ.']}, status=status.HTTP_400_BAD_REQUEST)

        enrollment = Enrollment.objects.filter(
            course=course,
            student_id=student_id,
            student__is_active=True,
        ).select_related('student').first()
        if enrollment is None:
            return Response({'error': 'Học viên không còn ghi danh khóa này.'}, status=status.HTTP_404_NOT_FOUND)

        report = analyze_course(course)
        student = next((row for row in report['rows'] if row['student_id'] == student_id), None)
        if student is None or not student['reasons']:
            return Response({'action': ['Học viên hiện chưa có dấu hiệu cần can thiệp.']}, status=status.HTTP_400_BAD_REQUEST)

        cutoff = timezone.now() - timedelta(hours=24)
        existing = Intervention.objects.filter(
            course=course,
            student_id=student_id,
            action=Intervention.NOTIFY,
            created_at__gte=cutoff,
        ).order_by('-created_at').first()
        if existing:
            return Response({
                'deduplicated': True,
                'intervention_id': existing.id,
                'notification_id': existing.notification_id,
            })

        reason = student['reasons'][0]['text']
        notification = Notification.objects.create(
            user=enrollment.student,
            course=course,
            title='Nhắc tiến độ học tập',
            message=reason[:255],
            target_url=f'/courses/{course.id}',
        )
        intervention = Intervention.objects.create(
            course=course,
            student=enrollment.student,
            actor=request.user,
            action=Intervention.NOTIFY,
            notification=notification,
        )
        return Response({
            'deduplicated': False,
            'intervention_id': intervention.id,
            'notification_id': notification.id,
        }, status=status.HTTP_201_CREATED)


class CourseLearningActivityListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [parsers.JSONParser, parsers.FormParser]

    def get_course(self, course_id):
        return get_object_or_404(Course, pk=course_id)

    def get(self, request, course_id):
        course = self.get_course(course_id)
        can_manage = _can_manage_course(request.user, course)
        is_enrolled = request.user.role == 'learner' and Enrollment.objects.filter(
            student=request.user,
            course=course,
        ).exists()
        if not can_manage and not is_enrolled:
            raise PermissionDenied('Bạn cần ghi danh hoặc phụ trách khóa học để xem hoạt động.')
        activities = LearningActivity.objects.filter(course=course).prefetch_related('items').order_by('created_at')
        if not can_manage:
            activities = activities.filter(is_published=True)
        serializer = LearningActivitySerializer(
            activities,
            many=True,
            context={'include_answers': can_manage},
        )
        return Response(serializer.data)

    def post(self, request, course_id):
        course = self.get_course(course_id)
        if not _can_manage_course(request.user, course):
            raise PermissionDenied('Bạn không có quyền tạo hoạt động trong khóa học này.')
        serializer = LearningActivitySerializer(
            data=request.data,
            context={'include_answers': True},
        )
        serializer.is_valid(raise_exception=True)
        module = serializer.validated_data.get('module')
        if module and module.course_id != course.id:
            return Response({'module': ['Chương phải thuộc khóa học này.']}, status=status.HTTP_400_BAD_REQUEST)
        activity = serializer.save(course=course, created_by=request.user)
        if activity.is_published and str(request.data.get('notify_students', 'true')).lower() not in ('false', '0', 'no'):
            recipients = Enrollment.objects.filter(
                course=course,
                student__role='learner',
                student__is_active=True,
            ).values_list('student_id', flat=True)
            Notification.objects.bulk_create([
                Notification(
                    user_id=learner_id,
                    course=course,
                    title='Bài luyện tập mới',
                    message=f'Hoạt động "{activity.title}" đã được mở.',
                    target_url=f'/courses/{course.id}/activities/{activity.id}',
                )
                for learner_id in recipients
            ])
        return Response(
            LearningActivitySerializer(activity, context={'include_answers': True}).data,
            status=status.HTTP_201_CREATED,
        )


class LearningActivityDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [parsers.JSONParser, parsers.FormParser]

    def get_object(self, activity_id):
        return get_object_or_404(
            LearningActivity.objects.select_related('course').prefetch_related('items'),
            pk=activity_id,
        )

    def get(self, request, activity_id):
        activity = self.get_object(activity_id)
        if not _can_access_activity(request.user, activity):
            raise PermissionDenied('Bạn không có quyền xem hoạt động này.')
        can_manage = _can_manage_course(request.user, activity.course)
        if not can_manage and not activity.is_published:
            return Response({'error': 'Hoạt động chưa được mở.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(LearningActivitySerializer(
            activity,
            context={'include_answers': can_manage},
        ).data)

    def patch(self, request, activity_id):
        activity = self.get_object(activity_id)
        if not _can_manage_course(request.user, activity.course):
            raise PermissionDenied('Bạn không có quyền chỉnh sửa hoạt động này.')
        previous = {
            'is_published': activity.is_published,
            'title': activity.title,
            'description': activity.description,
        }
        serializer = LearningActivitySerializer(
            activity,
            data=request.data,
            partial=True,
            context={'include_answers': True},
        )
        serializer.is_valid(raise_exception=True)
        module = serializer.validated_data.get('module', activity.module)
        if module and module.course_id != activity.course_id:
            return Response({'module': ['Chương phải thuộc khóa học này.']}, status=status.HTTP_400_BAD_REQUEST)
        updated = serializer.save()
        changed = 'items' in serializer.validated_data or any(
            getattr(updated, field) != value for field, value in previous.items()
        )
        notify = str(request.data.get('notify_students', 'true')).lower() not in ('false', '0', 'no')
        if (
            notify
            and updated.is_published
            and changed
        ):
            recipients = Enrollment.objects.filter(
                course=updated.course,
                student__role='learner',
                student__is_active=True,
            ).values_list('student_id', flat=True)
            Notification.objects.bulk_create([
                Notification(
                    user_id=learner_id,
                    course=updated.course,
                    title='Bài luyện tập được cập nhật',
                    message=f'Hoạt động "{updated.title}" đã được cập nhật.',
                    target_url=f'/courses/{updated.course_id}/activities/{updated.id}',
                )
                for learner_id in recipients
            ])
        return Response(LearningActivitySerializer(updated, context={'include_answers': True}).data)


def _normalized_answer(value):
    return ''.join(unicodedata.normalize('NFC', str(value)).split()).casefold()


class LearningActivityAttemptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, activity_id):
        activity = get_object_or_404(
            LearningActivity.objects.select_related('course').prefetch_related('items'),
            pk=activity_id,
        )
        if request.user.role != 'learner':
            raise PermissionDenied('Chỉ học viên mới có thể làm hoạt động.')
        if not Enrollment.objects.filter(student=request.user, course=activity.course).exists():
            raise PermissionDenied('Bạn cần ghi danh khóa học trước khi làm hoạt động.')
        if not activity.is_published:
            return Response({'error': 'Hoạt động chưa được mở.'}, status=status.HTTP_403_FORBIDDEN)
        items = list(activity.items.all())
        raw_responses = request.data.get('responses')
        if not isinstance(raw_responses, list):
            return Response({'responses': ['Câu trả lời phải là một danh sách.']}, status=status.HTTP_400_BAD_REQUEST)
        if len(raw_responses) != len(items):
            return Response({'responses': ['Cần nộp câu trả lời cho toàn bộ nội dung.']}, status=status.HTTP_400_BAD_REQUEST)

        responses_by_id = {}
        for response in raw_responses:
            if not isinstance(response, dict):
                return Response({'responses': ['Định dạng câu trả lời không hợp lệ.']}, status=status.HTTP_400_BAD_REQUEST)
            try:
                item_id = int(response.get('item_id'))
            except (TypeError, ValueError):
                return Response({'responses': ['Thiếu mã nội dung hợp lệ.']}, status=status.HTTP_400_BAD_REQUEST)
            if item_id in responses_by_id:
                return Response({'responses': ['Không thể gửi lặp cùng một nội dung.']}, status=status.HTTP_400_BAD_REQUEST)
            responses_by_id[item_id] = response
        if set(responses_by_id) != {item.id for item in items}:
            return Response({'responses': ['Nội dung gửi lên không khớp hoạt động.']}, status=status.HTTP_400_BAD_REQUEST)

        stored_responses = []
        correct_count = 0
        completed_count = 0
        for item in items:
            response = responses_by_id[item.id]
            if activity.activity_type == LearningActivity.WRITING:
                strokes = response.get('strokes')
                if not isinstance(strokes, list) or not strokes:
                    return Response({'responses': ['Hãy viết ít nhất một nét cho mỗi ký tự.']}, status=status.HTTP_400_BAD_REQUEST)
                point_count = 0
                normalized_strokes = []
                for stroke in strokes:
                    if not isinstance(stroke, list) or len(stroke) < 2:
                        return Response({'responses': ['Mỗi nét cần ít nhất hai điểm.']}, status=status.HTTP_400_BAD_REQUEST)
                    normalized_points = []
                    for point in stroke:
                        if not isinstance(point, (list, tuple)) or len(point) != 2:
                            return Response({'responses': ['Tọa độ nét vẽ không hợp lệ.']}, status=status.HTTP_400_BAD_REQUEST)
                        if any(not isinstance(value, (int, float)) or not isfinite(value) or value < 0 or value > 1 for value in point):
                            return Response({'responses': ['Tọa độ nét vẽ phải nằm trong khoảng 0–1.']}, status=status.HTTP_400_BAD_REQUEST)
                        normalized_points.append([round(float(point[0]), 4), round(float(point[1]), 4)])
                    point_count += len(normalized_points)
                    normalized_strokes.append(normalized_points)
                if point_count > 5000 or len(normalized_strokes) > 100:
                    return Response({'responses': ['Nét vẽ vượt quá giới hạn cho phép.']}, status=status.HTTP_400_BAD_REQUEST)
                stored_responses.append({
                    'item_id': item.id,
                    'strokes': normalized_strokes,
                })
                completed_count += 1
                continue

            answer = str(response.get('answer', '')).strip()
            is_correct = bool(answer) and _normalized_answer(answer) == _normalized_answer(item.answer)
            completed_count += int(bool(answer))
            correct_count += int(is_correct)
            stored_responses.append({
                'item_id': item.id,
                'answer': answer[:500],
                'is_correct': is_correct,
            })

        score = None
        if activity.activity_type != LearningActivity.WRITING:
            score = round(correct_count / len(items) * 10, 2) if items else 0
        attempt = LearningActivityAttempt.objects.create(
            activity=activity,
            student=request.user,
            responses=stored_responses,
            score=score,
            completed_items=completed_count,
            total_items=len(items),
        )
        log_learning_event(
            actor=request.user,
            course=activity.course,
            event_type=LearningEvent.ACTIVITY_SUBMITTED,
            payload={
                'activity_id': activity.id,
                'activity_type': activity.activity_type,
                'score': score,
                'completed_items': completed_count,
                'total_items': len(items),
            },
        )
        return Response({
            **LearningActivityAttemptSerializer(attempt).data,
            'correct_count': None if activity.activity_type == LearningActivity.WRITING else correct_count,
            'results': [
                {
                    **response,
                    'target': item.answer,
                }
                for item, response in zip(items, stored_responses, strict=True)
            ],
        }, status=status.HTTP_201_CREATED)
