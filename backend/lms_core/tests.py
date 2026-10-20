from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from tempfile import TemporaryDirectory
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
from .models import AdminLog, Assignment, Comment, Course, Enrollment, LearningEvent, Lesson, LessonProgress, Module, Notification, PracticeLog, Question, Report, Submission, Test, TestSubmission, Vocabulary

User = get_user_model()


class AdminCourseManagementTests(APITestCase):
	def setUp(self):
		self.admin = User.objects.create_user(
			username='admin-user', password='test-password', role='admin'
		)
		self.instructor = User.objects.create_user(
			username='course-instructor', password='test-password', role='instructor'
		)
		self.course = Course.objects.create(
			title='Course title',
			description='Course description',
			instructor=self.instructor,
			is_published=False,
		)
		self.client.force_authenticate(self.admin)

	def test_admin_can_publish_course(self):
		response = self.client.put(
			reverse('course_detail', args=[self.course.pk]),
			{
				'title': self.course.title,
				'description': self.course.description,
				'is_published': True,
			},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.course.refresh_from_db()
		self.assertTrue(self.course.is_published)

	def test_admin_can_delete_course(self):
		response = self.client.delete(reverse('course_detail', args=[self.course.pk]))

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Course.objects.filter(pk=self.course.pk).exists())
		self.assertTrue(AdminLog.objects.filter(admin=self.admin, action__contains=self.course.title).exists())


class AdminUserDeletionTests(APITestCase):
	def setUp(self):
		self.admin = User.objects.create_user(
			username='admin-user', password='test-password', role='admin'
		)
		self.learner = User.objects.create_user(
			username='learner-user', password='test-password', role='learner'
		)
		self.client.force_authenticate(self.admin)

	def test_admin_can_delete_another_user(self):
		response = self.client.delete(
			reverse('admin_user_delete', args=[self.learner.pk])
		)

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(User.objects.filter(pk=self.learner.pk).exists())

	def test_admin_cannot_delete_own_account(self):
		response = self.client.delete(
			reverse('admin_user_delete', args=[self.admin.pk])
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())


