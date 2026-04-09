from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

from .models import HelpdeskSession


class HelpdeskSessionAccessTests(APITestCase):
	@staticmethod
	def _results(response):
		if isinstance(response.data, dict) and 'results' in response.data:
			return response.data['results']
		return response.data

	def setUp(self):
		self.student = User.objects.create_user(
			email='student@example.com',
			password='testpass123',
			first_name='Student',
			last_name='User',
			role=User.ROLE_USER,
		)
		self.officer = User.objects.create_user(
			email='officer@example.com',
			password='testpass123',
			first_name='Officer',
			last_name='User',
			role=User.ROLE_OFFICER,
		)
		self.admin = User.objects.create_user(
			email='admin@example.com',
			password='testpass123',
			first_name='Admin',
			last_name='User',
			role=User.ROLE_ADMIN,
		)
		self.outsider = User.objects.create_user(
			email='outsider@example.com',
			password='testpass123',
			first_name='Out',
			last_name='Sider',
			role=User.ROLE_USER,
		)

		create_payload = {
			'title': 'Student-Officer call',
			'kind': HelpdeskSession.KIND_AUDIO_CALL,
			'participant_ids': [self.officer.id],
		}
		self.client.force_authenticate(user=self.student)
		response = self.client.post('/api/helpdesk/sessions/', data=create_payload, format='json')
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.session_id = response.data['id']
		self.client.force_authenticate(user=None)

	def test_authenticated_user_can_only_see_own_sessions(self):
		self.client.force_authenticate(user=self.officer)
		response = self.client.get('/api/helpdesk/sessions/')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(self._results(response)), 1)

		self.client.force_authenticate(user=self.outsider)
		response = self.client.get('/api/helpdesk/sessions/')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(self._results(response)), 0)

	def test_outsider_cannot_retrieve_unrelated_session(self):
		self.client.force_authenticate(user=self.outsider)
		response = self.client.get(f'/api/helpdesk/sessions/{self.session_id}/')
		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

	def test_unauthenticated_user_cannot_access_helpdesk_api(self):
		response = self.client.get('/api/helpdesk/sessions/')
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_call_requires_exactly_two_participants(self):
		self.client.force_authenticate(user=self.student)
		payload = {
			'title': 'Invalid call',
			'kind': HelpdeskSession.KIND_VIDEO_CALL,
			'participant_ids': [self.officer.id, self.outsider.id],
		}
		response = self.client.post('/api/helpdesk/sessions/', data=payload, format='json')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_officer_can_create_helpdesk_session(self):
		self.client.force_authenticate(user=self.officer)
		payload = {
			'title': 'Officer starts support call',
			'kind': HelpdeskSession.KIND_AUDIO_CALL,
			'participant_ids': [self.student.id],
		}
		response = self.client.post('/api/helpdesk/sessions/', data=payload, format='json')
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data['created_by_id'], self.officer.id)

	def test_user_cannot_create_session_with_student_participant(self):
		self.client.force_authenticate(user=self.student)
		payload = {
			'title': 'Student to student call',
			'kind': HelpdeskSession.KIND_AUDIO_CALL,
			'participant_ids': [self.outsider.id],
		}
		response = self.client.post('/api/helpdesk/sessions/', data=payload, format='json')
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_candidates_endpoint_for_officer(self):
		self.client.force_authenticate(user=self.officer)
		response = self.client.get('/api/helpdesk/sessions/candidates/')
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		candidate_ids = {item['id'] for item in response.data}
		self.assertIn(self.student.id, candidate_ids)
		self.assertIn(self.admin.id, candidate_ids)
		self.assertNotIn(self.officer.id, candidate_ids)
