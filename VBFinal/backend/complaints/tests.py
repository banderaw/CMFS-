from datetime import timedelta

from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Officer, User
from complaints.models import Category, CategoryResolver, Comment, Complaint, ComplaintCC, Response, ResolverLevel


class ComplaintSecurityAPITests(APITestCase):
    def setUp(self):
        self.admin = self._create_user('admin@example.com', role=User.ROLE_ADMIN)
        self.user_one = self._create_user('user-one@example.com', role=User.ROLE_USER)
        self.user_two = self._create_user('user-two@example.com', role=User.ROLE_USER)
        self.officer_one = self._create_user('officer-one@example.com', role=User.ROLE_OFFICER)
        self.officer_two = self._create_user('officer-two@example.com', role=User.ROLE_OFFICER)

        Officer.objects.create(user=self.officer_one, employee_id='EMP-001')
        Officer.objects.create(user=self.officer_two, employee_id='EMP-002')

        self.resolver_level = ResolverLevel.objects.create(
            name='Department',
            level_order=1,
        )

        self.category = Category.objects.create(
            office_name='General Support',
            office_description='General complaint routing',
            office_scope=Category.SCOPE_GENERAL,
        )
        CategoryResolver.objects.create(
            category=self.category,
            level=self.resolver_level,
            officer=self.officer_one,
            escalation_time=timedelta(hours=1),
        )

        self.assigned_complaint = Complaint.objects.create(
            submitted_by=self.user_one,
            category=self.category,
            title='Assigned complaint',
            description='Assigned complaint description',
            assigned_officer=self.officer_one,
        )
        self.officer_visible_complaint = Complaint.objects.create(
            submitted_by=self.officer_one,
            category=self.category,
            title='Officer complaint',
            description='Officer submitted complaint',
            assigned_officer=self.officer_two,
        )
        self.hidden_complaint = Complaint.objects.create(
            submitted_by=self.user_two,
            category=self.category,
            title='Hidden complaint',
            description='Complaint not visible to officer one',
            assigned_officer=self.officer_two,
        )
        ComplaintCC.objects.create(complaint=self.hidden_complaint, email=self.user_one.email)

    def _create_user(self, email, role=User.ROLE_USER, password='Password123!'):
        return User.objects.create_user(
            email=email,
            password=password,
            first_name='Test',
            last_name='User',
            role=role,
        )

    def test_complaint_creation_ignores_spoofed_submitter(self):
        self.client.force_authenticate(user=self.user_one)

        response = self.client.post(
            reverse('complaint-list'),
            {
                'title': 'Spoof attempt',
                'description': 'Trying to spoof another submitter',
                'category': self.category.pk,
                'user': self.user_two.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created = Complaint.objects.get(title='Spoof attempt')
        self.assertEqual(created.submitted_by, self.user_one)

    def test_complaint_creation_supports_cc_office_selections(self):
        self.client.force_authenticate(user=self.user_one)

        response = self.client.post(
            reverse('complaint-list'),
            {
                'title': 'CC office complaint',
                'description': 'Complaint with backend office CC selection',
                'category': self.category.pk,
                'cc_office_ids': [self.category.pk],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created = Complaint.objects.get(title='CC office complaint')
        cc_emails = list(created.cc_list.values_list('email', flat=True))
        self.assertIn(self.officer_one.email, cc_emails)

    def test_admin_can_bulk_assign_multiple_officers_to_category(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse('resolver-assignment-bulk-create'),
            {
                'category': self.category.pk,
                'level': self.resolver_level.pk,
                'escalation_time': '1 00:00:00',
                'active': True,
                'officer_ids': [self.officer_one.id, self.officer_two.id],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['count'], 2)

        assignments = CategoryResolver.objects.filter(
            category=self.category,
            level=self.resolver_level,
            officer__in=[self.officer_one, self.officer_two],
        )
        self.assertEqual(assignments.count(), 2)

    def test_complaint_list_scoping_for_admin_officer_user_and_cc(self):
        self.client.force_authenticate(user=self.admin)
        admin_response = self.client.get(reverse('complaint-list'))
        admin_ids = {item['complaint_id'] for item in admin_response.data['results']}
        self.assertSetEqual(
            admin_ids,
            {
                str(self.assigned_complaint.pk),
                str(self.officer_visible_complaint.pk),
                str(self.hidden_complaint.pk),
            },
        )

        self.client.force_authenticate(user=self.officer_one)
        officer_response = self.client.get(reverse('complaint-list'))
        officer_ids = {item['complaint_id'] for item in officer_response.data['results']}
        self.assertSetEqual(
            officer_ids,
            {
                str(self.assigned_complaint.pk),
                str(self.officer_visible_complaint.pk),
                str(self.hidden_complaint.pk),
            },
        )

        self.client.force_authenticate(user=self.user_one)
        user_response = self.client.get(reverse('complaint-list'))
        user_ids = {item['complaint_id'] for item in user_response.data['results']}
        self.assertSetEqual(user_ids, {str(self.assigned_complaint.pk)})

        cc_response = self.client.get(reverse('complaint-cc-complaints'))
        cc_ids = {item['complaint_id'] for item in cc_response.data}
        self.assertSetEqual(cc_ids, {str(self.hidden_complaint.pk)})

    def test_complaint_action_permissions_and_response_comment_rules(self):
        self.client.force_authenticate(user=self.officer_two)
        forbidden_status_change = self.client.post(
            reverse('complaint-change-status', args=[self.assigned_complaint.pk]),
            {'status': 'resolved'},
            format='json',
        )
        self.assertEqual(forbidden_status_change.status_code, 403)

        self.client.force_authenticate(user=self.officer_one)
        allowed_status_change = self.client.post(
            reverse('complaint-change-status', args=[self.assigned_complaint.pk]),
            {'status': 'resolved'},
            format='json',
        )
        self.assertEqual(allowed_status_change.status_code, 200)
        self.assigned_complaint.refresh_from_db()
        self.assertEqual(self.assigned_complaint.status, 'resolved')

        self.client.force_authenticate(user=self.user_one)
        forbidden_response = self.client.post(
            reverse('response-list'),
            {
                'complaint': str(self.assigned_complaint.pk),
                'title': 'User response',
                'message': 'I should not be able to respond',
                'response_type': 'update',
            },
            format='json',
        )
        self.assertEqual(forbidden_response.status_code, 403)

        self.client.force_authenticate(user=self.officer_one)
        response_create = self.client.post(
            reverse('response-list'),
            {
                'complaint': str(self.assigned_complaint.pk),
                'title': 'Officer response',
                'message': 'We are investigating this issue.',
                'response_type': 'update',
            },
            format='json',
        )
        self.assertEqual(response_create.status_code, 201)
        created_response = Response.objects.get(pk=response_create.data['id'])
        self.assertEqual(created_response.responder, self.officer_one)

        self.client.force_authenticate(user=self.user_one)
        comment_create = self.client.post(
            reverse('comment-list'),
            {
                'complaint': str(self.assigned_complaint.pk),
                'comment_type': 'comment',
                'message': 'Thanks for the update.',
                'author': self.user_two.id,
            },
            format='json',
        )
        self.assertEqual(comment_create.status_code, 201)
        created_comment = Comment.objects.get(pk=comment_create.data['id'])
        self.assertEqual(created_comment.author, self.user_one)

    def test_admin_can_reassign_complaint_without_current_level(self):
        CategoryResolver.objects.create(
            category=self.category,
            level=self.resolver_level,
            officer=self.officer_two,
            escalation_time=timedelta(hours=1),
        )
        complaint = Complaint.objects.create(
            submitted_by=self.user_two,
            category=self.category,
            title='Unrouted complaint',
            description='Complaint without a current level',
            assigned_officer=self.officer_one,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            reverse('complaint-reassign', args=[complaint.pk]),
            {
                'officer_id': self.officer_two.id,
                'reason': 'Escalated',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        complaint.refresh_from_db()
        self.assertEqual(complaint.assigned_officer, self.officer_two)
        self.assertEqual(complaint.current_level, self.resolver_level)
