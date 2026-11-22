import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_practice_attempts(apps, schema_editor):
    PracticeLog = apps.get_model('lms_core', 'PracticeLog')
    PracticeAttempt = apps.get_model('lms_core', 'PracticeAttempt')
    LearningActivityAttempt = apps.get_model('lms_core', 'LearningActivityAttempt')
    for log in PracticeLog.objects.select_related('vocabulary').iterator():
        vocabulary = log.vocabulary
        kind = vocabulary.kind if vocabulary.kind in ('typing', 'stroke') else 'typing'
        PracticeAttempt.objects.update_or_create(
            practice_log=log,
            defaults={
                'student_id': log.student_id,
                'course_id': vocabulary.course_id,
                'vocabulary_id': vocabulary.id,
                'kind': kind,
                'is_correct': log.is_correct,
                'score': None,
                'attempted_at': log.attempt_date,
            },
        )
    for attempt in LearningActivityAttempt.objects.select_related('activity').iterator():
        activity = attempt.activity
        is_correct = None
        if attempt.score is not None and activity.activity_type != 'writing':
            is_correct = float(attempt.score) >= 5
        PracticeAttempt.objects.update_or_create(
            activity_attempt=attempt,
            defaults={
                'student_id': attempt.student_id,
                'course_id': activity.course_id,
                'activity_id': activity.id,
                'kind': activity.activity_type,
                'is_correct': is_correct,
                'score': attempt.score,
                'attempted_at': attempt.submitted_at,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('lms_core', '0016_analytics_main_flow'),
    ]

    operations = [
        migrations.CreateModel(
            name='CourseRiskPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('plan_days', models.PositiveIntegerField(default=28)),
                ('min_enrolled_days', models.PositiveIntegerField(default=14)),
                ('low_completion_ratio', models.FloatField(default=0.4)),
                ('inactive_days', models.PositiveIntegerField(default=7)),
                ('inactive_completion_below', models.FloatField(default=0.8)),
                ('critical_inactive_days', models.PositiveIntegerField(default=14)),
                ('quiz_fail_below', models.FloatField(default=5.0)),
                ('quiz_streak_min', models.PositiveIntegerField(default=3)),
                ('retention_min_attempts', models.PositiveIntegerField(default=5)),
                ('retention_flag_below', models.FloatField(default=40.0)),
                ('watch_score', models.FloatField(default=25)),
                ('at_risk_score', models.FloatField(default=50)),
                ('critical_score', models.FloatField(default=75)),
                ('course', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='risk_policy', to='lms_core.course')),
            ],
        ),
        migrations.CreateModel(
            name='PracticeAttempt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('typing', 'Gõ'), ('stroke', 'Vẽ nét'), ('quiz', 'Trắc nghiệm ngắn'), ('vocabulary', 'Luyện từ vựng'), ('writing', 'Luyện viết')], max_length=16)),
                ('is_correct', models.BooleanField(blank=True, null=True)),
                ('score', models.FloatField(blank=True, null=True)),
                ('attempted_at', models.DateTimeField(db_index=True)),
                ('activity', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='lms_core.learningactivity')),
                ('activity_attempt', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='fact', to='lms_core.learningactivityattempt')),
                ('course', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='practice_attempts', to='lms_core.course')),
                ('practice_log', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='fact', to='lms_core.practicelog')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='practice_attempts', to=settings.AUTH_USER_MODEL)),
                ('vocabulary', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='lms_core.vocabulary')),
            ],
        ),
        migrations.RunPython(backfill_practice_attempts, migrations.RunPython.noop),
    ]
