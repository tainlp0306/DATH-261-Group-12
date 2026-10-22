from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Course

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
				'requirements': '',
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
