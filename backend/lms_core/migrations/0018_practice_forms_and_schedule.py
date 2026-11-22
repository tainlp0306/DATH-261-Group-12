import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('lms_core', '0017_course_risk_policy_and_practice_attempt'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='question',
            name='add_to_review',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='vocabulary',
            name='prompt',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='vocabulary',
            name='options',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='vocabulary',
            name='in_queue',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='vocabulary',
            name='source_question',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='review_item',
                to='lms_core.question',
            ),
        ),
        migrations.AlterField(
            model_name='vocabulary',
            name='kind',
            field=models.CharField(
                choices=[
                    ('typing', 'Gõ'),
                    ('stroke', 'Vẽ nét'),
                    ('theory', 'Lý thuyết'),
                    ('choice', 'Trắc nghiệm'),
                ],
                default='typing',
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name='practiceattempt',
            name='kind',
            field=models.CharField(
                choices=[
                    ('typing', 'Gõ'),
                    ('stroke', 'Vẽ nét'),
                    ('theory', 'Lý thuyết'),
                    ('choice', 'Trắc nghiệm'),
                    ('quiz', 'Trắc nghiệm ngắn'),
                    ('vocabulary', 'Luyện từ vựng'),
                    ('writing', 'Luyện viết'),
                ],
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name='PracticeSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('due_at', models.DateTimeField()),
                ('interval_days', models.PositiveIntegerField(default=0)),
                ('last_incorrect_at', models.DateTimeField(blank=True, null=True)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='practice_schedules', to=settings.AUTH_USER_MODEL)),
                ('vocabulary', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='schedules', to='lms_core.vocabulary')),
            ],
            options={
                'constraints': [
                    models.UniqueConstraint(fields=('student', 'vocabulary'), name='unique_practice_schedule'),
                ],
            },
        ),
    ]
