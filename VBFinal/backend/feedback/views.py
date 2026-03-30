from django.shortcuts import render

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Avg, Q
from django.utils import timezone
from datetime import timedelta
from collections import defaultdict
from .models import FeedbackTemplate, TemplateField, FeedbackResponse, FeedbackAnswer
from .serializers import (
    FeedbackTemplateSerializer, 
    FeedbackTemplateCreateSerializer,
    FeedbackResponseSerializer,
    FeedbackAnalyticsSerializer
)


class FeedbackTemplateViewSet(viewsets.ModelViewSet):
    queryset = FeedbackTemplate.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return FeedbackTemplateCreateSerializer
        return FeedbackTemplateSerializer
    
    def get_permissions(self):
        # Temporarily allow all authenticated users for testing
        permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return FeedbackTemplate.objects.none()

        user = self.request.user
        if not user.is_authenticated:
            return FeedbackTemplate.objects.none()

        # For now, allow all authenticated users to see templates for testing
        if user.is_admin():
            return FeedbackTemplate.objects.all()
        elif user.is_officer():
            return FeedbackTemplate.objects.filter(created_by=user)
        else:
            # Allow regular users to see active templates
            return FeedbackTemplate.objects.filter(status=FeedbackTemplate.STATUS_ACTIVE)
    
    def perform_create(self, serializer):
        # Allow both officers and admins to create templates
        if not (self.request.user.is_officer() or self.request.user.is_admin()):
            raise permissions.PermissionDenied("Only officers and admins can create feedback templates")
        serializer.save()
    
    def perform_update(self, serializer):
        if not self.request.user.is_officer():
            raise permissions.PermissionDenied("Only officers can update feedback templates")
        serializer.save()
    
    def perform_destroy(self, instance):
        # Allow both officers and admins to delete templates
        if not (self.request.user.is_officer() or self.request.user.is_admin()):
            raise permissions.PermissionDenied("Only officers and admins can delete feedback templates")
        instance.delete()
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        template = self.get_object()
        if not (request.user.is_officer() or request.user.is_admin()):
            return Response(
                {"error": "Only officers and admins can activate templates"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        template.status = FeedbackTemplate.STATUS_ACTIVE
        template.save()
        return Response({"message": "Template activated successfully"})
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        template = self.get_object()
        if not (request.user.is_officer() or request.user.is_admin()):
            return Response(
                {"error": "Only officers and admins can deactivate templates"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        template.status = FeedbackTemplate.STATUS_INACTIVE
        template.save()
        return Response({"message": "Template deactivated successfully"})
    
    @action(detail=True, methods=['post', 'patch'])
    def approve(self, request, pk=None):
        template = self.get_object()
        if not request.user.is_admin():
            return Response(
                {"error": "Only admins can approve templates"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        template.status = FeedbackTemplate.STATUS_ACTIVE
        template.approved_by = request.user
        template.approved_at = timezone.now()
        template.save()
        return Response({"message": "Template approved successfully"})
    
    @action(detail=True, methods=['post', 'patch'])
    def reject(self, request, pk=None):
        template = self.get_object()
        if not request.user.is_admin():
            return Response(
                {"error": "Only admins can reject templates"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        template.status = FeedbackTemplate.STATUS_REJECTED
        template.save()
        return Response({"message": "Template rejected successfully"})
    
    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        template = self.get_object()
        
        # Check permissions
        if not (request.user.is_admin() or 
                (request.user.is_officer() and template.created_by == request.user)):
            return Response(
                {"error": "Permission denied"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get analytics data
        responses = FeedbackResponse.objects.filter(template=template)
        total_responses = responses.count()
        
        # Field analytics
        field_analytics = {}
        for field in template.fields.all():
            answers = FeedbackAnswer.objects.filter(field=field)
            
            if field.field_type == TemplateField.FIELD_RATING:
                avg_rating = answers.aggregate(avg=Avg('rating_value'))['avg']
                field_analytics[field.label] = {
                    'type': 'rating',
                    'average': round(avg_rating, 2) if avg_rating else 0,
                    'count': answers.count()
                }
            elif field.field_type == TemplateField.FIELD_CHOICE:
                choices = answers.values('choice_value').annotate(count=Count('choice_value'))
                field_analytics[field.label] = {
                    'type': 'choice',
                    'choices': list(choices)
                }
            elif field.field_type == TemplateField.FIELD_NUMBER:
                avg_number = answers.aggregate(avg=Avg('number_value'))['avg']
                field_analytics[field.label] = {
                    'type': 'number',
                    'average': round(avg_number, 2) if avg_number else 0,
                    'count': answers.count()
                }
            else:
                field_analytics[field.label] = {
                    'type': field.field_type,
                    'count': answers.count()
                }
        
        # Response trend (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        daily_responses = responses.filter(
            submitted_at__gte=thirty_days_ago
        ).extra(
            select={'day': 'date(submitted_at)'}
        ).values('day').annotate(count=Count('id')).order_by('day')
        
        analytics_data = {
            'total_responses': total_responses,
            'field_analytics': field_analytics,
            'response_trend': list(daily_responses)
        }
        
        serializer = FeedbackAnalyticsSerializer(analytics_data)
        return Response(serializer.data)


class FeedbackResponseViewSet(viewsets.ModelViewSet):
    queryset = FeedbackResponse.objects.all()
    serializer_class = FeedbackResponseSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['post']  # Only allow creating responses
    
    def create(self, request, *args, **kwargs):
        # Check if template is active
        template_id = request.data.get('template')
        try:
            template = FeedbackTemplate.objects.get(id=template_id)
            if template.status != FeedbackTemplate.STATUS_ACTIVE:
                return Response(
                    {"error": "This feedback form is not currently active"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        except FeedbackTemplate.DoesNotExist:
            return Response(
                {"error": "Template not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check for duplicate submission by user (not IP-based to allow multiple users from same IP)
        if FeedbackResponse.objects.filter(
            template=template, 
            user=request.user,
            submitted_at__gte=timezone.now() - timedelta(hours=24)
        ).exists():
            return Response(
                {"error": "You have already submitted feedback for this form today"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().create(request, *args, **kwargs)
