from django.contrib.auth import get_user_model
from django.core import mail
from django.core.mail import EmailMultiAlternatives
from django.core.management import call_command
from django.core.management.base import CommandError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from io import StringIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from rest_framework import status
from rest_framework.test import APITestCase
from smtplib import SMTPAuthenticationError
from storages.backends.s3 import S3Storage
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
from config.settings import _normalize_email_password
from .email_backends import EmailDeliveryError, MailjetEmailBackend
from .models import (
	AdminLog, Assignment, Comment, Course, EmailOTP, Enrollment, Intervention, LearningActivity,
	LearningActivityAttempt, LearningActivityItem, LearningEvent, Lesson, LessonProgress,
	Module, Notification, Question, Report, Submission, Test, TestSubmission,
)

User = get_user_model()


class DemoSlideMediaTests(SimpleTestCase):
	def test_demo_slide_is_available_when_debug_is_disabled(self):
		with override_settings(DEBUG=False):
			response = self.client.get('/media/lessons/files/slide_test.pdf')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response['Content-Type'], 'application/pdf')
		self.assertTrue(response.streaming)
		self.assertTrue(b''.join(response.streaming_content).startswith(b'%PDF-'))


class SupabaseStorageTests(SimpleTestCase):
	def test_private_storage_generates_short_lived_signed_urls(self):
		storage = S3Storage(
			bucket_name='lingosphere',
			endpoint_url='https://project.supabase.co/storage/v1/s3',
			region_name='ap-southeast-1',
			access_key='test-access-key',
			secret_key='test-secret-key',
			addressing_style='path',
			signature_version='s3v4',
			querystring_auth=True,
			querystring_expire=300,
		)

		parsed_url = urlparse(storage.url('lessons/files/slide.pdf'))
		query = parse_qs(parsed_url.query)

		self.assertEqual(parsed_url.scheme, 'https')
		self.assertEqual(parsed_url.netloc, 'project.supabase.co')
		self.assertIn('/storage/v1/s3/lingosphere/lessons/files/slide.pdf', parsed_url.path)
		self.assertEqual(query['X-Amz-Expires'], ['300'])
		self.assertIn('X-Amz-Signature', query)

	def test_media_sync_requires_supabase_storage(self):
		with override_settings(SUPABASE_STORAGE_ENABLED=False):
			with self.assertRaises(CommandError):
				call_command('sync_media_to_supabase', stdout=StringIO())

	def test_media_sync_preserves_paths_and_does_not_replace_existing_files(self):
		with TemporaryDirectory() as media_root:
			file_path = Path(media_root) / 'lessons' / 'files' / 'slide.pdf'
			file_path.parent.mkdir(parents=True)
			file_path.write_bytes(b'%PDF-demo')

			with (
				override_settings(
					SUPABASE_STORAGE_ENABLED=True,
					MEDIA_ROOT=Path(media_root),
				),
				patch('lms_core.management.commands.sync_media_to_supabase.default_storage') as storage,
			):
				storage.exists.return_value = False
				call_command('sync_media_to_supabase', stdout=StringIO())
				self.assertEqual(storage.save.call_args.args[0], 'lessons/files/slide.pdf')
				self.assertEqual(storage.save.call_args.args[1].name, 'lessons/files/slide.pdf')

				storage.reset_mock()
				storage.exists.return_value = True
				call_command('sync_media_to_supabase', stdout=StringIO())
				storage.save.assert_not_called()


