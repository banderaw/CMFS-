from django.db import models
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response as DRFResponse

from accounts.models import User

from .models import (
    Appointment,
    Assignment,
    Category,
    CategoryResolver,
    Comment,
    Complaint,
    ComplaintAttachment,
    ComplaintCC,
    Notification,
    PublicAnnouncement,
    ResolverLevel,
    Response,
)
from .serializers import (
    AppointmentSerializer,
    AssignmentSerializer,
    CategoryResolverSerializer,
    CategorySerializer,
    CommentSerializer,
    ComplaintCreateSerializer,
    ComplaintSerializer,
    NotificationSerializer,
    PublicAnnouncementSerializer,
    ResolverLevelSerializer,
    ResponseSerializer,
)
from .service import service


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin())


class AuthenticatedReadAdminWriteMixin:
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'by_language']:
            return [permissions.IsAuthenticated()]
        return [IsAdminRole()]


def accessible_complaints_for(user):
    if not user or not user.is_authenticated:
        return Complaint.objects.none()
    if user.is_admin():
        return Complaint.objects.all()
    if user.is_officer():
        return Complaint.objects.filter(
            models.Q(assigned_officer=user) | models.Q(submitted_by=user)
        ).distinct()
    return Complaint.objects.filter(submitted_by=user)


def can_manage_complaint(user, complaint):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_admin()
            or (user.is_officer() and complaint.assigned_officer_id == user.id)
        )
    )


