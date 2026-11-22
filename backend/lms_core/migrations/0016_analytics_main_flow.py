from django.db import migrations, models
from django.db.models import F


def backfill_completed_at(apps, schema_editor):
    LessonProgress = apps.get_model('lms_core', 'LessonProgress')
    LessonProgress.objects.filter(is_completed=True, completed_at__isnull=True).update(
        completed_at=F('updated_at'),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('lms_core', '0015_loginevent'),
        ('lms_core', '0010_vocabulary_practice_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='lessonprogress',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_completed_at, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='learningevent',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('lesson_completed', 'Hoàn thành bài học'),
                    ('quiz_submitted', 'Nộp bài trắc nghiệm'),
                    ('file_submitted', 'Nộp bài tệp'),
                    ('practice_attempt', 'Luyện tập'),
                    ('activity_submitted', 'Hoàn thành bài luyện tập ngắn'),
                    ('enrolled', 'Ghi danh khóa học'),
                ],
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name='intervention',
            name='action',
            field=models.CharField(
                choices=[
                    ('notify', 'Nhắc học viên'),
                    ('suggest_review', 'Gợi ý ôn lại'),
                ],
                max_length=32,
            ),
        ),
    ]
