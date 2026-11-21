from collections import defaultdict
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from .models import (
    Enrollment,
    LearningActivity,
    LearningActivityAttempt,
    LearningEvent,
    Lesson,
    LessonProgress,
    PracticeLog,
    Submission,
)
from .services.analytics import retention_score

VN_TZ = ZoneInfo('Asia/Ho_Chi_Minh')
PLAN_DAYS = 28


def _local_date(value):
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone=timezone.get_default_timezone())
    return value.astimezone(VN_TZ).date()


def _median(values):
    values = sorted(values)
    if not values:
        return None
    midpoint = len(values) // 2
    if len(values) % 2:
        return values[midpoint]
    return (values[midpoint - 1] + values[midpoint]) / 2


def _as_score(value):
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    if score != score:
        return None
    return score


def _risk_for(enrolled_days, completion_ratio, inactive_days, quiz_scores, retention=None):
    numeric_scores = [score for score in (_as_score(item) for item in quiz_scores) if score is not None]
    low_quiz_streak = 0
    for score in reversed(numeric_scores):
        if score < 5:
            low_quiz_streak += 1
        else:
            break

    reasons = []
    if enrolled_days >= 14 and completion_ratio < 0.4:
        reasons.append({
            'code': 'low_completion',
            'text': f'Đã học {enrolled_days} ngày nhưng mới hoàn thành {completion_ratio:.0%} nội dung (mốc tham chiếu 40%).',
        })
    if low_quiz_streak >= 3:
        reasons.append({
            'code': 'quiz_failures',
            'text': f'{low_quiz_streak} bài trắc nghiệm gần nhất có điểm dưới 5/10.',
        })
    if inactive_days >= 7 and completion_ratio < 0.8:
        reasons.append({
            'code': 'inactive',
            'text': f'Không có hoạt động học trong {inactive_days} ngày và khóa học chưa hoàn thành.',
        })
    if retention is not None and retention < 40:
        reasons.append({
            'code': 'low_retention',
            'text': f'Độ ghi nhớ ước tính {retention}/100, dưới ngưỡng 40.',
        })

    expected_ratio = min(max(enrolled_days / PLAN_DAYS, 0), 1)
    pace_gap = expected_ratio - completion_ratio
    reason_codes = {reason['code'] for reason in reasons}
    if 'inactive' in reason_codes or low_quiz_streak >= 3:
        level = 'at_risk'
    elif reasons or (enrolled_days >= 14 and pace_gap >= 0.25):
        level = 'watch'
    else:
        level = 'ok'
    return {
        'expected_ratio': expected_ratio,
        'pace_gap': pace_gap,
        'consecutive_low_quizzes': low_quiz_streak,
        'risk_level': level,
        'reasons': reasons,
        'suggested_actions': ['notify'] if reasons else [],
    }