class TransactionalEmailBackendTests(SimpleTestCase):
	@override_settings(MAILJET_API_KEY='test-api-key', MAILJET_SECRET_KEY='test-secret-key')
	@patch('lms_core.email_backends.requests.post')
	def test_mailjet_backend_sends_plain_text_email_over_https(self, post):
		post.return_value.status_code = 200
		post.return_value.json.return_value = {'Messages': [{'Status': 'success'}]}
		message = EmailMultiAlternatives(
			'OTP verification',
			'Your code is 123456.',
			'LingoSphere <verified@example.com>',
			['Learner <learner@example.com>'],
		)

		sent = MailjetEmailBackend().send_messages([message])

		self.assertEqual(sent, 1)
		self.assertEqual(post.call_args.args[0], 'https://api.mailjet.com/v3.1/send')
		self.assertEqual(post.call_args.kwargs['auth'], ('test-api-key', 'test-secret-key'))
		payload = post.call_args.kwargs['json']['Messages'][0]
		self.assertEqual(payload['From'], {
			'Name': 'LingoSphere',
			'Email': 'verified@example.com',
		})
		self.assertEqual(payload['To'], [{
			'Name': 'Learner',
			'Email': 'learner@example.com',
		}])
		self.assertEqual(payload['TextPart'], 'Your code is 123456.')
		self.assertEqual(post.call_args.kwargs['timeout'], (5, 20))

	@override_settings(MAILJET_API_KEY='test-api-key', MAILJET_SECRET_KEY='test-secret-key')
	@patch('lms_core.email_backends.requests.post')
	def test_mailjet_backend_reports_provider_status_without_exposing_credentials(self, post):
		post.return_value.status_code = 401
		message = EmailMultiAlternatives(
			'OTP verification',
			'Your code is 123456.',
			'verified@example.com',
			['learner@example.com'],
		)

		with self.assertRaises(EmailDeliveryError) as error:
			MailjetEmailBackend().send_messages([message])

		self.assertEqual(error.exception.provider_status, 401)
		self.assertNotIn('test-api-key', str(error.exception))
		self.assertNotIn('test-secret-key', str(error.exception))

	@override_settings(MAILJET_API_KEY='test-api-key', MAILJET_SECRET_KEY='test-secret-key')
	@patch('lms_core.email_backends.requests.post')
	def test_mailjet_backend_rejects_unsuccessful_message_status(self, post):
		post.return_value.status_code = 200
		post.return_value.json.return_value = {'Messages': [{'Status': 'error'}]}
		message = EmailMultiAlternatives(
			'OTP verification',
			'Your code is 123456.',
			'verified@example.com',
			['learner@example.com'],
		)

		with self.assertRaisesMessage(EmailDeliveryError, 'Mailjet did not accept the email.'):
			MailjetEmailBackend().send_messages([message])

	@override_settings(MAILJET_API_KEY='', MAILJET_SECRET_KEY='')
	def test_mailjet_backend_fails_explicitly_when_credentials_are_missing(self):
		message = EmailMultiAlternatives(
			'OTP verification',
			'Your code is 123456.',
			'verified@example.com',
			['learner@example.com'],
		)

		with self.assertRaisesMessage(EmailDeliveryError, 'Mailjet API credentials are not configured.'):
			MailjetEmailBackend().send_messages([message])

	def test_gmail_app_password_whitespace_is_normalized_only_for_gmail(self):
		self.assertEqual(
			_normalize_email_password('smtp.gmail.com', 'abcd efgh ijkl mnop'),
			'abcdefghijklmnop',
		)
		self.assertEqual(
			_normalize_email_password('smtp.example.com', 'password with spaces'),
			'password with spaces',
		)


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


