from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.exceptions import PermissionDenied
from django.db.models import Q

from accounts.models import User

from .models import Comment, Complaint, Notification, Response
from .realtime import (
    analytics_group_name,
    build_complaint_analytics,
    build_notification_snapshot,
    build_thread_snapshot,
    complaint_thread_group_name,
    notification_group_name,
    serialize_comment,
    serialize_response,
)


@database_sync_to_async
def _get_complaint_for_user(user, complaint_id):
    if not user or not user.is_authenticated:
        return None

    queryset = Complaint.objects.filter(complaint_id=complaint_id)
    if user.is_admin():
        return queryset.first()
    if user.is_officer():
        return queryset.filter(Q(submitted_by=user) | Q(assigned_officer=user)).first()
    return queryset.filter(submitted_by=user).first()


@database_sync_to_async
def _create_comment(user, complaint_id, message):
    complaint = Complaint.objects.get(complaint_id=complaint_id)
    if complaint.submitted_by_id == user.id:
        if not Response.objects.filter(complaint=complaint).exists():
            raise PermissionDenied('You can add a comment only after an officer responds to your complaint.')

    if not (user.is_admin() or user.is_officer() or complaint.submitted_by_id == user.id):
        raise PermissionDenied('You do not have access to this complaint.')

    comment = Comment.objects.create(
        complaint=complaint,
        author=user,
        message=message,
        comment_type='comment',
    )
    return serialize_comment(comment)


@database_sync_to_async
def _create_response(user, complaint_id, title, message, response_type='update'):
    if not (user.is_admin() or user.is_officer()):
        raise PermissionDenied('Only officers and admins can respond to complaints.')

    complaint = Complaint.objects.get(complaint_id=complaint_id)
    if not (
        complaint.submitted_by_id == user.id
        or complaint.assigned_officer_id == user.id
        or user.is_admin()
    ):
        # Admins can always respond; officers must be assigned or at least involved in the thread.
        if not user.is_admin():
            raise PermissionDenied('You do not have access to this complaint.')

    response = Response.objects.create(
        complaint=complaint,
        responder=user,
        title=title or 'Officer Response',
        message=message,
        response_type=response_type or 'update',
        is_public=True,
    )
    return serialize_response(response)


class ComplaintThreadConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        self.complaint_id = self.scope['url_route']['kwargs']['complaint_id']
        self.group_name = complaint_thread_group_name(self.complaint_id)

        complaint = await _get_complaint_for_user(self.user, self.complaint_id)
        if not complaint:
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'thread.snapshot',
            **build_thread_snapshot(complaint),
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get('type')
        if message_type != 'chat.message':
            await self.send_json({'type': 'error', 'message': 'Unsupported message type'})
            return

        kind = content.get('kind')
        message = (content.get('message') or '').strip()
        if not message:
            await self.send_json({'type': 'error', 'message': 'Message cannot be empty'})
            return

        if kind == 'comment':
            try:
                comment_data = await _create_comment(self.user, self.complaint_id, message)
                await self.send_json({'type': 'chat.created', 'kind': 'comment', 'item': comment_data})
            except Exception as exc:
                await self.send_json({'type': 'error', 'message': str(exc)})
            return

        if kind == 'response':
            try:
                response_data = await _create_response(
                    self.user,
                    self.complaint_id,
                    content.get('title') or 'Officer Response',
                    message,
                    content.get('response_type') or 'update',
                )
                await self.send_json({'type': 'chat.created', 'kind': 'response', 'item': response_data})
            except Exception as exc:
                await self.send_json({'type': 'error', 'message': str(exc)})
            return

        await self.send_json({'type': 'error', 'message': 'Unsupported chat kind'})

    async def broadcast_event(self, event):
        await self.send_json({
            'type': event.get('event_type'),
            **event.get('payload', {}),
        })


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = notification_group_name(self.user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'notification.snapshot',
            **await build_notification_snapshot_async(self.user),
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def broadcast_event(self, event):
        await self.send_json({
            'type': event.get('event_type'),
            **event.get('payload', {}),
        })


@database_sync_to_async
def build_notification_snapshot_async(user):
    return build_notification_snapshot(user)


class AnalyticsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated or not (self.user.is_admin() or self.user.is_officer()):
            await self.close(code=4403)
            return

        scope = 'admin' if self.user.is_admin() else 'officer'
        self.group_name = analytics_group_name(scope, self.user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'analytics.snapshot',
            'summary': await build_analytics_snapshot_async(self.user),
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def broadcast_event(self, event):
        await self.send_json({
            'type': event.get('event_type'),
            **event.get('payload', {}),
        })


@database_sync_to_async
def build_analytics_snapshot_async(user):
    return build_complaint_analytics(user)
