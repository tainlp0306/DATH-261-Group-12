import json
from datetime import datetime, timedelta, timezone as dt_timezone
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from lms_core.models import (
    Assignment,
    Course,
    Enrollment,
    LearningEvent,
    Lesson,
    LessonProgress,
    Module,
    Notification,
    Question,
    Submission,
)
from lms_core.services.analytics import (
    analyze_course,
    classify_risk,
    retention_score,
    trailing_low_quizzes,
)

User = get_user_model()


def _metrics(**overrides):
    base = {
        'enrolled_days': 0,
        'completion_ratio': 0,
        'days_since_last_active': 0,
        'consecutive_low_quizzes': 0,
        'avg_quiz_score': None,
        'practice_attempts': 0,
        'practice_correct': 0,
        'days_since_last_practice': None,
    }
    base.update(overrides)
    return base


class AnalyticsFormulaTests(TestCase):
    def test_quiz_streak_edges(self):
        self.assertEqual(trailing_low_quizzes([]), 0)
        self.assertEqual(trailing_low_quizzes([4, 3, 2]), 3)
        self.assertEqual(trailing_low_quizzes([2, 9, 4, 4]), 2)
        self.assertEqual(trailing_low_quizzes([1, 1, 5]), 0)
        self.assertEqual(trailing_low_quizzes([1, 1, 4.99]), 3)
        self.assertEqual(trailing_low_quizzes([3, None, 3]), 2)
        self.assertEqual(trailing_low_quizzes([3, 5, None, 4]), 1)

    def test_retention_edges(self):
        self.assertIsNone(retention_score(4, 4, 0))
        self.assertIsNone(retention_score(5, 5, None))
        self.assertEqual(retention_score(5, 5, 0), 100.0)
        self.assertEqual(retention_score(5, 5, 7), 50.0)
        self.assertEqual(retention_score(5, 5, 14), 25.0)
        self.assertEqual(retention_score(5, 0, 0), 0.0)
        self.assertEqual(retention_score(10, 5, 0), 50.0)

    def test_completion_threshold_is_exclusive_and_needs_14_days(self):
        open_case = classify_risk(_metrics(enrolled_days=14, completion_ratio=0.40))
        self.assertNotIn('low_completion_after_two_weeks', [r['code'] for r in open_case['reasons']])
        closed = classify_risk(_metrics(enrolled_days=14, completion_ratio=0.399))
        self.assertIn('low_completion_after_two_weeks', [r['code'] for r in closed['reasons']])
        early = classify_risk(_metrics(enrolled_days=13, completion_ratio=0))
        self.assertNotIn('low_completion_after_two_weeks', [r['code'] for r in early['reasons']])

    def test_inactivity_boundaries(self):
        almost = classify_risk(_metrics(days_since_last_active=6, completion_ratio=0.5, enrolled_days=20))
        self.assertNotIn('inactive_and_incomplete', [r['code'] for r in almost['reasons']])
        exact = classify_risk(_metrics(days_since_last_active=7, completion_ratio=0.5, enrolled_days=20))
        self.assertIn('inactive_and_incomplete', [r['code'] for r in exact['reasons']])
        finished_enough = classify_risk(_metrics(days_since_last_active=7, completion_ratio=0.80, enrolled_days=20))
        self.assertNotIn('inactive_and_incomplete', [r['code'] for r in finished_enough['reasons']])
        done = classify_risk(_metrics(days_since_last_active=14, completion_ratio=1, enrolled_days=28))
        self.assertNotIn('critical_inactivity', [r['code'] for r in done['reasons']])
        not_done = classify_risk(_metrics(days_since_last_active=14, completion_ratio=0.99, enrolled_days=28))
        self.assertEqual(not_done['risk_level'], 'critical')

    def test_quiz_flag_needs_three_and_score_is_not_enough_alone_to_hide_it(self):
        two = classify_risk(_metrics(consecutive_low_quizzes=2, enrolled_days=3, completion_ratio=1))
        self.assertEqual(two['risk_level'], 'ok')
        three = classify_risk(_metrics(consecutive_low_quizzes=3, enrolled_days=3, completion_ratio=1))
        self.assertEqual(three['risk_level'], 'at_risk')
        self.assertTrue(three['baseline_positive'])
        self.assertEqual(three['suggested_actions'], ['notify'])

    def test_high_score_without_a_hard_flag_is_still_at_risk(self):
        row = classify_risk(_metrics(enrolled_days=13, completion_ratio=0, days_since_last_active=6))
        self.assertEqual(row['reasons'], [])
        self.assertGreaterEqual(row['risk_score'], 50)
        self.assertEqual(row['risk_level'], 'at_risk')

    def test_crammer_shape_is_not_caught_by_the_baseline(self):
        row = classify_risk(_metrics(
            enrolled_days=18,
            completion_ratio=1,
            days_since_last_active=16,
            practice_attempts=15,
            practice_correct=15,
            days_since_last_practice=16,
            avg_quiz_score=8.5,
        ))
        self.assertFalse(row['baseline_positive'])
        self.assertEqual(row['risk_level'], 'at_risk')
        self.assertIn('low_retention', [r['code'] for r in row['reasons']])
        self.assertNotIn('inactive_and_incomplete', [r['code'] for r in row['reasons']])
        self.assertIn('suggest_review', row['suggested_actions'])

    def test_mild_struggle_stays_ok(self):
        row = classify_risk(_metrics(
            enrolled_days=10,
            completion_ratio=0.45,
            days_since_last_active=1,
            consecutive_low_quizzes=2,
        ))
        self.assertEqual(row['risk_level'], 'ok')
        self.assertFalse(row['baseline_positive'])

    def test_zero_lessons_do_not_divide_by_zero_via_ratio_zero(self):
        row = classify_risk(_metrics(enrolled_days=20, completion_ratio=0, days_since_last_active=20))
        self.assertEqual(row['risk_level'], 'critical')


