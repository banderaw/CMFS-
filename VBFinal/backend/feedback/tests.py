from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User
from feedback.models import FeedbackTemplate, TemplateField


class FeedbackTemplateSecurityAPITests(APITestCase):
    def setUp(self):
        self.admin = self._create_user('admin@example.com', role=User.ROLE_ADMIN)
        self.owner_officer = self._create_user('owner-officer@example.com', role=User.ROLE_OFFICER)
        self.other_officer = self._create_user('other-officer@example.com', role=User.ROLE_OFFICER)
        self.end_user = self._create_user('user@example.com', role=User.ROLE_USER)

    def _create_user(self, email, role=User.ROLE_USER, password='Password123!'):
        return User.objects.create_user(
            email=email,
            password=password,
            first_name='Test',
            last_name='User',
            role=role,
        )

    def test_feedback_template_ownership_approval_and_close_flow(self):
        self.client.force_authenticate(user=self.owner_officer)
        create_response = self.client.post(
            reverse('feedback-template-list'),
            {
                'title': 'Owner Template',
                'description': 'Officer-created template',
                'priority': 'medium',
                'fields': [
                    {
                        'label': 'Overall satisfaction',
                        'field_type': 'rating',
                        'options': [],
                        'is_required': True,
                        'order': 0,
                    }
                ],
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, 201)

        template = FeedbackTemplate.objects.get(title='Owner Template')
        self.assertEqual(template.status, FeedbackTemplate.STATUS_PENDING)

        self.client.force_authenticate(user=self.other_officer)
        forbidden_close = self.client.post(reverse('feedback-template-close', args=[template.pk]))
        self.assertIn(forbidden_close.status_code, [403, 404])

        self.client.force_authenticate(user=self.admin)
        approve_response = self.client.post(reverse('feedback-template-approve', args=[template.pk]))
        self.assertEqual(approve_response.status_code, 200)

        template.refresh_from_db()
        self.assertEqual(template.status, FeedbackTemplate.STATUS_ACTIVE)
        self.assertEqual(template.approved_by, self.admin)

        self.client.force_authenticate(user=self.owner_officer)
        close_response = self.client.post(reverse('feedback-template-close', args=[template.pk]))
        self.assertEqual(close_response.status_code, 200)

        template.refresh_from_db()
        self.assertEqual(template.status, FeedbackTemplate.STATUS_CLOSED)

    def test_end_user_only_sees_active_templates(self):
        active_template = FeedbackTemplate.objects.create(
            title='Active Template',
            description='Visible to users',
            created_by=self.admin,
            office='Administration',
            status=FeedbackTemplate.STATUS_ACTIVE,
            priority=FeedbackTemplate.PRIORITY_MEDIUM,
        )
        TemplateField.objects.create(
            template=active_template,
            label='Comments',
            field_type=TemplateField.FIELD_TEXT,
            is_required=True,
            order=0,
        )

        pending_template = FeedbackTemplate.objects.create(
            title='Pending Template',
            description='Not visible to users',
            created_by=self.admin,
            office='Administration',
            status=FeedbackTemplate.STATUS_PENDING,
            priority=FeedbackTemplate.PRIORITY_MEDIUM,
        )
        TemplateField.objects.create(
            template=pending_template,
            label='Score',
            field_type=TemplateField.FIELD_NUMBER,
            is_required=True,
            order=0,
        )

        self.client.force_authenticate(user=self.end_user)
        response = self.client.get(reverse('feedback-template-list'))
        self.assertEqual(response.status_code, 200)

        titles = {item['title'] for item in response.data['results']}
        self.assertIn('Active Template', titles)
        self.assertNotIn('Pending Template', titles)
