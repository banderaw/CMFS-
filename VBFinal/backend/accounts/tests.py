from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Campus, MaintenanceConfiguration, User


class AccountSecurityAPITests(APITestCase):
    def setUp(self):
        self.admin = self._create_user('admin@example.com', role=User.ROLE_ADMIN)
        self.user = self._create_user('user@example.com', role=User.ROLE_USER)
        self.campus = Campus.objects.create(campus_name='Main Campus')

    def _create_user(self, email, role=User.ROLE_USER, password='Password123!'):
        return User.objects.create_user(
            email=email,
            password=password,
            first_name='Test',
            last_name='User',
            role=role,
        )

    def test_public_endpoint_allowlist_and_admin_endpoint_denial(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(reverse('campuses-list'))
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            reverse('campuses-list'),
            {'campus_name': 'Another Campus'},
            format='json',
        )
        self.assertIn(response.status_code, [401, 403])

        response = self.client.get(reverse('accounts-list'))
        self.assertIn(response.status_code, [401, 403])

        response = self.client.get(reverse('system-maintenance'))
        self.assertEqual(response.status_code, 200)

    @patch('accounts.views.EmailService.send_verification_email')
    def test_public_registration_cannot_set_admin_flags(self, mock_send_verification_email):
        payload = {
            'email': 'new-user@example.com',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'Password123!',
            'confirm_password': 'Password123!',
            'role': User.ROLE_ADMIN,
            'is_staff': True,
            'is_active': False,
        }

        response = self.client.post(reverse('accounts-register'), payload, format='json')

        if response.status_code == 201:
            created_user = User.objects.get(email='new-user@example.com')
            self.assertEqual(created_user.role, User.ROLE_USER)
            self.assertFalse(created_user.is_staff)
            self.assertTrue(created_user.is_active)
            mock_send_verification_email.assert_called_once()
        else:
            self.assertEqual(response.status_code, 400)
            self.assertFalse(User.objects.filter(email='new-user@example.com').exists())
            mock_send_verification_email.assert_not_called()

    def test_admin_user_crud_and_self_profile_restrictions(self):
        self.client.force_authenticate(user=self.admin)

        create_response = self.client.post(
            reverse('accounts-list'),
            {
                'email': 'managed-officer@example.com',
                'first_name': 'Managed',
                'last_name': 'Officer',
                'password': 'Password123!',
                'confirm_password': 'Password123!',
                'role': User.ROLE_OFFICER,
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, 201)

        managed_user = User.objects.get(email='managed-officer@example.com')
        self.assertEqual(managed_user.role, User.ROLE_OFFICER)

        update_response = self.client.patch(
            reverse('accounts-detail', args=[managed_user.pk]),
            {'is_active': False},
            format='json',
        )
        self.assertEqual(update_response.status_code, 200)
        managed_user.refresh_from_db()
        self.assertFalse(managed_user.is_active)

        self.client.force_authenticate(user=self.user)
        self.assertTrue(self.user.is_active)

        self_response = self.client.patch(
            reverse('accounts-me'),
            {
                'first_name': 'Updated',
                'role': User.ROLE_ADMIN,
                'is_active': False,
            },
            format='json',
        )
        self.assertEqual(self_response.status_code, 200)

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Updated')
        self.assertEqual(self.user.role, User.ROLE_USER)
        self.assertTrue(self.user.is_active)

    def test_maintenance_endpoint_public_read_and_admin_update(self):
        self.client.force_authenticate(user=None)

        public_response = self.client.get(reverse('system-maintenance'))
        self.assertEqual(public_response.status_code, 200)
        self.assertFalse(public_response.data['is_enabled'])

        unauthenticated_update = self.client.patch(
            reverse('system-maintenance'),
            {'is_enabled': True, 'message': 'Maintenance in progress'},
            format='json',
        )
        self.assertIn(unauthenticated_update.status_code, [401, 403])

        self.client.force_authenticate(user=self.admin)
        admin_update = self.client.patch(
            reverse('system-maintenance'),
            {'is_enabled': True, 'message': 'Maintenance in progress'},
            format='json',
        )
        self.assertEqual(admin_update.status_code, 200)

        config = MaintenanceConfiguration.get_solo()
        self.assertTrue(config.is_enabled)
        self.assertEqual(config.message, 'Maintenance in progress')
