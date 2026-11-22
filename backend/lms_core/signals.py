from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import LearningActivityAttempt, PracticeAttempt, PracticeLog

QUIZ_CORRECT_AT = 5.0


@receiver(post_save, sender=PracticeLog)
def sync_vocabulary_practice(sender, instance, **kwargs):
    vocabulary = instance.vocabulary
    kind = vocabulary.kind if vocabulary.kind in (PracticeAttempt.TYPING, PracticeAttempt.STROKE) else PracticeAttempt.TYPING
    PracticeAttempt.objects.update_or_create(
        practice_log=instance,
        defaults={
            'student_id': instance.student_id,
            'course_id': vocabulary.course_id,
            'vocabulary_id': vocabulary.id,
            'kind': kind,
            'is_correct': instance.is_correct,
            'score': None,
            'attempted_at': instance.attempt_date,
        },
    )


@receiver(post_save, sender=LearningActivityAttempt)
def sync_activity_practice(sender, instance, **kwargs):
    activity = instance.activity
    is_correct = None
    if instance.score is not None and activity.activity_type != PracticeAttempt.WRITING:
        is_correct = float(instance.score) >= QUIZ_CORRECT_AT
    PracticeAttempt.objects.update_or_create(
        activity_attempt=instance,
        defaults={
            'student_id': instance.student_id,
            'course_id': activity.course_id,
            'activity_id': activity.id,
            'kind': activity.activity_type,
            'is_correct': is_correct,
            'score': instance.score,
            'attempted_at': instance.submitted_at,
        },
    )
