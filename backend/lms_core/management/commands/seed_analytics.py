import json
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from lms_core.models import (
    Assignment,
    Course,
    Enrollment,
    LearningEvent,
    Lesson,
    LessonProgress,
    Module,
    PracticeLog,
    Submission,
    User,
    Vocabulary,
)
from lms_core.services.analytics import analyze_course

SEED_PASSWORD = 'Seed-Analytics-261'
COURSE_TITLE = 'Tiếng Nhật N5 — Chữ và âm'
PERSONAS = (
    ['on_track'] * 8
    + ['on_track_break']
    + ['dropout_late'] * 4
    + ['dropout_early']
    + ['struggling'] * 3
    + ['struggling_mild']
    + ['crammer'] * 3
    + ['too_new'] * 3
)
LABELED_POSITIVE = {'dropout_late', 'dropout_early', 'struggling', 'struggling_mild', 'crammer'}
PREDICTED_POSITIVE = {'dropout_late', 'dropout_early', 'struggling', 'crammer', 'on_track_break'}


def _f1(tp, fp, fn):
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    if precision + recall == 0:
        return 0
    return 2 * precision * recall / (precision + recall)


class Command(BaseCommand):
    help = 'Seed a fixed analytics cohort. Labels come from the scenario, not from the detector.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true')

    def handle(self, *args, **options):
        if Course.objects.filter(title=COURSE_TITLE).exists() and not options['reset']:
            raise CommandError('Khóa seed đã tồn tại. Chạy lại với --reset.')
        if options['reset']:
            User.objects.filter(username__startswith='seed_').delete()
            Course.objects.filter(title=COURSE_TITLE).delete()

        as_of = timezone.now()
        instructor = User.objects.create_user(
            username='seed_instructor',
            email='seed_instructor@lingosphere.local',
            password=SEED_PASSWORD,
            role=User.INSTRUCTOR,
        )
        course = Course.objects.create(
            title=COURSE_TITLE,
            description='Khóa mẫu cho dashboard analytics.',
            instructor=instructor,
            is_published=True,
        )
        lessons = []
        for module_index in range(4):
            module = Module.objects.create(course=course, title=f'Chương {module_index + 1}', order=module_index)
            for lesson_index in range(5):
                lessons.append(Lesson.objects.create(
                    module=module,
                    title=f'Bài {module_index * 5 + lesson_index + 1}',
                    lesson_type='text',
                    content='Nội dung mẫu.',
                    order=lesson_index,
                ))
        vocabularies = [
            Vocabulary.objects.create(course=course, word=f'chữ-{index + 1}', meaning='nghĩa', stroke_data={'strokes': 4})
            for index in range(20)
        ]

        labels = {}
        dropout_early_username = None
        for index, persona in enumerate(PERSONAS, start=1):
            username = f'seed_learner_{index:02d}'
            labels[username] = persona
            if persona == 'dropout_early':
                dropout_early_username = username
            student = User.objects.create_user(
                username=username,
                email=f'{username}@lingosphere.local',
                password=SEED_PASSWORD,
                role=User.LEARNER,
            )
            self._enrol(student, course, persona, as_of, lessons, vocabularies)

        report = analyze_course(course, as_of)
        by_user = {row['username']: row for row in report['rows']}
        predicted = {user for user, row in by_user.items() if row['risk_level'] in ('at_risk', 'critical')}
        baseline = {user for user, row in by_user.items() if row['baseline_positive']}
        expected_predicted = {user for user, persona in labels.items() if persona in PREDICTED_POSITIVE}
        expected_baseline = {user for user, persona in labels.items() if persona in {'dropout_late', 'struggling'}}
        if predicted != expected_predicted or baseline != expected_baseline:
            detail = {
                'missing_predicted': sorted(expected_predicted - predicted),
                'extra_predicted': sorted(predicted - expected_predicted),
                'missing_baseline': sorted(expected_baseline - baseline),
                'extra_baseline': sorted(baseline - expected_baseline),
                'rows': {
                    user: {
                        'persona': labels[user],
                        'level': row['risk_level'],
                        'score': row['risk_score'],
                        'baseline': row['baseline_positive'],
                        'reasons': [item['code'] for item in row['reasons']],
                        'completion': row['completion_ratio'],
                        'inactive': row['days_since_last_active'],
                        'retention': row['retention_score'],
                        'quizzes': row['consecutive_low_quizzes'],
                    }
                    for user, row in sorted(by_user.items())
                },
            }
            raise CommandError(json.dumps(detail, ensure_ascii=False, indent=2))

        labeled_positive = {user for user, persona in labels.items() if persona in LABELED_POSITIVE}
        tp = len(predicted & labeled_positive)
        fp = len(predicted - labeled_positive)
        fn = len(labeled_positive - predicted)
        baseline_tp = len(baseline & labeled_positive)
        baseline_fp = len(baseline - labeled_positive)
        baseline_fn = len(labeled_positive - baseline)

        fixture_dir = Path(__file__).resolve().parents[2] / 'fixtures'
        fixture_dir.mkdir(parents=True, exist_ok=True)
        (fixture_dir / 'analytics_labels.json').write_text(
            json.dumps(labels, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        meta = {
            'as_of': as_of.isoformat(),
            'course_id': course.id,
            'course_title': course.title,
            'instructor': instructor.username,
            'password': SEED_PASSWORD,
            'dropout_early': dropout_early_username,
            'at_risk_count': report['at_risk_count'],
        }
        (fixture_dir / 'analytics_seed_meta.json').write_text(
            json.dumps(meta, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        e2e_meta = Path(__file__).resolve().parents[4] / 'frontend' / 'e2e' / 'seed-meta.json'
        e2e_meta.parent.mkdir(parents=True, exist_ok=True)
        e2e_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')

        self.stdout.write(f'baseline_f1={_f1(baseline_tp, baseline_fp, baseline_fn):.3f}')
        self.stdout.write(f'proposed_f1={_f1(tp, fp, fn):.3f}')
        self.stdout.write(f'course_id={course.id} at_risk_count={report["at_risk_count"]}')

    def _enrol(self, student, course, persona, as_of, lessons, vocabularies):
        if persona == 'on_track':
            enrolled_days, done, last_active = 20, 18, 1
        elif persona == 'on_track_break':
            enrolled_days, done, last_active = 20, 14, 8
        elif persona == 'dropout_late':
            enrolled_days, done, last_active = 21, 5, 17
        elif persona == 'dropout_early':
            enrolled_days, done, last_active = 9, 6, 8
        elif persona == 'struggling':
            enrolled_days, done, last_active = 16, 10, 1
        elif persona == 'struggling_mild':
            enrolled_days, done, last_active = 10, 9, 1
        elif persona == 'crammer':
            enrolled_days, done, last_active = 18, 20, 16
        elif persona == 'too_new':
            enrolled_days, done, last_active = 5, 0, 1
        else:
            raise CommandError(persona)

        enrollment = Enrollment.objects.create(student=student, course=course)
        Enrollment.objects.filter(pk=enrollment.pk).update(enrolled_at=as_of - timedelta(days=enrolled_days))
        active_at = as_of - timedelta(days=last_active)

        if persona == 'crammer':
            slots = [18, 17, 16]
            for index, lesson in enumerate(lessons[:done]):
                self._complete(student, course, lesson, as_of - timedelta(days=slots[index % 3]))
        elif persona == 'on_track':
            for index, lesson in enumerate(lessons[:done]):
                self._complete(student, course, lesson, as_of - timedelta(days=done - index))
        else:
            for lesson in lessons[:done]:
                self._complete(student, course, lesson, active_at)

        if persona == 'too_new':
            progress = LessonProgress.objects.create(student=student, lesson=lessons[0], is_completed=False)
            LessonProgress.objects.filter(pk=progress.pk).update(updated_at=active_at)

        if persona == 'struggling':
            quiz_plan = [(10, 3.0), (5, 4.0), (1, 2.5)]
        elif persona == 'struggling_mild':
            quiz_plan = [(4, 4.0), (1, 3.0)]
        elif persona in ('on_track', 'on_track_break'):
            quiz_plan = [(last_active + 3, 8.0), (last_active, 9.0)]
        elif persona == 'dropout_late':
            quiz_plan = [(17, 8.0)]
        elif persona == 'crammer':
            quiz_plan = [(17, 9.0), (16, 8.5)]
        else:
            quiz_plan = []
        for days_ago, score in quiz_plan:
            self._quiz(student, course, score, as_of - timedelta(days=days_ago))

        if persona in ('on_track', 'on_track_break'):
            for vocab in vocabularies[:12]:
                self._practice(student, vocab, True, active_at)
        elif persona == 'crammer':
            for vocab in vocabularies[:15]:
                self._practice(student, vocab, True, active_at)

    def _complete(self, student, course, lesson, when):
        progress = LessonProgress.objects.create(student=student, lesson=lesson, is_completed=True)
        LessonProgress.objects.filter(pk=progress.pk).update(updated_at=when)
        LearningEvent.objects.create(
            actor=student,
            course=course,
            lesson=lesson,
            event_type=LearningEvent.LESSON_COMPLETED,
            payload={'lesson_id': lesson.id},
            occurred_at=when,
            source='seeder',
        )

    def _quiz(self, student, course, score, when):
        assignment = Assignment.objects.create(
            course=course,
            title=f'Quiz {student.username} {when:%m%d%H%M%S}',
            assignment_type='quiz',
        )
        submission = Submission.objects.create(assignment=assignment, student=student, score=score, feedback='seed')
        Submission.objects.filter(pk=submission.pk).update(submitted_at=when)
        LearningEvent.objects.create(
            actor=student,
            course=course,
            assignment=assignment,
            event_type=LearningEvent.QUIZ_SUBMITTED,
            payload={'assignment_id': assignment.id, 'score': score},
            occurred_at=when,
            source='seeder',
        )

    def _practice(self, student, vocabulary, correct, when):
        practice = PracticeLog.objects.create(student=student, vocabulary=vocabulary, is_correct=correct)
        PracticeLog.objects.filter(pk=practice.pk).update(attempt_date=when)