class AnalyticsApiTests(APITestCase):
    def setUp(self):
        self.instructor = User.objects.create_user('owner', 'owner@example.com', 'Owner-pass-261', role='instructor')
        self.other = User.objects.create_user('other', 'other@example.com', 'Other-pass-261', role='instructor')
        self.admin = User.objects.create_user('root', 'root@example.com', 'Admin-pass-261', role='admin')
        self.learner = User.objects.create_user('learner', 'learner@example.com', 'Learn-pass-261', role='learner')
        self.course = Course.objects.create(title='Ngữ pháp', description='Mô tả', instructor=self.instructor, is_published=True)
        self.module = Module.objects.create(course=self.course, title='M1', order=0)
        self.lessons = [
            Lesson.objects.create(module=self.module, title=f'L{i}', order=i, content='x')
            for i in range(5)
        ]

    def _enroll(self, student=None, days_ago=20):
        student = student or self.learner
        enrollment = Enrollment.objects.create(student=student, course=self.course)
        Enrollment.objects.filter(pk=enrollment.pk).update(enrolled_at=timezone.now() - timedelta(days=days_ago))
        return enrollment

    def test_timezone_day_is_vietnam_not_utc(self):
        enrollment = Enrollment.objects.create(student=self.learner, course=self.course)
        enrolled_at = datetime(2026, 10, 17, 17, 30, tzinfo=dt_timezone.utc)
        Enrollment.objects.filter(pk=enrollment.pk).update(enrolled_at=enrolled_at)
        now = datetime(2026, 10, 18, 2, 0, tzinfo=dt_timezone.utc)
        row = analyze_course(self.course, now)['rows'][0]
        self.assertEqual(row['enrolled_days'], 0)
        self.assertEqual(row['days_since_last_active'], 0)

    def test_no_lessons_does_not_crash(self):
        empty = Course.objects.create(title='Trống', description='x', instructor=self.instructor, is_published=True)
        enrollment = Enrollment.objects.create(student=self.learner, course=empty)
        Enrollment.objects.filter(pk=enrollment.pk).update(enrolled_at=timezone.now() - timedelta(days=20))
        report = analyze_course(empty)
        self.assertEqual(report['rows'][0]['completion_ratio'], 0)
        self.assertEqual(report['total_lessons'], 0)

    def test_events_keep_quiz_history_when_submission_is_overwritten(self):
        self._enroll(days_ago=3)
        assignment = Assignment.objects.create(course=self.course, title='Q', assignment_type='quiz')
        Submission.objects.create(assignment=assignment, student=self.learner, score=9)
        for score in (3, 3, 3):
            LearningEvent.objects.create(
                actor=self.learner,
                course=self.course,
                assignment=assignment,
                event_type=LearningEvent.QUIZ_SUBMITTED,
                payload={'assignment_id': assignment.id, 'score': score},
                occurred_at=timezone.now() - timedelta(days=1),
            )
        row = analyze_course(self.course)['rows'][0]
        self.assertEqual(row['consecutive_low_quizzes'], 3)

    def test_submission_fallback_ignores_file_scores_and_uses_latest_pass(self):
        self._enroll(days_ago=3)
        file_task = Assignment.objects.create(course=self.course, title='Tệp', assignment_type='file')
        Submission.objects.create(assignment=file_task, student=self.learner, score=1)
        passing = Assignment.objects.create(course=self.course, title='Đỗ', assignment_type='quiz')
        Submission.objects.create(assignment=passing, student=self.learner, score=5)
        failing = Assignment.objects.create(course=self.course, title='Trượt', assignment_type='quiz')
        older = Submission.objects.create(assignment=failing, student=self.learner, score=4)
        Submission.objects.filter(pk=older.pk).update(submitted_at=timezone.now() - timedelta(days=2))
        row = analyze_course(self.course)['rows'][0]
        self.assertEqual(row['consecutive_low_quizzes'], 0)

    def test_other_course_is_isolated(self):
        self._enroll()
        other_course = Course.objects.create(title='Khác', description='x', instructor=self.instructor, is_published=True)
        other_student = User.objects.create_user('outsider', 'out@example.com', 'Outsider-261', role='learner')
        Enrollment.objects.create(student=other_student, course=other_course)
        names = {row['username'] for row in analyze_course(self.course)['rows']}
        self.assertEqual(names, {'learner'})

    def test_permissions_and_invalid_filter(self):
        self._enroll(days_ago=21)
        LessonProgress.objects.create(student=self.learner, lesson=self.lessons[0], is_completed=True)
        self.client.force_authenticate(self.learner)
        self.assertEqual(self.client.get(f'/api/auth/courses/{self.course.id}/analytics/overview/').status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/auth/courses/{self.course.id}/analytics/at-risk/').status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f'/api/auth/courses/{self.course.id}/analytics/overview/').status_code, 200)
        self.client.force_authenticate(self.instructor)
        response = self.client.get(f'/api/auth/courses/{self.course.id}/analytics/at-risk/?level=nope')
        self.assertEqual(response.status_code, 400)
        response = self.client.get(f'/api/auth/courses/{self.course.id}/analytics/overview/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('weekly_progress', response.data)
        self.assertEqual(self.client.get('/api/auth/courses/999999/analytics/overview/').status_code, 404)

    def test_intervene_dedupes_and_rejects_bad_targets(self):
        self._enroll(days_ago=21)
        self.client.force_authenticate(self.instructor)
        url = f'/api/auth/courses/{self.course.id}/analytics/intervene/'
        first = self.client.post(url, {'student_id': self.learner.id, 'action': 'notify'}, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertFalse(first.data['deduplicated'])
        self.assertEqual(Notification.objects.filter(user=self.learner, title='Nhắc tiến độ').count(), 1)
        second = self.client.post(url, {'student_id': self.learner.id, 'action': 'notify'}, format='json')
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data['deduplicated'])
        self.assertEqual(Notification.objects.filter(user=self.learner).count(), 1)
        wrong = self.client.post(url, {'student_id': self.learner.id, 'action': 'suggest_review'}, format='json')
        self.assertEqual(wrong.status_code, 400)
        Enrollment.objects.filter(student=self.learner, course=self.course).delete()
        missing = self.client.post(url, {'student_id': self.learner.id, 'action': 'notify'}, format='json')
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(self.client.get(f'/api/auth/courses/{self.course.id}/analytics/at-risk/').data['results'], [])

    def test_learner_analytics_is_only_their_enrollment(self):
        self._enroll(days_ago=2)
        self.client.force_authenticate(self.learner)
        denied = self.client.get('/api/auth/me/analytics/')
        self.assertEqual(denied.status_code, 400)
        other = Course.objects.create(title='Không học', description='x', instructor=self.instructor, is_published=True)
        self.assertEqual(self.client.get(f'/api/auth/me/analytics/?course={other.id}').status_code, 404)
        own = self.client.get(f'/api/auth/me/analytics/?course={self.course.id}')
        self.assertEqual(own.status_code, 200)
        self.assertEqual(own.data['course_id'], self.course.id)
        self.assertNotIn('username', own.data)

    def test_progress_hook_records_completion_once_and_quiz_hook_records_score(self):
        self._enroll(days_ago=1)
        self.client.force_authenticate(self.learner)
        url = f'/api/auth/lessons/{self.lessons[0].id}/progress/'
        self.client.post(url, {'is_completed': True}, format='json')
        self.client.post(url, {'is_completed': True}, format='json')
        self.assertEqual(
            LearningEvent.objects.filter(actor=self.learner, event_type=LearningEvent.LESSON_COMPLETED).count(),
            1,
        )
        assignment = Assignment.objects.create(course=self.course, title='Quiz API', assignment_type='quiz')
        Question.objects.create(
            assignment=assignment, content='1+1', option_a='2', option_b='3', option_c='4', option_d='5', correct_option='A',
        )
        response = self.client.post(
            f'/api/auth/assignments/{assignment.id}/submit/',
            {'answers': {str(assignment.questions.first().id): 'A'}},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        event = LearningEvent.objects.get(actor=self.learner, event_type=LearningEvent.QUIZ_SUBMITTED)
        self.assertEqual(event.payload['score'], 10.0)
        self.assertEqual(event.payload['assignment_id'], assignment.id)


class AnalyticsSeedTests(APITestCase):
    def test_seed_matches_labeled_cohort(self):
        call_command('seed_analytics', '--reset')
        meta_path = Path(__file__).resolve().parent / 'fixtures' / 'analytics_seed_meta.json'
        labels_path = Path(__file__).resolve().parent / 'fixtures' / 'analytics_labels.json'
        meta = json.loads(meta_path.read_text(encoding='utf-8'))
        labels = json.loads(labels_path.read_text(encoding='utf-8'))
        course = Course.objects.get(pk=meta['course_id'])
        now = datetime.fromisoformat(meta['as_of'])
        report = analyze_course(course, now)
        self.assertEqual(len(report['rows']), 24)
        self.assertEqual(report['at_risk_count'], 12)
        predicted = {row['username'] for row in report['rows'] if row['risk_level'] in ('at_risk', 'critical')}
        baseline = {row['username'] for row in report['rows'] if row['baseline_positive']}
        self.assertEqual(predicted, {user for user, persona in labels.items() if persona in {
            'dropout_late', 'dropout_early', 'struggling', 'crammer', 'on_track_break',
        }})
        self.assertEqual(baseline, {user for user, persona in labels.items() if persona in {'dropout_late', 'struggling'}})
        self.assertTrue(any(point['median_completion'] not in (None, 0) for point in report['weekly_progress']))
        call_command('seed_analytics', '--reset')
        self.assertEqual(Course.objects.filter(title='Tiếng Nhật N5 — Chữ và âm').count(), 1)
        self.assertEqual(User.objects.filter(username__startswith='seed_').count(), 25)
