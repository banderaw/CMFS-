from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Campus, College, Department, Student, User
from complaints.models import Notification
from feedback.models import FeedbackResponse, FeedbackTemplate, TemplateField


class FeedbackTemplateSecurityAPITests(APITestCase):
    def setUp(self):
        self.campus_a = Campus.objects.create(campus_name='Main Campus')
        self.campus_b = Campus.objects.create(campus_name='North Campus')
        self.college_a = College.objects.create(college_name='Engineering', college_campus=self.campus_a)
        self.college_b = College.objects.create(college_name='Business', college_campus=self.campus_b)
        self.department_a = Department.objects.create(department_name='Software', department_college=self.college_a)
        self.department_b = Department.objects.create(department_name='Accounting', department_college=self.college_b)

        self.admin = self._create_user('admin@example.com', role=User.ROLE_ADMIN)
        self.owner_officer = self._create_user('owner-officer@example.com', role=User.ROLE_OFFICER)
        self.other_officer = self._create_user('other-officer@example.com', role=User.ROLE_OFFICER)
        self.end_user = self._create_user('user@example.com', role=User.ROLE_USER)
        self.targeted_user = self._create_user('targeted@example.com', role=User.ROLE_USER)
        self.non_targeted_user = self._create_user('non-targeted@example.com', role=User.ROLE_USER)

        Student.objects.create(user=self.targeted_user, department=self.department_a)
        Student.objects.create(user=self.non_targeted_user, department=self.department_b)

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

    def test_audience_targeting_filters_active_templates_for_end_user(self):
        campus_template = FeedbackTemplate.objects.create(
            title='Campus Targeted',
            description='Campus based template',
            created_by=self.admin,
            office='Administration',
            status=FeedbackTemplate.STATUS_ACTIVE,
            audience_scope=FeedbackTemplate.AUDIENCE_CAMPUS,
            target_campus=self.campus_a,
            priority=FeedbackTemplate.PRIORITY_MEDIUM,
        )
        TemplateField.objects.create(template=campus_template, label='Campus question', field_type=TemplateField.FIELD_TEXT, is_required=True, order=0)

        user_template = FeedbackTemplate.objects.create(
            title='Specific User Targeted',
            description='User list template',
            created_by=self.admin,
            office='Administration',
            status=FeedbackTemplate.STATUS_ACTIVE,
            audience_scope=FeedbackTemplate.AUDIENCE_USERS,
            priority=FeedbackTemplate.PRIORITY_MEDIUM,
        )
        user_template.target_users.add(self.targeted_user)
        TemplateField.objects.create(template=user_template, label='User question', field_type=TemplateField.FIELD_TEXT, is_required=True, order=0)

        self.client.force_authenticate(user=self.targeted_user)
        targeted_response = self.client.get(reverse('feedback-template-list'))
        self.assertEqual(targeted_response.status_code, 200)
        targeted_titles = {item['title'] for item in targeted_response.data['results']}
        self.assertIn('Campus Targeted', targeted_titles)
        self.assertIn('Specific User Targeted', targeted_titles)

        self.client.force_authenticate(user=self.non_targeted_user)
        non_targeted_response = self.client.get(reverse('feedback-template-list'))
        self.assertEqual(non_targeted_response.status_code, 200)
        non_targeted_titles = {item['title'] for item in non_targeted_response.data['results']}
        self.assertNotIn('Campus Targeted', non_targeted_titles)
        self.assertNotIn('Specific User Targeted', non_targeted_titles)

    def test_activation_creates_notifications_for_visible_end_users(self):
        template = FeedbackTemplate.objects.create(
            title='Officer Campus Template',
            description='New targeted feedback form',
            created_by=self.owner_officer,
            office='Engineering Office',
            status=FeedbackTemplate.STATUS_PENDING,
            audience_scope=FeedbackTemplate.AUDIENCE_CAMPUS,
            target_campus=self.campus_a,
            priority=FeedbackTemplate.PRIORITY_MEDIUM,
        )
        TemplateField.objects.create(
            template=template,
            label='Feedback',
            field_type=TemplateField.FIELD_TEXT,
            is_required=True,
            order=0,
        )

        self.client.force_authenticate(user=self.owner_officer)
        activate_response = self.client.post(reverse('feedback-template-activate', args=[template.pk]))
        self.assertEqual(activate_response.status_code, 200)

        targeted_count = Notification.objects.filter(user=self.targeted_user, title__icontains='Officer Campus Template').count()
        non_targeted_count = Notification.objects.filter(user=self.non_targeted_user, title__icontains='Officer Campus Template').count()

        self.assertGreaterEqual(targeted_count, 1)
        self.assertEqual(non_targeted_count, 0)

    def test_analytics_supports_campus_and_role_filters(self):
        template = FeedbackTemplate.objects.create(
            title='Analytics Template',
            description='Analytics filter test',
            created_by=self.owner_officer,
            office='Engineering Office',
            status=FeedbackTemplate.STATUS_ACTIVE,
            priority=FeedbackTemplate.PRIORITY_MEDIUM,
        )
        TemplateField.objects.create(
            template=template,
            label='Satisfaction',
            field_type=TemplateField.FIELD_RATING,
            is_required=True,
            order=0,
        )

        officer_responder = self._create_user('responder-officer@example.com', role=User.ROLE_OFFICER)
        Student.objects.create(user=self.end_user, department=self.department_a)

        FeedbackResponse.objects.create(template=template, user=self.targeted_user, session_token='session-targeted')
        FeedbackResponse.objects.create(template=template, user=self.non_targeted_user, session_token='session-non-targeted')
        FeedbackResponse.objects.create(template=template, user=officer_responder, session_token='session-officer')

        self.client.force_authenticate(user=self.admin)
        base_url = reverse('feedback-template-analytics', args=[template.pk])

        all_response = self.client.get(base_url)
        self.assertEqual(all_response.status_code, 200)
        self.assertEqual(all_response.data['total_responses'], 3)

        campus_filtered = self.client.get(base_url, {'campus': str(self.campus_a.id)})
        self.assertEqual(campus_filtered.status_code, 200)
        self.assertEqual(campus_filtered.data['total_responses'], 1)

        role_filtered = self.client.get(base_url, {'role': User.ROLE_OFFICER})
        self.assertEqual(role_filtered.status_code, 200)
        self.assertEqual(role_filtered.data['total_responses'], 1)
