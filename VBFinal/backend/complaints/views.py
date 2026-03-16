from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.shortcuts import get_object_or_404

from .models import Institution, Category, ResolverLevel, CategoryResolver, Complaint, ComplaintAttachment, Comment, Assignment, Response, Notification, AISettingsConfig, AIPriorityKeyword
from .serializers import (
    InstitutionSerializer,
    CategorySerializer,
    ResolverLevelSerializer,
    CategoryResolverSerializer,
    ComplaintSerializer,
    ComplaintCreateSerializer,
    ComplaintAttachmentSerializer,
    CommentSerializer,
    AssignmentSerializer,
    ResponseSerializer,
    NotificationSerializer,
    AISettingsConfigSerializer,
    AIPriorityKeywordSerializer,
)
from .service import service


class InstitutionViewSet(viewsets.ModelViewSet):
    queryset = Institution.objects.all()
    serializer_class = InstitutionSerializer
    permission_classes = [permissions.AllowAny]  # For development


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]  # For development

    @action(detail=False, methods=["get"], url_path="by-language")
    def by_language(self, request):
        """Get categories with language-specific names"""
        language = request.query_params.get('lang', 'en')
        categories = self.get_queryset()
        
        data = []
        for cat in categories:
            category_data = {
                'category_id': cat.category_id,
                'name': cat.name_amharic if language == 'am' and cat.name_amharic else cat.name,
                'description': cat.description_amharic if language == 'am' and cat.description_amharic else cat.description,
                'is_active': cat.is_active
            }
            data.append(category_data)
        
        return DRFResponse(data)

    @action(detail=True, methods=["post"], url_path="add-officer")
    def add_officer(self, request, pk=None):
        """Assign an officer to a category"""
        category = self.get_object()
        officer_id = request.data.get("officer_id")
        category.officers.add(officer_id)
        return DRFResponse({"detail": "Officer added successfully"}, status=status.HTTP_200_OK)


class ResolverLevelViewSet(viewsets.ModelViewSet):
    queryset = ResolverLevel.objects.all()
    serializer_class = ResolverLevelSerializer
    permission_classes = [permissions.AllowAny]  # For development


class CategoryResolverViewSet(viewsets.ModelViewSet):
    queryset = CategoryResolver.objects.all()
    serializer_class = CategoryResolverSerializer
    permission_classes = [permissions.AllowAny]  # For development