class InstructorDraftCourseTests(APITestCase):
	def setUp(self):
		self.instructor = User.objects.create_user(
			username='draft-instructor', password='test-password', role='instructor'
		)
		self.other = User.objects.create_user(
			username='other-draft-instructor', password='test-password', role='instructor'
		)
		self.learner = User.objects.create_user(
			username='draft-learner', password='test-password', role='learner'
		)
		self.draft = Course.objects.create(
			title='Unpublished kanji', description='Hidden draft',
			instructor=self.instructor, is_published=False,
		)
		self.published = Course.objects.create(
			title='Published kana', description='Visible course',
			instructor=self.instructor, is_published=True,
		)

	def test_catalog_hides_unpublished_courses(self):
		response = self.client.get(reverse('course_list_create'))
		titles = [course['title'] for course in response.data['results']]
		self.assertIn('Published kana', titles)
		self.assertNotIn('Unpublished kanji', titles)

	def test_instructor_lists_own_unpublished_courses(self):
		self.client.force_authenticate(self.instructor)
		response = self.client.get(reverse('instructor_course_list'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		titles = {course['title'] for course in response.data}
		self.assertEqual(titles, {'Unpublished kanji', 'Published kana'})

		self.client.force_authenticate(self.other)
		response = self.client.get(reverse('instructor_course_list'))
		self.assertEqual(response.data, [])

	def test_anonymous_cannot_create_a_course(self):
		response = self.client.post(
			reverse('course_list_create'),
			{'title': 'Sneaky', 'description': 'Should fail', 'is_published': True},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_learner_cannot_enrol_in_unpublished_course(self):
		self.client.force_authenticate(self.learner)
		response = self.client.post(
			reverse('enrollment_list_create'),
			{'course': self.draft.pk},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertFalse(Enrollment.objects.filter(student=self.learner, course=self.draft).exists())

	def test_prerequisites_can_be_cleared_and_accept_several_courses(self):
		first = Course.objects.create(title='First', description='A', instructor=self.instructor, is_published=True)
		second = Course.objects.create(title='Second', description='B', instructor=self.instructor, is_published=True)
		self.client.force_authenticate(self.instructor)
		response = self.client.put(
			reverse('course_detail', args=[self.draft.pk]),
			{
				'title': self.draft.title,
				'description': self.draft.description,
				'is_published': False,
				'prerequisites': [first.pk, second.pk],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertCountEqual(response.data['prerequisites'], [first.pk, second.pk])

		response = self.client.put(
			reverse('course_detail', args=[self.draft.pk]),
			{
				'title': self.draft.title,
				'description': self.draft.description,
				'is_published': False,
				'prerequisites': [],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['prerequisites'], [])
		self.assertEqual(self.draft.prerequisites.count(), 0)

	def test_other_instructor_cannot_edit_or_add_a_module(self):
		self.client.force_authenticate(self.other)
		response = self.client.put(
			reverse('course_detail', args=[self.published.pk]),
			{'title': 'Hijacked', 'description': 'Nope', 'is_published': True},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		response = self.client.post(
			reverse('module_create'),
			{'course': self.draft.pk, 'title': 'Stolen chapter', 'order': 1},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertFalse(Module.objects.filter(course=self.draft).exists())


class NewFeatureApiTests(APITestCase):
	def setUp(self):
		self.admin = User.objects.create_user(
			username='feature-admin', password='test-password', role='admin'
		)
		self.instructor = User.objects.create_user(
			username='feature-instructor', password='test-password', role='instructor'
		)
		self.learner = User.objects.create_user(
			username='feature-learner', email='learner@example.com',
			password='test-password', role='learner'
		)
		self.course = Course.objects.create(
			title='Feature course', description='Course description',
			instructor=self.instructor, is_published=True,
		)

	def test_unpublished_course_details_are_private_to_owner_and_enrolled_learners(self):
		unpublished = Course.objects.create(
			title='Private draft', description='Not published', instructor=self.instructor,
			is_published=False,
		)
		self.client.force_authenticate(user=None)
		response = self.client.get(reverse('course_detail', args=[unpublished.pk]))
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

		self.client.force_authenticate(self.instructor)
		response = self.client.get(reverse('course_detail', args=[unpublished.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)

		self.client.force_authenticate(self.learner)
		response = self.client.get(reverse('course_detail', args=[unpublished.pk]))
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
		Enrollment.objects.create(student=self.learner, course=unpublished)
		response = self.client.get(reverse('course_detail', args=[unpublished.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)

	@override_settings(
		EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
		FRONTEND_URL='http://localhost:5173',
	)
	def test_password_reset_sends_token_and_accepts_new_password(self):
		response = self.client.post(
			reverse('password_reset'), {'email': self.learner.email}, format='json'
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(mail.outbox), 1)
		query = parse_qs(urlparse(mail.outbox[0].body.split()[-1]).query)

		response = self.client.post(
			reverse('password_reset_confirm'),
			{
				'uid': query['uid'][0],
				'token': query['token'][0],
				'new_password': 'A-completely-new-secret-592!',
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.learner.refresh_from_db()
		self.assertTrue(self.learner.check_password('A-completely-new-secret-592!'))

	@override_settings(GOOGLE_OAUTH_CLIENT_ID='google-client-id')
	@patch('lms_core.views.id_token.verify_oauth2_token')
	def test_google_login_creates_learner_and_returns_jwt_pair(self, verify_token):
		verify_token.return_value = {
			'email': 'google-learner@example.com',
			'email_verified': True,
			'name': 'Google Learner',
		}
		response = self.client.post(
			reverse('google_login'), {'id_token': 'verified-token'}, format='json'
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn('access', response.data)
		self.assertIn('refresh', response.data)
		self.assertEqual(User.objects.get(email='google-learner@example.com').role, 'learner')

	def test_learner_can_withdraw_own_enrollment_only(self):
		enrollment = Enrollment.objects.create(student=self.learner, course=self.course)
		self.client.force_authenticate(self.learner)
		response = self.client.delete(reverse('enrollment_detail', args=[enrollment.pk]))
		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Enrollment.objects.filter(pk=enrollment.pk).exists())

	def test_course_instructor_can_create_file_assignment(self):
		self.client.force_authenticate(self.instructor)
		response = self.client.post(
			reverse('course_tests', args=[self.course.pk]),
			{'title': 'Submit project', 'test_type': 'file'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['course'], self.course.pk)

	def test_file_submission_can_be_graded_and_notifies_student(self):
		Enrollment.objects.create(student=self.learner, course=self.course)
		test = Test.objects.create(course=self.course, title='Upload work', test_type='file')
		self.client.force_authenticate(self.learner)
		with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
			response = self.client.post(
				reverse('test_submissions', args=[test.pk]),
				{'submitted_file': SimpleUploadedFile('work.txt', b'answer')},
				format='multipart',
			)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		submission = TestSubmission.objects.get(pk=response.data['id'])

		self.client.force_authenticate(self.instructor)
		response = self.client.patch(
			reverse('grade_submission', args=[submission.pk]),
			{'score': 9, 'feedback': 'Good work'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		submission.refresh_from_db()
		self.assertEqual(submission.score, 9)
		self.assertEqual(submission.feedback, 'Good work')
		self.assertTrue(Notification.objects.filter(user=self.learner).exists())

		self.client.force_authenticate(self.learner)
		response = self.client.get(reverse('notifications'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 1)
		response = self.client.patch(
			reverse('notifications'), {'ids': [response.data[0]['id']]}, format='json'
		)
		self.assertEqual(response.data['updated'], 1)
		self.assertTrue(Notification.objects.get(user=self.learner).is_read)

	def test_comment_report_and_user_status_change_are_recorded(self):
		comment = Comment.objects.create(user=self.learner, course=self.course, content='Reported text')
		self.client.force_authenticate(self.learner)
		response = self.client.post(
			reverse('reports'), {'comment': comment.pk, 'reason': 'Spam'}, format='json'
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		report = Report.objects.get(reported_by=self.learner, comment=comment)

		self.client.force_authenticate(self.admin)
		response = self.client.get(reverse('admin_reports'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data[0]['id'], report.pk)
		response = self.client.patch(
			reverse('admin_report_detail', args=[report.pk]),
			{'is_resolved': True}, format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(Report.objects.get(pk=report.pk).is_resolved)

		response = self.client.post(
			reverse('toggle_status', args=[self.learner.pk]), format='json'
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(AdminLog.objects.filter(admin=self.admin, action__contains=self.learner.username).exists())
		response = self.client.get(reverse('admin_logs'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn(self.learner.username, response.data[0]['action'])

	@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
	def test_registration_requires_email_otp(self):
		response = self.client.post(
			reverse('register'),
			{'username': 'otp-user', 'email': 'otp-user@example.com', 'password': 'Valid-Pass-237!'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

		response = self.client.post(
			reverse('request_registration_otp'),
			{'email': 'otp-user@example.com'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(mail.outbox), 1)
		otp = mail.outbox[0].body.split('là ')[1].split('.')[0]

		response = self.client.post(
			reverse('confirm_registration_otp'),
			{
				'username': 'otp-user',
				'email': 'otp-user@example.com',
				'password': 'Valid-Pass-237!',
				'role': 'learner',
				'otp': otp,
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(User.objects.get(username='otp-user').email, 'otp-user@example.com')

	@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
	def test_password_reset_otp_changes_password(self):
		response = self.client.post(
			reverse('request_otp'), {'email': self.learner.email}, format='json'
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		otp = mail.outbox[0].body.split('là ')[1].split('.')[0]
		new_password = 'New-Password-Safe-672!'

		response = self.client.post(
			reverse('confirm_otp'),
			{'email': self.learner.email, 'otp': otp, 'new_password': new_password},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.learner.refresh_from_db()
		self.assertTrue(self.learner.check_password(new_password))

	def test_course_listing_is_paginated_and_searchable(self):
		for index in range(13):
			Course.objects.create(
				title=f'Paged course {index:02}',
				description='Pagination sample',
				instructor=self.instructor,
				is_published=True,
			)
		response = self.client.get(reverse('course_list_create'), {'page': 1, 'search': 'Paged'})
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['count'], 13)
		self.assertEqual(len(response.data['results']), 12)
		response = self.client.get(reverse('course_list_create'), {'page': 2, 'search': 'Paged'})
		self.assertEqual(len(response.data['results']), 1)

	def test_learner_can_leave_course_by_course_id(self):
		Enrollment.objects.create(student=self.learner, course=self.course)
		self.client.force_authenticate(self.learner)
		response = self.client.delete(reverse('enrollment_leave', args=[self.course.pk]))
		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Enrollment.objects.filter(student=self.learner, course=self.course).exists())

	def test_instructor_can_upload_lesson_attachment(self):
		module = Module.objects.create(course=self.course, title='Materials')
		self.client.force_authenticate(self.instructor)
		with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
			response = self.client.post(
				reverse('lesson_create'),
				{
					'module': module.pk,
					'title': 'Downloadable lesson',
				'lesson_type': 'text',
				'content': 'Lesson notes',
				'order': 1,
					'attached_file': SimpleUploadedFile('notes.pdf', b'%PDF-lesson'),
				},
				format='multipart',
			)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertIn('notes.pdf', response.data['attached_file'])

	def test_prerequisites_are_returned_and_cannot_reference_the_same_course(self):
		prerequisite = Course.objects.create(
			title='Prerequisite', description='Intro', instructor=self.instructor,
		)
		self.client.force_authenticate(self.instructor)
		response = self.client.put(
			reverse('course_detail', args=[self.course.pk]),
			{
				'title': self.course.title,
				'description': self.course.description,
				'is_published': True,
				'prerequisites': [prerequisite.pk],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['prerequisites'], [prerequisite.pk])

		response = self.client.put(
			reverse('course_detail', args=[self.course.pk]),
			{
				'title': self.course.title,
				'description': self.course.description,
				'is_published': True,
				'prerequisites': [self.course.pk],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_last_page_is_saved_and_returned_in_course_progress(self):
		lesson = Lesson.objects.create(
			module=Module.objects.create(course=self.course, title='Pages'),
			title='Long lesson',
		)
		self.client.force_authenticate(self.learner)
		response = self.client.post(
			reverse('lesson_progress_update', args=[lesson.pk]),
			{'last_page': 3},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(LessonProgress.objects.get(student=self.learner, lesson=lesson).last_page, 3)
		response = self.client.get(reverse('student_course_progress', args=[self.course.pk]))
		self.assertEqual(response.data[0]['last_page'], 3)

	def test_course_outline_defers_lesson_content_until_detail_request(self):
		lesson = Lesson.objects.create(
			module=Module.objects.create(course=self.course, title='Outline module'),
			title='Deferred body',
			content='This body loads only after selecting the lesson.',
		)
		response = self.client.get(reverse('course_detail', args=[self.course.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		outline_lesson = response.data['modules'][0]['lessons'][0]
		self.assertEqual(outline_lesson['id'], lesson.pk)
		self.assertNotIn('content', outline_lesson)

		response = self.client.get(reverse('lesson_detail', args=[lesson.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['content'], lesson.content)

	def test_notification_confirmation_is_scoped_to_requesting_user(self):
		notification = Notification.objects.create(
			user=self.learner, title='Update', message='New class material', course=self.course,
		)
		self.client.force_authenticate(self.instructor)
		response = self.client.post(reverse('notification_confirm', args=[notification.pk]))
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
		self.learner.refresh_from_db()
		self.assertFalse(notification.is_read)

		self.client.force_authenticate(self.learner)
		response = self.client.post(reverse('notification_confirm', args=[notification.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(response.data['is_read'])

	def test_course_announcement_reaches_enrolled_students_and_sender(self):
		Enrollment.objects.create(student=self.learner, course=self.course)
		self.client.force_authenticate(self.instructor)
		response = self.client.post(
			reverse('course_announcement', args=[self.course.pk]),
			{'title': 'Schedule', 'message': 'Class begins Monday'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['created'], 2)
		self.assertEqual(Notification.objects.filter(course=self.course).count(), 2)

		another_instructor = User.objects.create_user(
			username='other-instructor', password='test-password', role='instructor'
		)
		self.client.force_authenticate(another_instructor)
		response = self.client.post(
			reverse('course_announcement', args=[self.course.pk]),
			{'title': 'Unauthorized', 'message': 'Should not send'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AssignmentAssessmentApiTests(APITestCase):
	def setUp(self):
		self.instructor = User.objects.create_user(
			username='assignment-instructor', password='test-password', role='instructor'
		)
		self.learner = User.objects.create_user(
			username='assignment-learner', password='test-password', role='learner'
		)
		self.course = Course.objects.create(
			title='Assignment course', description='Assessment API course',
			instructor=self.instructor, is_published=True,
		)

	def test_instructor_creates_quiz_and_learner_submits_answers_with_history(self):
		self.client.force_authenticate(self.instructor)
		response = self.client.post(
			reverse('course_assignments', args=[self.course.pk]),
			{
				'title': 'Chapter quiz',
				'assignment_type': 'quiz',
				'time_limit_minutes': 5,
				'questions': [{
					'content': 'Choose the correct option',
					'option_a': 'A', 'option_b': 'B', 'option_c': 'C', 'option_d': 'D',
					'correct_option': 'B',
				}],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertNotIn('correct_option', response.data['questions'][0])
		assignment = Assignment.objects.get(pk=response.data['id'])
		question = Question.objects.get(assignment=assignment)
		Enrollment.objects.create(student=self.learner, course=self.course)

		self.client.force_authenticate(self.learner)
		response = self.client.post(
			reverse('submit_assignment', args=[assignment.pk]),
			{'answers': {str(question.pk): 'B'}},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['score'], 10)
		response = self.client.get(reverse('assignment_submissions', args=[assignment.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data[0]['score'], 10)

	def test_file_submission_can_be_graded_on_ten_point_scale(self):
		assignment = Assignment.objects.create(
			course=self.course, title='Upload project', assignment_type='file',
		)
		Enrollment.objects.create(student=self.learner, course=self.course)
		self.client.force_authenticate(self.learner)
		with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
			response = self.client.post(
				reverse('submit_assignment', args=[assignment.pk]),
				{'file': SimpleUploadedFile('work.txt', b'assignment answer')},
				format='multipart',
			)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		submission = Submission.objects.get(pk=response.data['id'])

		self.client.force_authenticate(self.instructor)
		response = self.client.patch(
			reverse('grade_submission', args=[submission.pk]) + '?type=assignment',
			{'score': 8.5, 'feedback': 'Good work'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		submission.refresh_from_db()
		self.assertEqual(submission.score, 8.5)
		self.assertEqual(submission.feedback, 'Good work')
		self.assertTrue(Notification.objects.filter(user=self.learner, course=self.course).exists())


class PracticeApiTests(APITestCase):
	def setUp(self):
		self.instructor = User.objects.create_user(
			username='practice-instructor', password='test-password', role='instructor'
		)
		self.learner = User.objects.create_user(
			username='practice-learner', password='test-password', role='learner'
		)
		self.outsider = User.objects.create_user(
			username='practice-outsider', password='test-password', role='learner'
		)
		self.course = Course.objects.create(
			title='Practice course', description='Typing and stroke',
			instructor=self.instructor, is_published=True,
		)
		Enrollment.objects.create(student=self.learner, course=self.course)

	def test_instructor_adds_item_and_learner_retries_until_correct(self):
		self.client.force_authenticate(self.instructor)
		response = self.client.post(
			reverse('course_vocabulary', args=[self.course.pk]),
			{'word': 'こんにちは', 'meaning': 'xin chào', 'romaji': 'konnichiwa', 'kind': 'typing'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		vocabulary = Vocabulary.objects.get(pk=response.data['id'])

		self.client.force_authenticate(self.outsider)
		response = self.client.post(
			reverse('practice_attempt', args=[vocabulary.pk]),
			{'answer': 'こんにちは'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

		self.client.force_authenticate(self.learner)
		response = self.client.post(
			reverse('practice_attempt', args=[vocabulary.pk]),
			{'answer': 'sai'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertFalse(response.data['is_correct'])
		response = self.client.post(
			reverse('practice_attempt', args=[vocabulary.pk]),
			{'answer': 'konnichiwa'},
			format='json',
		)
		self.assertTrue(response.data['is_correct'])
		self.assertEqual(response.data['attempt_count'], 2)
		self.assertEqual(PracticeLog.objects.filter(student=self.learner, vocabulary=vocabulary).count(), 2)
		self.assertTrue(LearningEvent.objects.filter(
			actor=self.learner, course=self.course, event_type='practice_attempt',
		).exists())

	def test_other_instructor_cannot_add_vocabulary(self):
		other = User.objects.create_user(
			username='practice-other', password='test-password', role='instructor'
		)
		self.client.force_authenticate(other)
		response = self.client.post(
			reverse('course_vocabulary', args=[self.course.pk]),
			{'word': '日', 'kind': 'stroke'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