class CourseOwnershipRegressionTests(APITestCase):
	def setUp(self):
		self.owner = User.objects.create_user(
			username='draft-owner', password='test-password', role='instructor'
		)
		self.other_instructor = User.objects.create_user(
			username='other-instructor', password='test-password', role='instructor'
		)
		self.admin = User.objects.create_user(
			username='course-admin', password='test-password', role='admin'
		)
		self.draft = Course.objects.create(
			title='Owner draft', description='Private course', instructor=self.owner,
		)
		self.module = Module.objects.create(course=self.draft, title='Draft module')
		self.lesson = Lesson.objects.create(module=self.module, title='Draft lesson')

	def test_instructor_can_list_and_open_own_unpublished_course(self):
		self.client.force_authenticate(self.owner)
		response = self.client.get(reverse('instructor_course_list'))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual([course['id'] for course in response.data], [self.draft.pk])
		response = self.client.get(reverse('course_list_create'))
		self.assertIn(self.draft.pk, [course['id'] for course in response.data['results']])
		response = self.client.get(reverse('course_detail', args=[self.draft.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		response = self.client.get(reverse('instructor_course_detail', args=[self.draft.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)

	def test_other_instructor_cannot_open_or_manage_another_instructors_draft(self):
		self.client.force_authenticate(self.other_instructor)
		self.assertEqual(
			self.client.get(reverse('instructor_course_list')).status_code,
			status.HTTP_200_OK,
		)
		self.assertNotIn(
			self.draft.pk,
			[course['id'] for course in self.client.get(reverse('instructor_course_list')).data],
		)
		self.assertEqual(
			self.client.get(reverse('course_detail', args=[self.draft.pk])).status_code,
			status.HTTP_404_NOT_FOUND,
		)
		self.assertEqual(
			self.client.get(reverse('instructor_course_detail', args=[self.draft.pk])).status_code,
			status.HTTP_404_NOT_FOUND,
		)
		self.assertEqual(
			self.client.put(
				reverse('course_detail', args=[self.draft.pk]),
				{'title': 'Changed', 'description': 'Changed'},
				format='json',
			).status_code,
			status.HTTP_404_NOT_FOUND,
		)
		self.assertEqual(
			self.client.post(
				reverse('module_create'),
				{'course': self.draft.pk, 'title': 'Injected module'},
				format='json',
			).status_code,
			status.HTTP_403_FORBIDDEN,
		)
		self.assertEqual(
			self.client.post(
				reverse('lesson_create'),
				{'module': self.module.pk, 'title': 'Injected lesson'},
				format='json',
			).status_code,
			status.HTTP_403_FORBIDDEN,
		)
		self.assertEqual(Module.objects.filter(course=self.draft).count(), 1)
		self.assertEqual(Lesson.objects.filter(module=self.module).count(), 1)

	def test_instructor_can_open_and_manage_own_draft_and_admin_can_open_it(self):
		self.client.force_authenticate(self.owner)
		response = self.client.post(
			reverse('module_create'),
			{'course': self.draft.pk, 'title': 'Owner module'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.client.force_authenticate(self.admin)
		self.assertEqual(
			self.client.get(reverse('course_detail', args=[self.draft.pk])).status_code,
			status.HTTP_200_OK,
		)


class PasswordAndAdminAccountSafetyTests(APITestCase):
	def setUp(self):
		self.admin = User.objects.create_user(
			username='safe-admin', password='test-password', role='admin'
		)
		self.learner = User.objects.create_user(
			username='safe-learner', password='test-password', role='learner'
		)

	def test_admin_cannot_toggle_own_account_but_can_toggle_another_user(self):
		self.client.force_authenticate(self.admin)
		response = self.client.post(reverse('toggle_status', args=[self.admin.pk]))
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.admin.refresh_from_db()
		self.assertTrue(self.admin.is_active)

		response = self.client.post(reverse('toggle_status', args=[self.learner.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.learner.refresh_from_db()
		self.assertFalse(self.learner.is_active)

	def test_change_password_rejects_weak_password_and_accepts_strong_password(self):
		self.client.force_authenticate(self.learner)
		response = self.client.post(
			reverse('change_password'), {'new_password': 'weak'}, format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.learner.refresh_from_db()
		self.assertTrue(self.learner.check_password('test-password'))

		response = self.client.post(
			reverse('change_password'),
			{'new_password': 'A-strong-password-834!'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.learner.refresh_from_db()
		self.assertTrue(self.learner.check_password('A-strong-password-834!'))


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

	def test_course_and_module_updates_can_notify_enrolled_learners(self):
		Enrollment.objects.create(student=self.learner, course=self.course)
		self.client.force_authenticate(self.instructor)
		module_response = self.client.post(
			reverse('module_create'),
			{'course': self.course.pk, 'title': 'New module', 'order': 1},
			format='json',
		)
		self.assertEqual(module_response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(Notification.objects.filter(user=self.learner).count(), 1)
		self.assertEqual(Notification.objects.get(user=self.learner).target_url, f'/courses/{self.course.id}')

		module_response = self.client.patch(
			reverse('module_detail', args=[module_response.data['id']]),
			{'title': 'Renamed module', 'notify_students': 'false'},
			format='json',
		)
		self.assertEqual(module_response.status_code, status.HTTP_200_OK)
		self.assertEqual(Notification.objects.filter(user=self.learner).count(), 1)

		response = self.client.patch(
			reverse('course_detail', args=[self.course.pk]),
			{'title': 'Updated course', 'notify_students': 'true'},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(Notification.objects.filter(user=self.learner).count(), 2)

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

	@override_settings(
		EMAIL_BACKEND='lms_core.email_backends.MailjetEmailBackend',
		MAILJET_API_KEY='test-api-key',
		MAILJET_SECRET_KEY='test-secret-key',
		DEFAULT_FROM_EMAIL='LingoSphere <verified@example.com>',
	)
	@patch('lms_core.email_backends.requests.post')
	def test_registration_otp_uses_mailjet_transactional_api(self, post):
		post.return_value.status_code = 200
		post.return_value.json.return_value = {'Messages': [{'Status': 'success'}]}

		response = self.client.post(
			reverse('request_registration_otp'),
			{'email': 'new-learner@example.com'},
			format='json',
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(post.call_count, 1)
		payload = post.call_args.kwargs['json']['Messages'][0]
		self.assertEqual(payload['To'][0]['Email'], 'new-learner@example.com')
		self.assertIn('Mã xác minh của bạn là ', payload['TextPart'])
		self.assertEqual(EmailOTP.objects.filter(
			email='new-learner@example.com',
			purpose='registration',
		).count(), 1)

	@patch('lms_core.views.send_mail', side_effect=SMTPAuthenticationError(535, b'auth rejected'))
	def test_otp_email_failure_is_reported_without_logging_recipient(self, send_mail_mock):
		with self.assertLogs('lms_core.views', level='ERROR') as captured:
			response = self.client.post(
				reverse('request_registration_otp'),
				{'email': 'private-recipient@example.com'},
				format='json',
			)

		self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
		self.assertEqual(response.data['error'], 'Không gửi được email xác thực. Vui lòng thử lại sau.')
		self.assertFalse(EmailOTP.objects.filter(email='private-recipient@example.com').exists())
		self.assertNotIn('private-recipient@example.com', '\n'.join(captured.output))
		self.assertNotIn('auth rejected', '\n'.join(captured.output))
		send_mail_mock.assert_called_once()

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

	def test_slide_lesson_returns_uploaded_material_and_pages(self):
		module = Module.objects.create(course=self.course, title='Slide module')
		self.client.force_authenticate(self.instructor)
		with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
			response = self.client.post(
				reverse('lesson_create'),
				{
					'module': module.pk,
					'title': 'Slide lesson',
					'lesson_type': 'slide',
					'content': 'Read the attached slides.',
					'attached_file': SimpleUploadedFile('slides.pdf', b'%PDF-test'),
				},
				format='multipart',
			)
			self.assertEqual(response.status_code, status.HTTP_201_CREATED)
			self.assertIn('slides.pdf', response.data['attached_file'])
			lesson = Lesson.objects.get(pk=response.data['id'])
			from .models import LessonPage
			LessonPage.objects.create(lesson=lesson, page_number=1, content='Slide page one')
			detail = self.client.get(reverse('lesson_detail', args=[lesson.pk]))
			self.assertEqual(detail.status_code, status.HTTP_200_OK)
			self.assertEqual(detail.data['pages'][0]['content'], 'Slide page one')

	def test_instructor_can_create_and_update_lesson_pages_with_progress_content(self):
		module = Module.objects.create(course=self.course, title='Multi-page module')
		Enrollment.objects.create(student=self.learner, course=self.course)
		self.client.force_authenticate(self.instructor)

		response = self.client.post(
			reverse('lesson_create'),
			{
				'module': module.pk,
				'title': 'Paged lesson',
				'lesson_type': 'text',
				'content': 'Page one\n\n[[PAGE]]\n\nPage two',
				'pages': json.dumps([{'content': 'Page one'}, {'content': 'Page two'}]),
				'order': 1,
			},
			format='multipart',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		lesson_id = response.data['id']
		self.assertEqual([page['content'] for page in response.data['pages']], ['Page one', 'Page two'])

		response = self.client.patch(
			reverse('lesson_detail', args=[lesson_id]),
			{
				'content': 'Updated page one\n\n[[PAGE]]\n\nUpdated page two',
				'pages': json.dumps([{'content': 'Updated page one'}, {'content': 'Updated page two'}]),
				'notify_students': 'false',
			},
			format='multipart',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
		self.assertEqual(response.data['pages'][1]['content'], 'Updated page two')
		self.assertEqual(Notification.objects.filter(user=self.learner).count(), 1)

		response = self.client.patch(
			reverse('lesson_detail', args=[lesson_id]),
			{
				'content': 'Final page',
				'pages': json.dumps([{'content': 'Final page'}]),
			},
			format='multipart',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(Notification.objects.filter(user=self.learner).count(), 2)
		notification = Notification.objects.filter(user=self.learner).order_by('-id').first()
		self.assertEqual(notification.target_url, f'/courses/{self.course.id}/lessons/{lesson_id}')

	def test_instructor_course_options_include_owned_draft_for_prerequisites(self):
		draft = Course.objects.create(
			title='Prerequisite draft', description='Draft', instructor=self.instructor,
		)
		self.client.force_authenticate(self.instructor)
		response = self.client.get(reverse('instructor_course_options'))
		self.assertIn(draft.pk, [course['id'] for course in response.data])

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
		Enrollment.objects.create(student=self.learner, course=self.course)
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
		self.assertEqual(response.data[0]['answers'][str(question.pk)], 'B')
		self.client.force_authenticate(self.instructor)
		response = self.client.get(reverse('assignment_grading', args=[assignment.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['questions'][0]['correct_option'], 'B')
		self.assertEqual(response.data['submissions'][0]['answers'][str(question.pk)], 'B')

	def test_other_instructor_cannot_view_course_assignments_or_grading_data(self):
		assignment = Assignment.objects.create(
			course=self.course, title='Private quiz', assignment_type='quiz',
		)
		other = User.objects.create_user(
			username='unrelated-instructor', password='test-password', role='instructor',
		)
		self.client.force_authenticate(other)
		self.assertEqual(
			self.client.get(reverse('course_assignments', args=[self.course.pk])).status_code,
			status.HTTP_403_FORBIDDEN,
		)
		self.assertEqual(
			self.client.get(reverse('assignment_grading', args=[assignment.pk])).status_code,
			status.HTTP_403_FORBIDDEN,
		)

	def test_editing_quiz_recalculates_existing_submission_score(self):
		assignment = Assignment.objects.create(
			course=self.course, title='Editable quiz', assignment_type='quiz',
		)
		question = Question.objects.create(
			assignment=assignment, content='Question', option_a='A', option_b='B',
			option_c='C', option_d='D', correct_option='A',
		)
		Enrollment.objects.create(student=self.learner, course=self.course)
		submission = Submission.objects.create(
			assignment=assignment,
			student=self.learner,
			score=10,
			answers={str(question.pk): 'A'},
		)

		self.client.force_authenticate(self.instructor)
		response = self.client.patch(
			reverse('assignment_detail', args=[assignment.pk]),
			{
				'title': 'Updated quiz',
				'questions': [{
					'content': 'Question updated',
					'option_a': 'A',
					'option_b': 'B',
					'option_c': 'C',
					'option_d': 'D',
					'correct_option': 'B',
				}],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
		submission.refresh_from_db()
		self.assertEqual(submission.score, 0)
		self.assertEqual(response.data['questions'][0]['correct_option'], 'B')
		notification = Notification.objects.get(user=self.learner)
		self.assertEqual(notification.target_url, f'/courses/{self.course.id}/assignments/{assignment.id}')

	def test_scheduled_assignment_and_notification_open_at_the_scheduled_time(self):
		opens_at = timezone.now() + timedelta(hours=1)
		assignment = Assignment.objects.create(
			course=self.course,
			title='Scheduled quiz',
			assignment_type='quiz',
			is_published=True,
			publish_at=opens_at,
		)
		question = Question.objects.create(
			assignment=assignment, content='Question', option_a='A', option_b='B',
			option_c='C', option_d='D', correct_option='A',
		)
		Enrollment.objects.create(student=self.learner, course=self.course)
		Notification.objects.create(
			user=self.learner,
			course=self.course,
			title='Scheduled assignment',
			message='Will be available later',
			target_url=f'/courses/{self.course.id}/assignments/{assignment.id}',
			available_at=opens_at,
		)
		self.client.force_authenticate(self.learner)
		self.assertEqual(self.client.get(reverse('course_assignments', args=[self.course.pk])).data, [])
		self.assertEqual(self.client.get(reverse('assignment_detail', args=[assignment.pk])).status_code, status.HTTP_404_NOT_FOUND)
		self.assertEqual(self.client.get(reverse('notifications')).data, [])
		self.assertEqual(
			self.client.post(
				reverse('submit_assignment', args=[assignment.pk]),
				{'answers': {str(question.pk): 'A'}},
				format='json',
			).status_code,
			status.HTTP_403_FORBIDDEN,
		)

		with patch('lms_core.views.timezone.now', return_value=opens_at + timedelta(seconds=1)):
			self.assertEqual(len(self.client.get(reverse('course_assignments', args=[self.course.pk])).data), 1)
			self.assertEqual(self.client.get(reverse('assignment_detail', args=[assignment.pk])).status_code, status.HTTP_200_OK)
			self.assertEqual(len(self.client.get(reverse('notifications')).data), 1)
			response = self.client.post(
				reverse('submit_assignment', args=[assignment.pk]),
				{'answers': {str(question.pk): 'A'}},
				format='json',
			)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['score'], 10)

	def test_assignment_prompt_and_question_attachments_are_available_to_learners(self):
		Enrollment.objects.create(student=self.learner, course=self.course)
		self.client.force_authenticate(self.instructor)
		with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
			file_assignment = self.client.post(
				reverse('course_assignments', args=[self.course.pk]),
				{
					'title': 'File prompt',
					'assignment_type': 'file',
					'module': '',
					'deadline': '',
					'prompt_file': SimpleUploadedFile('prompt.pdf', b'%PDF-prompt'),
					'questions': '[]',
				},
				format='multipart',
			)
			self.assertEqual(file_assignment.status_code, status.HTTP_201_CREATED, file_assignment.data)
			self.assertIn('prompt.pdf', file_assignment.data['prompt_file'])
			self.assertIsNone(file_assignment.data['module'])

			quiz = self.client.post(
				reverse('course_assignments', args=[self.course.pk]),
				{
					'title': 'Quiz with image',
					'assignment_type': 'quiz',
					'questions': [{
						'content': 'See image',
						'option_a': 'A', 'option_b': 'B', 'option_c': 'C', 'option_d': 'D',
						'correct_option': 'A',
					}],
				},
				format='json',
			)
			self.assertEqual(quiz.status_code, status.HTTP_201_CREATED, quiz.data)
			question_id = quiz.data['questions'][0]['id']
			upload = self.client.post(
				reverse('question_attachment', args=[question_id]),
				{'attachment': SimpleUploadedFile('diagram.png', b'fake-image-data', content_type='image/png')},
				format='multipart',
			)
			self.assertEqual(upload.status_code, status.HTTP_200_OK, upload.data)

		self.client.force_authenticate(self.learner)
		response = self.client.get(reverse('assignment_detail', args=[quiz.data['id']]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn('diagram.png', response.data['questions'][0]['attachment'])

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


class AdvancedComponentsApiTests(APITestCase):
	def setUp(self):
		self.instructor = User.objects.create_user(
			username='advanced-instructor', password='test-password', role='instructor',
		)
		self.other_instructor = User.objects.create_user(
			username='other-advanced-instructor', password='test-password', role='instructor',
		)
		self.learner = User.objects.create_user(
			username='advanced-learner', password='test-password', role='learner',
		)
		self.course = Course.objects.create(
			title='Advanced components course',
			description='Test course',
			instructor=self.instructor,
			is_published=True,
		)
		self.module = Module.objects.create(course=self.course, title='Practice module')
		self.lesson = Lesson.objects.create(module=self.module, title='Lesson one')
		self.lesson_two = Lesson.objects.create(module=self.module, title='Lesson two')
		self.enrollment = Enrollment.objects.create(student=self.learner, course=self.course)

	def test_analytics_explains_risk_and_limits_dashboard_to_course_owner(self):
		Enrollment.objects.filter(pk=self.enrollment.pk).update(
			enrolled_at=timezone.now() - timedelta(days=18),
		)
		progress = LessonProgress.objects.create(
			student=self.learner,
			lesson=self.lesson,
			is_completed=True,
		)
		LessonProgress.objects.filter(pk=progress.pk).update(
			updated_at=timezone.now() - timedelta(days=1),
		)
		for index, score in enumerate((3, 4)):
			assignment = Assignment.objects.create(
				course=self.course,
				title=f'Risk quiz {index + 1}',
				assignment_type='quiz',
			)
			submitted_at = timezone.now() - timedelta(days=3 - index)
			submission = Submission.objects.create(
				assignment=assignment,
				student=self.learner,
				score=score,
			)
			Submission.objects.filter(pk=submission.pk).update(submitted_at=submitted_at)
			LearningEvent.objects.create(
				actor=self.learner,
				course=self.course,
				assignment=assignment,
				event_type=LearningEvent.QUIZ_SUBMITTED,
				payload={'score': score, 'assignment_id': assignment.id},
				occurred_at=submitted_at,
			)
		activity = LearningActivity.objects.create(
			course=self.course,
			module=self.module,
			created_by=self.instructor,
			title='Short quiz',
			activity_type=LearningActivity.QUIZ,
			is_published=True,
		)
		LearningActivityAttempt.objects.create(
			activity=activity,
			student=self.learner,
			score=2,
			completed_items=1,
			total_items=1,
		)

		self.client.force_authenticate(self.instructor)
		response = self.client.get(reverse('course_analytics', args=[self.course.pk]))
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['enrolled_count'], 1)
		row = response.data['students'][0]
		self.assertEqual(row['risk_level'], 'at_risk')
		self.assertIn('quiz_failures', [reason['code'] for reason in row['reasons']])
		self.assertEqual(row['quiz_count'], 3)
		self.assertEqual(len(response.data['weekly_progress']), 8)
		self.assertAlmostEqual(response.data['weekly_progress'][-1]['mean_quiz_score'], 3.0)

		self.client.force_authenticate(self.other_instructor)
		self.assertEqual(
			self.client.get(reverse('course_analytics', args=[self.course.pk])).status_code,
			status.HTTP_403_FORBIDDEN,
		)

	def test_instructor_intervention_notifies_at_risk_student_once_per_24_hours(self):
		Enrollment.objects.filter(pk=self.enrollment.pk).update(
			enrolled_at=timezone.now() - timedelta(days=18),
		)
		for lesson in (self.lesson, self.lesson_two):
			lesson_progress = LessonProgress.objects.create(
				student=self.learner,
				lesson=lesson,
				is_completed=False,
			)
			LessonProgress.objects.filter(pk=lesson_progress.pk).update(
				updated_at=timezone.now() - timedelta(days=10),
			)

		self.client.force_authenticate(self.instructor)
		url = reverse('course_intervention', args=[self.course.pk])
		first = self.client.post(url, {'student_id': self.learner.pk, 'action': 'notify'}, format='json')
		self.assertEqual(first.status_code, status.HTTP_201_CREATED)
		self.assertFalse(first.data['deduplicated'])
		notification = Notification.objects.get(pk=first.data['notification_id'])
		self.assertEqual(notification.target_url, f'/courses/{self.course.pk}')
		second = self.client.post(url, {'student_id': self.learner.pk, 'action': 'notify'}, format='json')
		self.assertEqual(second.status_code, status.HTTP_200_OK)
		self.assertTrue(second.data['deduplicated'])
		self.assertEqual(Intervention.objects.filter(course=self.course).count(), 1)

	def test_activity_creation_visibility_scoring_and_enrollment_permissions(self):
		self.client.force_authenticate(self.instructor)
		response = self.client.post(
			reverse('course_learning_activities', args=[self.course.pk]),
			{
				'title': 'Vocabulary check',
				'description': 'Practice short answers',
				'activity_type': 'vocabulary',
				'is_published': True,
				'items': [
					{'prompt': 'Type hello', 'answer': 'Hello'},
					{'prompt': 'Type goodbye', 'answer': 'Goodbye'},
				],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		activity_id = response.data['id']
		self.assertEqual(response.data['items'][0]['answer'], 'Hello')
		self.assertEqual(
			[question['order'] for question in response.data['items']],
			[1, 2],
		)
		updated = self.client.patch(
			reverse('learning_activity_detail', args=[activity_id]),
			{
				'items': [
					{'prompt': 'Type goodbye', 'answer': 'Goodbye'},
					{'prompt': 'Type hello', 'answer': 'Hello'},
				],
			},
			format='json',
		)
		self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)
		self.assertEqual(
			[question['order'] for question in updated.data['items']],
			[1, 2],
		)

		self.client.force_authenticate(self.learner)
		activity = self.client.get(reverse('learning_activity_detail', args=[activity_id]))
		self.assertEqual(activity.status_code, status.HTTP_200_OK)
		self.assertNotIn('answer', activity.data['items'][0])
		attempt = self.client.post(
			reverse('learning_activity_attempt', args=[activity_id]),
			{'responses': [
				{'item_id': activity.data['items'][0]['id'], 'answer': ' goodbye '},
				{'item_id': activity.data['items'][1]['id'], 'answer': 'wrong'},
			]},
			format='json',
		)
		self.assertEqual(attempt.status_code, status.HTTP_201_CREATED, attempt.data)
		self.assertEqual(attempt.data['score'], 5.0)
		self.assertEqual(attempt.data['completed_items'], 2)
		self.assertEqual(LearningEvent.objects.filter(
			actor=self.learner,
			event_type=LearningEvent.ACTIVITY_SUBMITTED,
		).count(), 1)

		unenrolled = User.objects.create_user(
			username='unenrolled-learner', password='test-password', role='learner',
		)
		self.client.force_authenticate(unenrolled)
		self.assertEqual(
			self.client.get(reverse('learning_activity_detail', args=[activity_id])).status_code,
			status.HTTP_403_FORBIDDEN,
		)

	def test_published_course_outline_hides_other_instructors_drafts(self):
		published_assignment = Assignment.objects.create(
			course=self.course,
			module=self.module,
			title='Published assignment',
			assignment_type='quiz',
			is_published=True,
		)
		draft_assignment = Assignment.objects.create(
			course=self.course,
			module=self.module,
			title='Private draft assignment',
			assignment_type='quiz',
			is_published=False,
		)
		published = LearningActivity.objects.create(
			course=self.course,
			module=self.module,
			created_by=self.instructor,
			title='Published activity',
			activity_type=LearningActivity.QUIZ,
			is_published=True,
		)
		draft = LearningActivity.objects.create(
			course=self.course,
			module=self.module,
			created_by=self.instructor,
			title='Private draft activity',
			activity_type=LearningActivity.QUIZ,
			is_published=False,
		)
		self.client.force_authenticate(self.other_instructor)
		response = self.client.get(reverse('course_detail', args=[self.course.pk]))

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		outline = response.data['modules'][0]
		self.assertEqual([item['id'] for item in outline['assignments']], [published_assignment.pk])
		self.assertNotIn(draft_assignment.pk, [item['id'] for item in outline['assignments']])
		self.assertEqual([item['id'] for item in outline['activities']], [published.pk])
		self.assertNotIn(draft.pk, [item['id'] for item in outline['activities']])

	def test_writing_activity_records_strokes_without_claiming_automatic_accuracy(self):
		self.client.force_authenticate(self.instructor)
		response = self.client.post(
			reverse('course_learning_activities', args=[self.course.pk]),
			{
				'title': 'Write あ',
				'activity_type': 'writing',
				'is_published': True,
				'items': [{'prompt': 'Practice the character', 'answer': 'あ'}],
			},
			format='json',
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		activity_id = response.data['id']

		self.client.force_authenticate(self.learner)
		detail = self.client.get(reverse('learning_activity_detail', args=[activity_id]))
		self.assertEqual(detail.data['items'][0]['target'], 'あ')
		attempt = self.client.post(
			reverse('learning_activity_attempt', args=[activity_id]),
			{'responses': [{
				'item_id': detail.data['items'][0]['id'],
				'strokes': [[[0.1, 0.1], [0.5, 0.5], [0.9, 0.8]]],
			}]},
			format='json',
		)
		self.assertEqual(attempt.status_code, status.HTTP_201_CREATED, attempt.data)
		self.assertIsNone(attempt.data['score'])
		self.assertEqual(attempt.data['completed_items'], 1)
		self.assertEqual(
			LearningActivityAttempt.objects.get(pk=attempt.data['id']).responses[0]['strokes'][0],
			[[0.1, 0.1], [0.5, 0.5], [0.9, 0.8]],
		)
