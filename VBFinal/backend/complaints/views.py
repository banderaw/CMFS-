from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import ValidationError
from django.http import FileResponse, HttpResponse, Http404
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import models

from .models import Category, ResolverLevel, CategoryResolver, Complaint, ComplaintAttachment, ComplaintCC, Comment, Assignment, Response, Notification, Appointment, PublicAnnouncement
from .serializers import (
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
    PublicAnnouncementSerializer,
    AppointmentSerializer,
)
from .service import service


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]  # For development

    @action(detail=False, methods=["get"], url_path="by-language")
    def by_language(self, request):
        """Get categories using the canonical office field names."""
        categories = self.get_queryset()
        
        data = []
        for cat in categories:
            category_data = {
                'category_id': cat.category_id,
                'name': cat.office_name,
                'description': cat.office_description,
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
    # Stable ordering is required for paginated responses.
    queryset = CategoryResolver.objects.select_related("category", "level", "officer").order_by(
        "category_id", "level__level_order", "officer_id", "id"
    )
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
        import json
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

        data = request.data.copy()
        if 'user' in data:
            del data['user']

        # Parse cc_emails from JSON string (sent via FormData)
        raw_cc = data.get('cc_emails', '[]')
        try:
            cc_emails = json.loads(raw_cc) if isinstance(raw_cc, str) else raw_cc
        except (ValueError, TypeError):
            cc_emails = []
        data.setlist('cc_emails', cc_emails)

        # Parse cc_officer_ids from JSON string (sent via FormData)
        raw_cc_officers = data.get('cc_officer_ids', '[]')
        try:
            cc_officer_ids = json.loads(raw_cc_officers) if isinstance(raw_cc_officers, str) else raw_cc_officers
        except (ValueError, TypeError):
            cc_officer_ids = []
        data.setlist('cc_officer_ids', cc_officer_ids)

        serializer = self.get_serializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save(submitted_by=submitted_by)
        
        try:
            service.process_complaint(complaint)
            complaint.refresh_from_db()
        except Exception:
            pass
            
        output_serializer = ComplaintSerializer(complaint, context={'request': request})
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
            # Get the first resolver level
            level = ResolverLevel.objects.order_by('level_order').first()
            
            # If still no level exists, create a default one
            if not level:
                level = ResolverLevel.objects.create(
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

    @action(detail=True, methods=["get"], url_path=r"attachments/(?P<attachment_id>[^/.]+)/download")
    def download_attachment(self, request, pk=None, attachment_id=None):
        """Download/open complaint attachment via stable API URL."""
        complaint = self.get_object()
        attachment = get_object_or_404(ComplaintAttachment, id=attachment_id, complaint=complaint)

        filename = attachment.filename or "attachment"
        content_type = attachment.content_type or "application/octet-stream"

        if attachment.file_data:
            response = HttpResponse(attachment.file_data, content_type=content_type)
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            return response

        if attachment.file:
            try:
                file_handle = attachment.file.open("rb")
                response = FileResponse(file_handle, content_type=content_type)
                response["Content-Disposition"] = f'inline; filename="{filename}"'
                return response
            except Exception as exc:
                raise Http404("Attachment file is unavailable") from exc

        raise Http404("Attachment file is unavailable")

    @action(detail=False, methods=['get'], url_path='cc')
    def cc_complaints(self, request):
        """Get complaints where the current user is CC'd"""
        if not request.user.is_authenticated:
            return DRFResponse({"detail": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
        
        user_email = request.user.email
        cc_complaints = Complaint.objects.filter(cc_list__email=user_email).distinct().order_by('-created_at')
        
        serializer = self.get_serializer(cc_complaints, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)


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
        if getattr(self, 'swagger_fake_view', False):
            return Notification.objects.none()

        if not self.request.user.is_authenticated:
            return Notification.objects.none()

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


class PublicAnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = PublicAnnouncementSerializer

    def _can_manage_announcement(self, user, announcement):
        if not user.is_authenticated:
            return False
        if getattr(user, 'role', None) == 'admin':
            return True
        if getattr(user, 'role', None) == 'officer':
            return announcement.created_by_id == user.id
        return False

    def get_authenticators(self):
        # Avoid 401 on public endpoints when stale/invalid Authorization headers are present.
        if getattr(self, 'action', None) in ['list', 'retrieve']:
            return []
        return super().get_authenticators()

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = PublicAnnouncement.objects.select_related('created_by').all()
        user = self.request.user

        if self.action in ['list', 'retrieve']:
            if user.is_authenticated and getattr(user, 'role', None) in ('officer', 'admin'):
                if user.role == 'admin':
                    return queryset
                return queryset.filter(created_by=user)

            now = timezone.now()
            return queryset.filter(is_active=True).filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
            )

        if not user.is_authenticated:
            return PublicAnnouncement.objects.none()

        if getattr(user, 'role', None) == 'admin':
            return queryset

        if getattr(user, 'role', None) == 'officer':
            return queryset.filter(created_by=user)

        return PublicAnnouncement.objects.none()

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) not in ('officer', 'admin'):
            return DRFResponse(
                {'error': 'Only officers and admins can create announcements.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='hide')
    def hide(self, request, pk=None):
        announcement = self.get_object()
        if not self._can_manage_announcement(request.user, announcement):
            return DRFResponse(
                {'error': 'You do not have permission to hide this announcement.'},
                status=status.HTTP_403_FORBIDDEN
            )

        announcement.is_active = False
        announcement.save(update_fields=['is_active', 'updated_at'])
        return DRFResponse(PublicAnnouncementSerializer(announcement).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='show')
    def show(self, request, pk=None):
        announcement = self.get_object()
        if not self._can_manage_announcement(request.user, announcement):
            return DRFResponse(
                {'error': 'You do not have permission to show this announcement.'},
                status=status.HTTP_403_FORBIDDEN
            )

        announcement.is_active = True
        announcement.save(update_fields=['is_active', 'updated_at'])
        return DRFResponse(PublicAnnouncementSerializer(announcement).data, status=status.HTTP_200_OK)


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.AllowAny]  # For development


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Appointment.objects.none()

        user = self.request.user
        if not user.is_authenticated:
            return Appointment.objects.none()

        if user.role in ('officer', 'admin'):
            return Appointment.objects.all()

        # Users can only view appointments scheduled by officers/admins
        # for complaints they submitted.
        return Appointment.objects.filter(
            complaint__submitted_by=user,
            requested_by__role__in=('officer', 'admin')
        )

    def create(self, request, *args, **kwargs):
        # Prevent regular users from creating appointments.
        if request.user.role not in ('officer', 'admin'):
            return DRFResponse(
                {'error': 'Only officers and admins can schedule appointments.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        complaint = serializer.validated_data['complaint']
        # auto-assign officer from complaint if not provided
        officer = serializer.validated_data.get('officer') or complaint.assigned_officer
        serializer.save(requested_by=self.request.user, officer=officer)

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        appointment = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Appointment.STATUS_CHOICES):
            return DRFResponse({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        appointment.status = new_status
        appointment.save()
        return DRFResponse(AppointmentSerializer(appointment).data)