class ComplaintViewSet(viewsets.ModelViewSet):
    queryset = Complaint.objects.all()
    def get_serializer_class(self):
        if self.action == 'create':
            return ComplaintCreateSerializer
        return ComplaintSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'can_view_all_complaints') and user.can_view_all_complaints():
            return Complaint.objects.all()
        elif user.is_authenticated and hasattr(user, 'get_accessible_complaints'):
            return user.get_accessible_complaints()
        else:
            # For development/testing, return all complaints
            return Complaint.objects.all()

    def create(self, request, *args, **kwargs):
        # Extract user ID from request data if provided
        user_id = request.data.get('user')
        if user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                submitted_by = User.objects.get(id=user_id)
            except User.DoesNotExist:
                submitted_by = None
        else:
            submitted_by = request.user if request.user.is_authenticated else None
        
        # Create mutable copy of request data
        data = request.data.copy()
        if 'user' in data:
            del data['user']  # Remove user from data as it's handled separately
            
        serializer = self.get_serializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save(submitted_by=submitted_by)
        
        try:
            service.process_complaint(complaint)
            complaint.refresh_from_db()
        except Exception:
            pass
            
        output_serializer = ComplaintSerializer(complaint)
        return DRFResponse(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Assign complaint to an officer"""
        complaint = self.get_object()
        officer_id = request.data.get("officer_id")
        level_id = request.data.get("level_id")
        
        Assignment.objects.create(
            complaint=complaint,
            officer_id=officer_id,
            level_id=level_id,
            reason='manual'
        )
        complaint.assigned_officer_id = officer_id
        complaint.current_level_id = level_id
        complaint.set_escalation_deadline()
        complaint.save()
        
        return DRFResponse({"detail": "Complaint assigned successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reassign")
    def reassign(self, request, pk=None):
        """Reassign complaint to another officer"""
        complaint = self.get_object()
        new_officer_id = request.data.get("officer_id")
        reason = request.data.get("reason", "manual reassignment")
        
        if not new_officer_id:
            return DRFResponse({"error": "officer_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or set a level - if no current level, get the first level or create one
        level = complaint.current_level
        if not level:
            # Try to get the first level for the complaint's institution
            level = ResolverLevel.objects.filter(
                institution=complaint.institution
            ).order_by('level_order').first()
            
            # If still no level exists, create a default one
            if not level:
                level = ResolverLevel.objects.create(
                    institution=complaint.institution,
                    name="Default Level",
                    level_order=1
                )
        
        # Create assignment record
        Assignment.objects.create(
            complaint=complaint,
            officer_id=new_officer_id,
            level=level,
            reason=reason
        )
        
        # Update complaint assignment
        complaint.assigned_officer_id = new_officer_id
        complaint.current_level = level
        complaint.save()
        
        return DRFResponse({
            "detail": "Complaint reassigned successfully",
            "assigned_officer_id": new_officer_id
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        """Update complaint status"""
        complaint = self.get_object()
        new_status = request.data.get("status")
        if new_status not in dict(Complaint.STATUS_CHOICES):
            return DRFResponse({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        complaint.status = new_status
        complaint.save()
        return DRFResponse({"detail": f"Status updated to {new_status}"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        """Escalate complaint to next resolver level"""
        complaint = self.get_object()
        if not complaint.current_level:
            return DRFResponse({"error": "No current level set"}, status=status.HTTP_400_BAD_REQUEST)
        
        next_level = ResolverLevel.objects.filter(
            institution=complaint.institution,
            level_order=complaint.current_level.level_order + 1
        ).first()
        
        if not next_level:
            return DRFResponse({"error": "No higher level available"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find officer at next level for this category
        category_resolver = CategoryResolver.objects.filter(
            category=complaint.category,
            level=next_level,
            active=True
        ).first()
        
        if category_resolver:
            # Create escalation assignment
            Assignment.objects.create(
                complaint=complaint,
                officer=category_resolver.officer,
                level=next_level,
                reason='escalation'
            )
            
            complaint.current_level = next_level
            complaint.assigned_officer = category_resolver.officer
            complaint.set_escalation_deadline()
            complaint.status = "escalated"
            complaint.save()
            
            return DRFResponse({
                "detail": f"Escalated to {next_level.name}",
                "assigned_to": category_resolver.officer.email
            }, status=status.HTTP_200_OK)
        
        return DRFResponse({"error": "No resolver found at next level"}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=["get"], url_path="responses")
    def get_responses(self, request, pk=None):
        """Get all responses for a complaint"""
        complaint = self.get_object()
        responses = Response.objects.filter(complaint=complaint).order_by('-created_at')
        serializer = ResponseSerializer(responses, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=["get"], url_path="comments")
    def get_comments(self, request, pk=None):
        """Get all comments for a complaint"""
        complaint = self.get_object()
        comments = Comment.objects.filter(complaint=complaint).order_by('-created_at')
        serializer = CommentSerializer(comments, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get", "put"], url_path="ai-settings")
    def ai_settings(self, request):
        """Get or update AI settings and keywords"""
        config, _ = AISettingsConfig.objects.get_or_create(pk=1)

        if request.method == "PUT":
            serializer = AISettingsConfigSerializer(config, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        keywords = AIPriorityKeyword.objects.all()
        keyword_serializer = AIPriorityKeywordSerializer(keywords, many=True)

        # Build keyword map with IDs for deletion
        keyword_map = {"urgent": [], "high": [], "medium": [], "low": []}
        keyword_ids = {"urgent": {}, "high": {}, "medium": {}, "low": {}}
        for item in keyword_serializer.data:
            priority = item["priority"]
            word = item["word"]
            keyword_map.setdefault(priority, []).append(word)
            keyword_ids.setdefault(priority, {})[word] = item["id"]

        total_processed = Complaint.objects.count()
        resolved_count = Complaint.objects.filter(status="resolved").count()
        avg_resolution_days = 0
        if resolved_count > 0:
            resolved = Complaint.objects.filter(status="resolved")
            avg_resolution_days = round(
                sum((c.updated_at - c.created_at).days for c in resolved) / resolved_count,
                2
            )

        stats = {
            "totalProcessed": total_processed,
            "resolvedComplaints": resolved_count,
            "avgResolutionDays": avg_resolution_days,
            "modelStatus": "disabled",
            "lastTrained": config.last_trained.isoformat() if config.last_trained else None,
        }

        return DRFResponse({
            "config": AISettingsConfigSerializer(config).data,
            "stats": stats,
            "keywords": keyword_map,
            "keywordIds": keyword_ids,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="ai-settings/keywords")
    def add_ai_keyword(self, request):
        serializer = AIPriorityKeywordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return DRFResponse(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["delete"], url_path="ai-settings/keywords/(?P<keyword_id>[^/.]+)")
    def delete_ai_keyword(self, request, keyword_id=None):
        keyword = get_object_or_404(AIPriorityKeyword, pk=keyword_id)
        keyword.delete()
        return DRFResponse(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="ai-settings/retrain")
    def retrain_ai_model(self, request):
        config, _ = AISettingsConfig.objects.get_or_create(pk=1)
        config.last_trained = timezone.now()
        config.save(update_fields=["last_trained", "updated_at"])
        return DRFResponse({"message": "Model retraining started"}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=["post"], url_path="ai-categorize")
    def ai_categorize(self, request, pk=None):
        """Manually trigger AI categorization"""
        complaint = self.get_object()
        result = service.process_complaint(complaint)
        
        if result:
            return DRFResponse({
                "category": result['category'].name if result['category'] else None,
                "priority": result['priority'],
                "assigned_officer": result['assigned_officer'].email if result['assigned_officer'] else None
            }, status=status.HTTP_200_OK)
        
        return DRFResponse({"error": "AI processing failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def perform_create(self, serializer):
        # For development, use a default user if not authenticated
        user = self.request.user if self.request.user.is_authenticated else None
        complaint = serializer.validated_data.get('complaint')
        comment_type = serializer.validated_data.get('comment_type', 'comment')

        if complaint and user and complaint.submitted_by == user and comment_type in ['comment', 'rating']:
            has_response = Response.objects.filter(complaint=complaint).exists()
            if not has_response:
                raise ValidationError({
                    'detail': 'You can add a comment or rating only after an officer responds to your complaint.'
                })

        serializer.save(author=user)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        # Check if user owns the comment
        if request.user.is_authenticated and comment.author != request.user:
            return DRFResponse({"error": "You can only edit your own comments"}, status=status.HTTP_403_FORBIDDEN)
        
        # Allow partial updates
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        # Check if user owns the comment
        if request.user.is_authenticated and comment.author != request.user:
            return DRFResponse({"error": "You can only delete your own comments"}, status=status.HTTP_403_FORBIDDEN)
        
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Comment.objects.all()
        complaint_id = self.request.query_params.get('complaint', None)
        if complaint_id:
            queryset = queryset.filter(complaint=complaint_id)
        return queryset.order_by('-created_at')

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        # Only allow author to delete their own comments
        if request.user != comment.author:
            return DRFResponse({"error": "You can only delete your own comments"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        # Only allow author to edit their own comments
        if request.user != comment.author:
            return DRFResponse({"error": "You can only edit your own comments"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class ResponseViewSet(viewsets.ModelViewSet):
    queryset = Response.objects.all()
    serializer_class = ResponseSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def perform_create(self, serializer):
        # Set the responder to the current user
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(responder=user)

    def get_queryset(self):
        queryset = Response.objects.all()
        complaint_id = self.request.query_params.get('complaint', None)
        if complaint_id:
            queryset = queryset.filter(complaint=complaint_id)
        return queryset.order_by('-created_at')

    def destroy(self, request, *args, **kwargs):
        response = self.get_object()
        # Only allow responder to delete their own responses
        if request.user != response.responder:
            return DRFResponse({"error": "You can only delete your own responses"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        response = self.get_object()
        # Only allow responder to edit their own responses
        if request.user != response.responder:
            return DRFResponse({"error": "You can only edit your own responses"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Users can only see their own notifications"""
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='unread')
    def unread(self, request):
        """Get unread notifications for current user"""
        notifications = Notification.get_unread_for_user(request.user)
        serializer = self.get_serializer(notifications, many=True)
        return DRFResponse({
            'count': notifications.count(),
            'notifications': serializer.data
        })

    @action(detail=False, methods=['get'], url_path='escalations')
    def escalations(self, request):
        """Get escalation-related notifications"""
        notifications = Notification.get_escalation_notifications(request.user)
        serializer = self.get_serializer(notifications, many=True)
        return DRFResponse({
            'count': notifications.count(),
            'notifications': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='mark-as-read')
    def mark_as_read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return DRFResponse({
            'message': 'Notification marked as read',
            'notification': NotificationSerializer(notification).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mark-all-as-read')
    def mark_all_as_read(self, request):
        """Mark all unread notifications as read"""
        notifications = Notification.get_unread_for_user(request.user)
        count = notifications.count()
        
        for notification in notifications:
            notification.mark_as_read()
        
        return DRFResponse({
            'message': f'{count} notifications marked as read'
        }, status=status.HTTP_200_OK)


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.AllowAny]  # For development
