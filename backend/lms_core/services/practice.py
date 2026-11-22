"""Pick the next practice item. Grading stays in the attempt view."""

from datetime import datetime, timedelta, timezone as dt_timezone

from django.utils import timezone

_NEVER_MISSED = datetime.min.replace(tzinfo=dt_timezone.utc)

from lms_core.models import PracticeLog, PracticeSchedule, Vocabulary
from lms_core.services.analytics import retention_score

REVIEW_INTERVALS = (1, 3, 7)


def next_interval(current):
    """1 day, then 3, then 7. Later correct answers double the gap."""
    for step in REVIEW_INTERVALS:
        if current < step:
            return step
    return max(current, 1) * 2


def grade_practice_answer(vocabulary, answer):
    submitted = str(answer).strip()
    if vocabulary.kind == Vocabulary.CHOICE:
        options = [str(option).strip() for option in (vocabulary.options or [])]
        return submitted in options and _compact(submitted) == _compact(vocabulary.word)
    if vocabulary.kind in (Vocabulary.THEORY, Vocabulary.STROKE):
        return bool(submitted) and _compact(submitted) == _compact(vocabulary.word)
    return _typing_match(vocabulary, submitted)


def record_schedule(student, vocabulary, is_correct, now=None):
    now = now or timezone.now()
    schedule, _created = PracticeSchedule.objects.get_or_create(
        student=student,
        vocabulary=vocabulary,
        defaults={'due_at': now, 'interval_days': 0},
    )
    if is_correct:
        schedule.interval_days = next_interval(schedule.interval_days)
        schedule.due_at = now + timedelta(days=schedule.interval_days)
    else:
        schedule.interval_days = 1
        schedule.due_at = now
        schedule.last_incorrect_at = now
    schedule.save()
    return schedule


def choose_next_item(student, course, now=None):
    """Due items first, most recent miss first. Otherwise the lowest retention."""
    now = now or timezone.now()
    items = list(
        Vocabulary.objects.filter(course=course, in_queue=True).order_by('id')
    )
    if not items:
        return None, None
    schedules = {
        row.vocabulary_id: row
        for row in PracticeSchedule.objects.filter(student=student, vocabulary__in=items)
    }
    due = []
    for item in items:
        schedule = schedules.get(item.id)
        if schedule is None or schedule.due_at <= now:
            due.append(item)
    if due:
        due.sort(key=lambda item: _recent_miss(schedules.get(item.id)), reverse=True)
        return due[0], 'due'

    logs = PracticeLog.objects.filter(student=student, vocabulary__in=items)
    grouped = {}
    for log in logs:
        grouped.setdefault(log.vocabulary_id, []).append(log)
    weakest = None
    weakest_score = None
    for item in items:
        rows = grouped.get(item.id) or []
        if not rows:
            continue
        last = max(row.attempt_date for row in rows)
        days = max(0, (now - last).total_seconds() / 86400)
        score = retention_score(len(rows), sum(1 for row in rows if row.is_correct), days)
        if score is None:
            continue
        if weakest_score is None or score < weakest_score:
            weakest = item
            weakest_score = score
    if weakest is not None:
        return weakest, 'retention'
    upcoming = sorted(items, key=lambda item: schedules[item.id].due_at)
    return upcoming[0], 'upcoming'


def sync_review_item(question):
    """Exam questions enter the queue only when the teacher marks them."""
    assignment = question.assignment
    marked = bool(question.add_to_review) and assignment.assignment_type == 'quiz'
    if not marked:
        Vocabulary.objects.filter(source_question=question).update(in_queue=False)
        return None
    options = [question.option_a, question.option_b, question.option_c, question.option_d]
    index = ord(question.correct_option.upper()) - ord('A')
    answer = options[index] if 0 <= index < len(options) else ''
    item, _created = Vocabulary.objects.update_or_create(
        source_question=question,
        defaults={
            'course': assignment.course,
            'kind': Vocabulary.CHOICE,
            'prompt': question.content,
            'word': answer,
            'options': [option for option in options if option],
            'meaning': '',
            'romaji': '',
            'in_queue': True,
        },
    )
    return item


def _recent_miss(schedule):
    if schedule is None or schedule.last_incorrect_at is None:
        return (0, _NEVER_MISSED)
    return (1, schedule.last_incorrect_at)


def _compact(value):
    return ''.join(str(value).split()).casefold()


def _typing_match(vocabulary, answer):
    normalized = _compact(answer)
    if not normalized:
        return False
    targets = {_compact(vocabulary.word)}
    if vocabulary.romaji:
        targets.add(_compact(vocabulary.romaji))
    return normalized in targets