class CategoryViewSet(AuthenticatedReadAdminWriteMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    @action(detail=False, methods=['get'], url_path='by-language')
    def by_language(self, request):
        categories = self.get_queryset()
        data = []
        for cat in categories:
            data.append(
                {
                    'category_id': cat.category_id,
                    'name': cat.office_name,
                    'description': cat.office_description,
                    'is_active': cat.is_active,
                }
            )
        return DRFResponse(data)

    @action(detail=True, methods=['post'], url_path='add-officer')
    def add_officer(self, request, pk=None):
        return DRFResponse(
            {'error': 'Direct officer assignment on categories is not supported. Use resolver assignments instead.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ResolverLevelViewSet(AuthenticatedReadAdminWriteMixin, viewsets.ModelViewSet):
    queryset = ResolverLevel.objects.all()
    serializer_class = ResolverLevelSerializer


class CategoryResolverViewSet(AuthenticatedReadAdminWriteMixin, viewsets.ModelViewSet):
    queryset = CategoryResolver.objects.select_related('category', 'level', 'officer').order_by(
        'category_id',
        'level__level_order',
        'officer_id',
        'id',
    )
    serializer_class = CategoryResolverSerializer


class ComplaintViewSet(viewsets.ModelViewSet):
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return ComplaintCreateSerializer
        return ComplaintSerializer

    def get_queryset(self):
        return accessible_complaints_for(self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        import json

        data = request.data.copy()
        data.pop('user', None)

        raw_cc = data.get('cc_emails', '[]')
        try:
            cc_emails = json.loads(raw_cc) if isinstance(raw_cc, str) else raw_cc
        except (ValueError, TypeError):
            cc_emails = []
        data.setlist('cc_emails', cc_emails)

        raw_cc_officers = data.get('cc_officer_ids', '[]')
        try:
            cc_officer_ids = json.loads(raw_cc_officers) if isinstance(raw_cc_officers, str) else raw_cc_officers
        except (ValueError, TypeError):
            cc_officer_ids = []
        data.setlist('cc_officer_ids', cc_officer_ids)

        serializer = self.get_serializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save(submitted_by=request.user)

        try:
            service.process_complaint(complaint)
            complaint.refresh_from_db()
        except Exception:
            pass

        output_serializer = ComplaintSerializer(complaint, context={'request': request})
        return DRFResponse(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='assign')
    def assign(self, request, pk=None):
        complaint = self.get_object()
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to assign this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        officer_id = request.data.get('officer_id')
        level_id = request.data.get('level_id')
        if not officer_id or not level_id:
            return DRFResponse({'error': 'officer_id and level_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        officer = get_object_or_404(User, id=officer_id, role='officer')
        level = get_object_or_404(ResolverLevel, id=level_id)

        Assignment.objects.create(
            complaint=complaint,
            officer=officer,
            level=level,
            reason='manual',
        )
        complaint.assigned_officer = officer
        complaint.current_level = level
        complaint.set_escalation_deadline()
        complaint.save()

        return DRFResponse({'detail': 'Complaint assigned successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reassign')
    def reassign(self, request, pk=None):
        complaint = self.get_object()
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to reassign this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        new_officer_id = request.data.get('officer_id')
        reason = request.data.get('reason', 'manual reassignment')
        if not new_officer_id:
            return DRFResponse({'error': 'officer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        level = complaint.current_level
        if level is None:
            return DRFResponse({'error': 'Complaint does not have a resolver level yet.'}, status=status.HTTP_400_BAD_REQUEST)

        officer = get_object_or_404(User, id=new_officer_id, role='officer')
        Assignment.objects.create(
            complaint=complaint,
            officer=officer,
            level=level,
            reason=reason,
        )

        complaint.assigned_officer = officer
        complaint.current_level = level
        complaint.save()

        return DRFResponse(
            {'detail': 'Complaint reassigned successfully', 'assigned_officer_id': officer.id},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, pk=None):
        complaint = self.get_object()
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to update this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if new_status not in dict(Complaint.STATUS_CHOICES):
            return DRFResponse({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        complaint.status = new_status
        complaint.save()
        return DRFResponse({'detail': f'Status updated to {new_status}'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='escalate')
    def escalate(self, request, pk=None):
        complaint = self.get_object()
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to escalate this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        if not complaint.current_level:
            return DRFResponse({'error': 'No current level set'}, status=status.HTTP_400_BAD_REQUEST)

        next_level = ResolverLevel.objects.filter(level_order=complaint.current_level.level_order + 1).first()
        if not next_level:
            return DRFResponse({'error': 'No higher level available'}, status=status.HTTP_400_BAD_REQUEST)

        category_resolver = CategoryResolver.objects.filter(
            category=complaint.category,
            level=next_level,
            active=True,
        ).first()

        if not category_resolver:
            return DRFResponse({'error': 'No resolver found at next level'}, status=status.HTTP_400_BAD_REQUEST)

        Assignment.objects.create(
            complaint=complaint,
            officer=category_resolver.officer,
            level=next_level,
            reason='escalation',
        )

        complaint.current_level = next_level
        complaint.assigned_officer = category_resolver.officer
        complaint.set_escalation_deadline()
        complaint.status = 'escalated'
        complaint.save()

        return DRFResponse(
            {
                'detail': f'Escalated to {next_level.name}',
                'assigned_to': category_resolver.officer.email,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['get'], url_path='responses')
    def get_responses(self, request, pk=None):
        complaint = self.get_object()
        responses = Response.objects.filter(complaint=complaint).order_by('-created_at')
        serializer = ResponseSerializer(responses, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='comments')
    def get_comments(self, request, pk=None):
        complaint = self.get_object()
        comments = Comment.objects.filter(complaint=complaint).order_by('-created_at')
        serializer = CommentSerializer(comments, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path=r'attachments/(?P<attachment_id>[^/.]+)/download')
    def download_attachment(self, request, pk=None, attachment_id=None):
        complaint = self.get_object()
        attachment = get_object_or_404(ComplaintAttachment, id=attachment_id, complaint=complaint)

        filename = attachment.filename or 'attachment'
        content_type = attachment.content_type or 'application/octet-stream'

        if attachment.file_data:
            response = HttpResponse(attachment.file_data, content_type=content_type)
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return response

        if attachment.file:
            try:
                file_handle = attachment.file.open('rb')
                response = FileResponse(file_handle, content_type=content_type)
                response['Content-Disposition'] = f'inline; filename="{filename}"'
                return response
            except Exception as exc:
                raise Http404('Attachment file is unavailable') from exc

        raise Http404('Attachment file is unavailable')

    @action(detail=False, methods=['get'], url_path='cc')
    def cc_complaints(self, request):
        user_email = request.user.email
        cc_complaints = Complaint.objects.filter(cc_list__email=user_email).distinct().order_by('-created_at')
        serializer = ComplaintSerializer(cc_complaints, many=True, context={'request': request})
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        complaint_qs = accessible_complaints_for(self.request.user)
        queryset = Comment.objects.filter(complaint__in=complaint_qs)
        complaint_id = self.request.query_params.get('complaint')
        if complaint_id:
            queryset = queryset.filter(complaint=complaint_id)
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        complaint = serializer.validated_data.get('complaint')
        user = self.request.user
        if not accessible_complaints_for(user).filter(pk=complaint.pk).exists():
            raise PermissionDenied('You do not have access to this complaint.')

        comment_type = serializer.validated_data.get('comment_type', 'comment')
        if complaint.submitted_by == user and comment_type in ['comment', 'rating']:
            has_response = Response.objects.filter(complaint=complaint).exists()
            if not has_response:
                raise ValidationError({'detail': 'You can add a comment or rating only after an officer responds to your complaint.'})

        serializer.save(author=user)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        if request.user != comment.author:
            return DRFResponse({'error': 'You can only edit your own comments'}, status=status.HTTP_403_FORBIDDEN)
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if request.user != comment.author:
            return DRFResponse({'error': 'You can only delete your own comments'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ResponseViewSet(viewsets.ModelViewSet):
    serializer_class = ResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        complaint_qs = accessible_complaints_for(self.request.user)
        queryset = Response.objects.filter(complaint__in=complaint_qs)
        complaint_id = self.request.query_params.get('complaint')
        if complaint_id:
            queryset = queryset.filter(complaint=complaint_id)
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_admin() or user.is_officer()):
            raise PermissionDenied('Only officers and admins can respond to complaints.')

        complaint = serializer.validated_data.get('complaint')
        if not accessible_complaints_for(user).filter(pk=complaint.pk).exists():
            raise PermissionDenied('You do not have access to this complaint.')

        serializer.save(responder=user)

    def destroy(self, request, *args, **kwargs):
        response = self.get_object()
        if request.user != response.responder:
            return DRFResponse({'error': 'You can only delete your own responses'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        response = self.get_object()
        if request.user != response.responder:
            return DRFResponse({'error': 'You can only edit your own responses'}, status=status.HTTP_403_FORBIDDEN)
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Notification.objects.none()

        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='unread')
    def unread(self, request):
        notifications = Notification.get_unread_for_user(request.user)
        serializer = self.get_serializer(notifications, many=True)
        return DRFResponse({'count': notifications.count(), 'notifications': serializer.data})

    @action(detail=False, methods=['get'], url_path='escalations')
    def escalations(self, request):
        notifications = Notification.get_escalation_notifications(request.user)
        serializer = self.get_serializer(notifications, many=True)
        return DRFResponse({'count': notifications.count(), 'notifications': serializer.data})

    @action(detail=True, methods=['post'], url_path='mark-as-read')
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_as_read()
        return DRFResponse(
            {
                'message': 'Notification marked as read',
                'notification': NotificationSerializer(notification).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='mark-all-as-read')
    def mark_all_as_read(self, request):
        notifications = Notification.get_unread_for_user(request.user)
        count = notifications.count()
        for notification in notifications:
            notification.mark_as_read()
        return DRFResponse({'message': f'{count} notifications marked as read'}, status=status.HTTP_200_OK)


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
                status=status.HTTP_403_FORBIDDEN,
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
                status=status.HTTP_403_FORBIDDEN,
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
                status=status.HTTP_403_FORBIDDEN,
            )

        announcement.is_active = True
        announcement.save(update_fields=['is_active', 'updated_at'])
        return DRFResponse(PublicAnnouncementSerializer(announcement).data, status=status.HTTP_200_OK)


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAdminRole]


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Appointment.objects.none()

        user = self.request.user
        if user.is_admin():
            return Appointment.objects.all()
        if user.is_officer():
            return Appointment.objects.filter(
                models.Q(officer=user) | models.Q(requested_by=user)
            ).distinct()
        return Appointment.objects.filter(
            complaint__submitted_by=user,
            requested_by__role__in=('officer', 'admin'),
        )

    def create(self, request, *args, **kwargs):
        if request.user.role not in ('officer', 'admin'):
            return DRFResponse(
                {'error': 'Only officers and admins can schedule appointments.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        complaint = serializer.validated_data['complaint']
        if not accessible_complaints_for(self.request.user).filter(pk=complaint.pk).exists():
            raise PermissionDenied('You do not have access to this complaint.')

        officer = serializer.validated_data.get('officer') or complaint.assigned_officer
        serializer.save(requested_by=self.request.user, officer=officer)

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        appointment = self.get_object()
        if request.user.role not in ('officer', 'admin'):
            return DRFResponse({'error': 'Only officers and admins can update appointment status.'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if new_status not in dict(Appointment.STATUS_CHOICES):
            return DRFResponse({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        appointment.status = new_status
        appointment.save()
        return DRFResponse(AppointmentSerializer(appointment).data)
