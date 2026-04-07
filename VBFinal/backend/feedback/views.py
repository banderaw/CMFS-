from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import FeedbackAnswer, FeedbackResponse, FeedbackTemplate, TemplateField
from .notification_service import notify_users_about_template
from .serializers import (
    FeedbackAnalyticsSerializer,
    FeedbackResponseSerializer,
    FeedbackTemplateCreateSerializer,
    FeedbackTemplateSerializer,
)


class FeedbackTemplateViewSet(viewsets.ModelViewSet):
    queryset = FeedbackTemplate.objects.select_related(
        'created_by',
        'approved_by',
        'target_campus',
        'target_college',
        'target_department',
    ).prefetch_related('fields', 'target_users')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return FeedbackTemplateCreateSerializer
        return FeedbackTemplateSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return FeedbackTemplate.objects.none()

        user = self.request.user
        if not user.is_authenticated:
            return FeedbackTemplate.objects.none()
        if user.is_admin():
            return self.queryset
        if user.is_officer():
            return self.queryset.filter(created_by=user)

        base = self.queryset.filter(status=FeedbackTemplate.STATUS_ACTIVE)
        visible_ids = [template.id for template in base if template.is_visible_to_user(user)]
        if not visible_ids:
            return FeedbackTemplate.objects.none()
        return base.filter(id__in=visible_ids)

    def _can_manage_template(self, user, template):
        if not user.is_authenticated:
            return False
        if user.is_admin():
            return True
        return user.is_officer() and template.created_by_id == user.id

    def perform_create(self, serializer):
        if not (self.request.user.is_officer() or self.request.user.is_admin()):
            raise permissions.PermissionDenied('Only officers and admins can create feedback templates')
        template = serializer.save()
        if template.status == FeedbackTemplate.STATUS_ACTIVE:
            notify_users_about_template(template, actor=self.request.user)

    def perform_update(self, serializer):
        template = self.get_object()
        if not self._can_manage_template(self.request.user, template):
            raise permissions.PermissionDenied('You do not have permission to update this template')
        serializer.save()

    def perform_destroy(self, instance):
        if not self._can_manage_template(self.request.user, instance):
            raise permissions.PermissionDenied('You do not have permission to delete this template')
        instance.delete()

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        template = self.get_object()
        if not self._can_manage_template(request.user, template):
            return Response({'error': 'You do not have permission to activate this template'}, status=status.HTTP_403_FORBIDDEN)

        was_active = template.status == FeedbackTemplate.STATUS_ACTIVE
        template.status = FeedbackTemplate.STATUS_ACTIVE
        template.save(update_fields=['status', 'updated_at'])
        if not was_active:
            notify_users_about_template(template, actor=request.user)
        return Response({'message': 'Template activated successfully'})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        template = self.get_object()
        if not self._can_manage_template(request.user, template):
            return Response({'error': 'You do not have permission to deactivate this template'}, status=status.HTTP_403_FORBIDDEN)

        template.status = FeedbackTemplate.STATUS_INACTIVE
        template.save(update_fields=['status', 'updated_at'])
        return Response({'message': 'Template deactivated successfully'})

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        template = self.get_object()
        if not self._can_manage_template(request.user, template):
            return Response({'error': 'You do not have permission to close this template'}, status=status.HTTP_403_FORBIDDEN)

        template.status = FeedbackTemplate.STATUS_CLOSED
        template.save(update_fields=['status', 'updated_at'])
        return Response({'message': 'Template closed successfully'})

    @action(detail=True, methods=['post', 'patch'])
    def approve(self, request, pk=None):
        template = self.get_object()
        if not request.user.is_admin():
            return Response({'error': 'Only admins can approve templates'}, status=status.HTTP_403_FORBIDDEN)

        was_active = template.status == FeedbackTemplate.STATUS_ACTIVE
        template.status = FeedbackTemplate.STATUS_ACTIVE
        template.approved_by = request.user
        template.approved_at = timezone.now()
        template.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
        if not was_active:
            notify_users_about_template(template, actor=request.user)
        return Response({'message': 'Template approved successfully'})

    @action(detail=True, methods=['post', 'patch'])
    def reject(self, request, pk=None):
        template = self.get_object()
        if not request.user.is_admin():
            return Response({'error': 'Only admins can reject templates'}, status=status.HTTP_403_FORBIDDEN)

        template.status = FeedbackTemplate.STATUS_REJECTED
        template.save(update_fields=['status', 'updated_at'])
        return Response({'message': 'Template rejected successfully'})

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        template = self.get_object()
        if not (request.user.is_admin() or (request.user.is_officer() and template.created_by_id == request.user.id)):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        responses = FeedbackResponse.objects.filter(template=template)

        campus_id = request.query_params.get('campus')
        college_id = request.query_params.get('college')
        department_id = request.query_params.get('department')
        role_filter = (request.query_params.get('role') or '').strip().lower()

        if role_filter in {'user', 'officer', 'admin'}:
            responses = responses.filter(user__role=role_filter)

        if campus_id:
            responses = responses.filter(
                Q(user__student_profile__department__department_college__college_campus_id=campus_id)
                | Q(user__officer_profile__college__college_campus_id=campus_id)
                | Q(user__officer_profile__department__department_college__college_campus_id=campus_id)
            )

        if college_id:
            responses = responses.filter(
                Q(user__student_profile__department__department_college_id=college_id)
                | Q(user__officer_profile__college_id=college_id)
                | Q(user__officer_profile__department__department_college_id=college_id)
            )

        if department_id:
            responses = responses.filter(
                Q(user__student_profile__department_id=department_id)
                | Q(user__officer_profile__department_id=department_id)
            )

        responses = responses.distinct()
        total_responses = responses.count()

        field_analytics = {}
        for field in template.fields.all():
            answers = FeedbackAnswer.objects.filter(field=field)

            if field.field_type == TemplateField.FIELD_RATING:
                avg_rating = answers.aggregate(avg=Avg('rating_value'))['avg']
                field_analytics[field.label] = {
                    'type': 'rating',
                    'average': round(avg_rating, 2) if avg_rating else 0,
                    'count': answers.count(),
                }
            elif field.field_type == TemplateField.FIELD_CHOICE:
                choices = answers.values('choice_value').annotate(count=Count('choice_value'))
                field_analytics[field.label] = {
                    'type': 'choice',
                    'choices': list(choices),
                }
            elif field.field_type == TemplateField.FIELD_NUMBER:
                avg_number = answers.aggregate(avg=Avg('number_value'))['avg']
                field_analytics[field.label] = {
                    'type': 'number',
                    'average': round(avg_number, 2) if avg_number else 0,
                    'count': answers.count(),
                }
            else:
                field_analytics[field.label] = {
                    'type': field.field_type,
                    'count': answers.count(),
                }

        thirty_days_ago = timezone.now() - timedelta(days=30)
        daily_responses = (
            responses.filter(submitted_at__gte=thirty_days_ago)
            .extra(select={'day': 'date(submitted_at)'})
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        analytics_data = {
            'total_responses': total_responses,
            'field_analytics': field_analytics,
            'response_trend': list(daily_responses),
            'applied_filters': {
                'campus': campus_id or None,
                'college': college_id or None,
                'department': department_id or None,
                'role': role_filter or None,
            },
        }

        serializer = FeedbackAnalyticsSerializer(analytics_data)
        return Response(serializer.data)


class FeedbackResponseViewSet(viewsets.ModelViewSet):
    queryset = FeedbackResponse.objects.all()
    serializer_class = FeedbackResponseSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['post']

    def create(self, request, *args, **kwargs):
        template_id = request.data.get('template')
        try:
            template = FeedbackTemplate.objects.get(id=template_id)
            if template.status != FeedbackTemplate.STATUS_ACTIVE:
                return Response(
                    {'error': 'This feedback form is not currently active'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except FeedbackTemplate.DoesNotExist:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        if FeedbackResponse.objects.filter(
            template=template,
            user=request.user,
            submitted_at__gte=timezone.now() - timedelta(hours=24),
        ).exists():
            return Response(
                {'error': 'You have already submitted feedback for this form today'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().create(request, *args, **kwargs)
