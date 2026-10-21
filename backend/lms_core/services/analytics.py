"""Learning analytics for the LMS.

Retention is one outcome signal (accuracy decayed by time since last practice).
It is not a spaced-repetition scheduler and does not assign review intervals.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from django.utils import timezone

from lms_core.models import (
    Enrollment,
    LearningEvent,
    Lesson,
    LessonProgress,
    PracticeLog,
    Submission,
)

VN_TZ = ZoneInfo('Asia/Ho_Chi_Minh')
PLAN_DAYS = 28
QUIZ_FAIL_BELOW = 5.0
RETENTION_MIN_ATTEMPTS = 5
RETENTION_FLAG_BELOW = 40.0

LOW_COMPLETION = 'low_completion_after_two_weeks'
QUIZ_STREAK = 'consecutive_quiz_failures'
INACTIVE = 'inactive_and_incomplete'
CRITICAL_INACTIVE = 'critical_inactivity'
LOW_RETENTION = 'low_retention'


def local_date(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, datetime.timezone.utc)
    return value.astimezone(VN_TZ).date()


def clamp(value, low, high):
    return max(low, min(high, value))


def round_half_up(value, places=1):
    quant = Decimal('1') if places == 0 else Decimal('0.1') ** places
    return float(Decimal(str(value)).quantize(quant, rounding=ROUND_HALF_UP))


def trailing_low_quizzes(scores):
    """Count the latest run of quiz scores strictly below 5. None is ignored."""
    count = 0
    for score in reversed(list(scores)):
        if score is None:
            continue
        if float(score) < QUIZ_FAIL_BELOW:
            count += 1
        else:
            break
    return count


def retention_score(attempts, correct, days_since_last_practice):
    """0–100. None when there is not enough practice to judge.

    accuracy * 100 * 0.5 ** (days / 7). A week without practice halves the score.
    """
    if attempts < RETENTION_MIN_ATTEMPTS or days_since_last_practice is None:
        return None
    accuracy = (correct / attempts) if attempts else 0.0
    days = max(0, days_since_last_practice)
    return round_half_up(100 * accuracy * (0.5 ** (days / 7)), 1)


def classify_risk(metrics):
    enrolled_days = int(metrics['enrolled_days'])
    completion = float(metrics['completion_ratio'])
    inactive_days = int(metrics['days_since_last_active'])
    low_quizzes = int(metrics['consecutive_low_quizzes'])
    retention = retention_score(
        int(metrics.get('practice_attempts') or 0),
        int(metrics.get('practice_correct') or 0),
        metrics.get('days_since_last_practice'),
    )

    reasons = []
    if enrolled_days >= 14 and completion < 0.40:
        reasons.append({
            'code': LOW_COMPLETION,
            'text': (
                f'Đã ghi danh {enrolled_days} ngày nhưng mới hoàn thành '
                f'{round(completion * 100)}% bài (ngưỡng 40% sau 14 ngày).'
            ),
        })
    if low_quizzes >= 3:
        reasons.append({
            'code': QUIZ_STREAK,
            'text': f'{low_quizzes} bài quiz gần nhất đều dưới 5/10.',
        })
    if inactive_days >= 7 and completion < 0.80:
        reasons.append({
            'code': INACTIVE,
            'text': f'Nghỉ {inactive_days} ngày trong khi còn bài chưa học.',
        })
    if inactive_days >= 14 and completion < 1:
        reasons.append({
            'code': CRITICAL_INACTIVE,
            'text': f'Không học {inactive_days} ngày và chưa học xong khóa.',
        })
    if retention is not None and retention < RETENTION_FLAG_BELOW:
        reasons.append({
            'code': LOW_RETENTION,
            'text': f'Độ ghi nhớ ước tính {retention}/100, dưới ngưỡng 40.',
        })

    expected = clamp(enrolled_days / PLAN_DAYS, 0, 1)
    pace_penalty = clamp((expected - completion) / 0.40, 0, 1)
    inactivity_penalty = clamp((inactive_days - 2) / 8, 0, 1)
    quiz_penalty = clamp(low_quizzes / 3, 0, 1)
    retention_penalty = 0 if retention is None else clamp((60 - retention) / 60, 0, 1)
    risk_score = round_half_up(
        40 * pace_penalty + 25 * inactivity_penalty + 20 * quiz_penalty + 15 * retention_penalty,
        1,
    )

    codes = {item['code'] for item in reasons}
    if CRITICAL_INACTIVE in codes or risk_score >= 75:
        level = 'critical'
    elif codes or risk_score >= 50:
        level = 'at_risk'
    elif risk_score >= 25:
        level = 'watch'
    else:
        level = 'ok'

    actions = []
    if codes & {LOW_COMPLETION, QUIZ_STREAK, INACTIVE, CRITICAL_INACTIVE}:
        actions.append('notify')
    if LOW_RETENTION in codes:
        actions.append('suggest_review')

    return {
        'enrolled_days': enrolled_days,
        'completion_ratio': completion,
        'expected_ratio': expected,
        'pace_gap': expected - completion,
        'days_since_last_active': inactive_days,
        'consecutive_low_quizzes': low_quizzes,
        'avg_quiz_score': metrics.get('avg_quiz_score'),
        'practice_attempts': int(metrics.get('practice_attempts') or 0),
        'retention_score': retention,
        'risk_score': risk_score,
        'risk_level': level,
        'reasons': reasons,
        'suggested_actions': actions,
        'baseline_positive': LOW_COMPLETION in codes or QUIZ_STREAK in codes,
    }


def _median(values):
    ordered = sorted(values)
    count = len(ordered)
    if count == 0:
        return None
    mid = count // 2
    if count % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def _quiz_scores(events, submissions):
    event_assignment_ids = set()
    timeline = []
    for event in events:
        if event.event_type != LearningEvent.QUIZ_SUBMITTED:
            continue
        if event.payload is None:
            continue
        score = event.payload.get('score')
        assignment_id = event.payload.get('assignment_id')
        if assignment_id is not None:
            event_assignment_ids.add(int(assignment_id))
        if score is None:
            continue
        timeline.append((event.occurred_at, float(score)))
    for submission in submissions:
        if submission.assignment.assignment_type != 'quiz' or submission.score is None:
            continue
        if submission.assignment_id in event_assignment_ids:
            continue
        timeline.append((submission.submitted_at, float(submission.score)))
    timeline.sort(key=lambda item: (item[0], item[1]))
    return [score for _, score in timeline]


def analyze_course(course, now=None):
    now = now or timezone.now()
    today = local_date(now)
    enrollments = list(
        Enrollment.objects.filter(course=course).select_related('student')
    )
    student_ids = [item.student_id for item in enrollments]
    total_lessons = Lesson.objects.filter(module__course=course).count()

    progress_rows = LessonProgress.objects.filter(
        student_id__in=student_ids, lesson__module__course=course,
    )
    event_rows = list(LearningEvent.objects.filter(course=course, actor_id__in=student_ids))
    submission_rows = list(
        Submission.objects.filter(student_id__in=student_ids, assignment__course=course).select_related('assignment')
    )
    practice_rows = list(
        PracticeLog.objects.filter(student_id__in=student_ids, vocabulary__course=course)
    )

    completed = defaultdict(int)
    progress_times = defaultdict(list)
    for row in progress_rows:
        if row.updated_at and row.updated_at <= now:
            progress_times[row.student_id].append(row.updated_at)
        if row.is_completed:
            completed[row.student_id] += 1

    events_by_student = defaultdict(list)
    for event in event_rows:
        if event.occurred_at and event.occurred_at <= now:
            events_by_student[event.actor_id].append(event)

    submissions_by_student = defaultdict(list)
    for submission in submission_rows:
        if submission.submitted_at and submission.submitted_at <= now:
            submissions_by_student[submission.student_id].append(submission)

    practice_by_student = defaultdict(list)
    for practice in practice_rows:
        if practice.attempt_date and practice.attempt_date <= now:
            practice_by_student[practice.student_id].append(practice)

    lesson_events = defaultdict(list)
    for event in event_rows:
        if event.event_type != LearningEvent.LESSON_COMPLETED or not event.occurred_at:
            continue
        if event.occurred_at > now:
            continue
        lesson_id = event.lesson_id or (event.payload or {}).get('lesson_id')
        if lesson_id:
            lesson_events[event.actor_id].append((local_date(event.occurred_at), lesson_id))

    rows = []
    for enrollment in enrollments:
        student = enrollment.student
        sid = student.id
        completion = (completed[sid] / total_lessons) if total_lessons else 0.0
        activity = []
        activity.extend(progress_times.get(sid, []))
        activity.extend(item.submitted_at for item in submissions_by_student.get(sid, []))
        activity.extend(item.attempt_date for item in practice_by_student.get(sid, []))
        activity.extend(
            event.occurred_at for event in events_by_student.get(sid, [])
            if event.event_type != LearningEvent.ENROLLED
        )
        last_active = max(activity) if activity else enrollment.enrolled_at
        scores = _quiz_scores(events_by_student.get(sid, []), submissions_by_student.get(sid, []))
        practices = practice_by_student.get(sid, [])
        last_practice = max((item.attempt_date for item in practices), default=None)
        metrics = classify_risk({
            'enrolled_days': (today - local_date(enrollment.enrolled_at)).days,
            'completion_ratio': completion,
            'days_since_last_active': (today - local_date(last_active)).days,
            'consecutive_low_quizzes': trailing_low_quizzes(scores),
            'avg_quiz_score': (sum(scores) / len(scores)) if scores else None,
            'practice_attempts': len(practices),
            'practice_correct': sum(1 for item in practices if item.is_correct),
            'days_since_last_practice': (
                (today - local_date(last_practice)).days if last_practice else None
            ),
        })
        full_name = f'{student.first_name} {student.last_name}'.strip() or student.username
        metrics.update({
            'student_id': sid,
            'username': student.username,
            'full_name': full_name,
            'enrolled_at': enrollment.enrolled_at,
            'completed_lessons': completed[sid],
            'total_lessons': total_lessons,
        })
        rows.append(metrics)

    def _ratio_on(student_id, enrolled_on, week_end):
        if enrolled_on > week_end or not total_lessons:
            return None
        done = {lesson_id for day, lesson_id in lesson_events.get(student_id, []) if day <= week_end}
        return len(done) / total_lessons

    weekly = []
    for offset in range(7, -1, -1):
        week_end = today - timedelta(days=7 * offset)
        ratios = []
        enrolled_ages = []
        for enrollment in enrollments:
            enrolled_on = local_date(enrollment.enrolled_at)
            ratio = _ratio_on(enrollment.student_id, enrolled_on, week_end)
            if ratio is None:
                continue
            ratios.append(ratio)
            enrolled_ages.append((week_end - enrolled_on).days)
        median_age = _median(enrolled_ages) or 0
        weekly.append({
            'week_start': (week_end - timedelta(days=6)).isoformat(),
            'median_completion': None if not ratios else round(_median(ratios), 4),
            'expected_completion': round(clamp(median_age / PLAN_DAYS, 0, 1), 4),
        })

    buckets = {'0-24': 0, '25-49': 0, '50-74': 0, '75-100': 0}
    for row in rows:
        percent = row['completion_ratio'] * 100
        if percent < 25:
            buckets['0-24'] += 1
        elif percent < 50:
            buckets['25-49'] += 1
        elif percent < 75:
            buckets['50-74'] += 1
        else:
            buckets['75-100'] += 1

    retentions = [row['retention_score'] for row in rows if row['retention_score'] is not None]
    return {
        'rows': rows,
        'total_lessons': total_lessons,
        'as_of': now,
        'weekly_progress': weekly,
        'completion_buckets': [{'label': label, 'count': count} for label, count in buckets.items()],
        'mean_completion_ratio': (
            sum(row['completion_ratio'] for row in rows) / len(rows) if rows else 0
        ),
        'mean_retention': (sum(retentions) / len(retentions)) if retentions else None,
        'at_risk_count': sum(1 for row in rows if row['risk_level'] in ('at_risk', 'critical')),
    }


def log_learning_event(*, actor, course, event_type, payload=None, lesson=None, assignment=None, occurred_at=None, source='web'):
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