def analyze_course(course, now=None):
    now = now or timezone.now()
    today = _local_date(now)
    enrollments = list(
        Enrollment.objects.filter(course=course)
        .select_related('student')
        .order_by('enrolled_at')
    )
    student_ids = [enrollment.student_id for enrollment in enrollments]
    total_lessons = Lesson.objects.filter(module__course=course).count()
    progress_rows = list(
        LessonProgress.objects.filter(
            student_id__in=student_ids,
            lesson__module__course=course,
        ).select_related('lesson')
    )
    events = list(
        LearningEvent.objects.filter(course=course, actor_id__in=student_ids)
        .order_by('occurred_at', 'id')
    )
    submissions = list(
        Submission.objects.filter(
            student_id__in=student_ids,
            assignment__course=course,
            assignment__assignment_type='quiz',
            score__isnull=False,
        ).select_related('assignment')
    )
    attempts = list(
        LearningActivityAttempt.objects.filter(
            student_id__in=student_ids,
            activity__course=course,
        ).select_related('activity')
    )
    practice_rows = list(
        PracticeLog.objects.filter(
            student_id__in=student_ids,
            vocabulary__course=course,
        )
    )

    events_by_student = defaultdict(list)
    quiz_event_assignment_ids = defaultdict(set)
    for event in events:
        if event.occurred_at <= now:
            events_by_student[event.actor_id].append(event)
            if event.event_type == LearningEvent.QUIZ_SUBMITTED and event.assignment_id:
                quiz_event_assignment_ids[event.actor_id].add(event.assignment_id)

    progress_by_student = defaultdict(list)
    for progress in progress_rows:
        progress_by_student[progress.student_id].append(progress)

    submissions_by_student = defaultdict(list)
    for submission in submissions:
        when = submission.submitted_at or (submission.started_at if submission.score is not None else None)
        if when is None or when > now:
            continue
        if submission.submitted_at is None:
            submission.submitted_at = when
        submissions_by_student[submission.student_id].append(submission)

    attempts_by_student = defaultdict(list)
    for attempt in attempts:
        if attempt.submitted_at <= now:
            attempts_by_student[attempt.student_id].append(attempt)

    practice_by_student = defaultdict(list)
    for practice in practice_rows:
        if practice.attempt_date and practice.attempt_date <= now:
            practice_by_student[practice.student_id].append(practice)

    lesson_events_by_student = defaultdict(list)
    for event in events:
        if event.event_type == LearningEvent.LESSON_COMPLETED and event.occurred_at <= now:
            lesson_id = event.lesson_id or (event.payload or {}).get('lesson_id')
            if lesson_id:
                lesson_events_by_student[event.actor_id].append((event.occurred_at, int(lesson_id)))

    rows = []
    quiz_results_by_student = {}
    for enrollment in enrollments:
        student = enrollment.student
        own_progress = progress_by_student[student.id]
        completed_count = sum(1 for progress in own_progress if progress.is_completed)
        completion_ratio = completed_count / total_lessons if total_lessons else 0
        own_submissions = submissions_by_student[student.id]
        own_events = events_by_student[student.id]
        own_attempts = attempts_by_student[student.id]
        activity_times = [
            progress.updated_at for progress in own_progress
            if progress.updated_at and progress.updated_at <= now
        ]
        activity_times.extend(item.submitted_at for item in own_submissions)
        activity_times.extend(item.submitted_at for item in own_attempts)
        own_practice = practice_by_student[student.id]
        activity_times.extend(item.attempt_date for item in own_practice)
        activity_times.extend(
            event.occurred_at for event in own_events
            if event.event_type != LearningEvent.ENROLLED
        )
        last_active = max(activity_times, default=enrollment.enrolled_at)
        quiz_results = []
        for event in own_events:
            if event.event_type != LearningEvent.QUIZ_SUBMITTED:
                continue
            score = _as_score((event.payload or {}).get('score'))
            if score is None:
                continue
            quiz_results.append((event.occurred_at, score))
        seen_assignment_ids = quiz_event_assignment_ids[student.id]
        quiz_results.extend(
            (submission.submitted_at, score)
            for submission in own_submissions
            if submission.assignment_id not in seen_assignment_ids
            and (score := _as_score(submission.score)) is not None
        )
        quiz_results.extend(
            (attempt.submitted_at, score)
            for attempt in own_attempts
            if attempt.activity.activity_type == LearningActivity.QUIZ
            and (score := _as_score(attempt.score)) is not None
        )
        quiz_results.sort(key=lambda result: result[0])
        quiz_results_by_student[student.id] = quiz_results
        quiz_scores = [score for _, score in quiz_results]
        enrolled_days = max(0, (today - _local_date(enrollment.enrolled_at)).days)
        inactive_days = max(0, (today - _local_date(last_active)).days)
        last_practice = max((item.attempt_date for item in own_practice), default=None)
        retention = retention_score(
            len(own_practice),
            sum(1 for item in own_practice if item.is_correct),
            max(0, (today - _local_date(last_practice)).days) if last_practice else None,
        )
        risk = _risk_for(enrolled_days, completion_ratio, inactive_days, quiz_scores, retention)
        full_name = f'{student.first_name} {student.last_name}'.strip() or student.username
        rows.append({
            'student_id': student.id,
            'username': student.username,
            'full_name': full_name,
            'enrolled_at': enrollment.enrolled_at,
            'completed_lessons': completed_count,
            'total_lessons': total_lessons,
            'completion_ratio': completion_ratio,
            'enrolled_days': enrolled_days,
            'days_since_last_active': inactive_days,
            'avg_quiz_score': sum(quiz_scores) / len(quiz_scores) if quiz_scores else None,
            'quiz_count': len(quiz_scores),
            'activity_count': len(own_attempts),
            'practice_attempts': len(own_practice),
            'retention_score': retention,
            **risk,
        })

    weekly_progress = []
    for weeks_ago in range(7, -1, -1):
        week_end = today - timedelta(days=weeks_ago * 7)
        week_start = week_end - timedelta(days=6)
        ratios = []
        ages = []
        quiz_scores = []
        for enrollment in enrollments:
            enrolled_on = _local_date(enrollment.enrolled_at)
            if enrolled_on > week_end or not total_lessons:
                continue
            student_id = enrollment.student_id
            completed_lessons = {
                lesson_id for occurred_at, lesson_id in lesson_events_by_student[student_id]
                if _local_date(occurred_at) <= week_end
            }
            completed_lessons.update(
                progress.lesson_id for progress in progress_by_student[student_id]
                if progress.is_completed
                and (progress.completed_at or progress.updated_at)
                and _local_date(progress.completed_at or progress.updated_at) <= week_end
            )
            ratios.append(min(len(completed_lessons) / total_lessons, 1))
            ages.append(max(0, (week_end - enrolled_on).days))
            quiz_scores.extend(
                score for occurred_at, score in quiz_results_by_student[student_id]
                if week_start <= _local_date(occurred_at) <= week_end
            )
        median_age = _median(ages) or 0
        weekly_progress.append({
            'week_start': week_start.isoformat(),
            'median_completion': _median(ratios),
            'expected_completion': min(median_age / PLAN_DAYS, 1),
            'mean_quiz_score': sum(quiz_scores) / len(quiz_scores) if quiz_scores else None,
            'quiz_attempt_count': len(quiz_scores),
        })

    levels = {'ok': 0, 'watch': 0, 'at_risk': 0}
    for row in rows:
        levels[row['risk_level'] if row['risk_level'] in levels else 'at_risk'] += 1
    completion_buckets = {'0-24': 0, '25-49': 0, '50-74': 0, '75-100': 0}
    for row in rows:
        percent = row['completion_ratio'] * 100
        bucket = '0-24' if percent < 25 else '25-49' if percent < 50 else '50-74' if percent < 75 else '75-100'
        completion_buckets[bucket] += 1

    return {
        'as_of': now,
        'plan_days': PLAN_DAYS,
        'total_lessons': total_lessons,
        'enrolled_count': len(rows),
        'at_risk_count': levels['at_risk'],
        'mean_completion_ratio': sum(row['completion_ratio'] for row in rows) / len(rows) if rows else 0,
        'weekly_progress': weekly_progress,
        'completion_buckets': [
            {'label': label, 'count': count}
            for label, count in completion_buckets.items()
        ],
        'risk_counts': levels,
        'rows': rows,
    }


def log_learning_event(
    *,
    actor,
    course,
    event_type,
    payload=None,
    lesson=None,
    assignment=None,
    occurred_at=None,
    source='web',
):
    return LearningEvent.objects.create(
        actor=actor,
        course=course,
        lesson=lesson,
        assignment=assignment,
        event_type=event_type,
        payload=payload or {},
        occurred_at=occurred_at or timezone.now(),
        source=source,
    )
