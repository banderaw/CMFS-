import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.serializers.json import DjangoJSONEncoder
from rest_framework.exceptions import ValidationError

from .models import HelpdeskMessage, HelpdeskSession
from .serializers import HelpdeskMessageSerializer
from .service import service


def helpdesk_group_name(session_id):
    return f'helpdesk_session_{str(session_id).replace('-', '_')}'


@database_sync_to_async
def _session_for_user(user, session_id):
    if not user or not user.is_authenticated:
        return None
    if getattr(user, 'is_superuser', False) or getattr(user, 'role', None) == 'admin':
        return HelpdeskSession.objects.filter(id=session_id).first()
    return HelpdeskSession.objects.filter(id=session_id, participants__user_id=user.id).first()


@database_sync_to_async
def _persist_message(*, session, sender, message_type, content, payload):
    message = service.create_message(
        session=session,
        sender=sender,
        message_type=message_type,
        content=content,
        payload=payload,
    )
    return HelpdeskMessageSerializer(message).data


class HelpdeskSessionConsumer(AsyncJsonWebsocketConsumer):
    @classmethod
    async def encode_json(cls, content):
        return json.dumps(content, cls=DjangoJSONEncoder)

    async def connect(self):
        self.user = self.scope.get('user')
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.session = await _session_for_user(self.user, self.session_id)
        if not self.session:
            await self.close(code=4403)
            return

        self.group_name = helpdesk_group_name(self.session_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get('type')

        if message_type != 'chat.message':
            await self.send_json({'type': 'error', 'message': 'Unsupported message type.'})
            return

        payload = content.get('payload') or {}
        msg_type = content.get('message_type', HelpdeskMessage.TYPE_TEXT)
        text = content.get('content', '')

        try:
            message_data = await _persist_message(
                session=self.session,
                sender=self.user,
                message_type=msg_type,
                content=text,
                payload=payload,
            )
        except ValidationError as exc:
            await self.send_json({'type': 'error', 'message': str(exc)})
            return
        except Exception as exc:
            await self.send_json({'type': 'error', 'message': str(exc)})
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'helpdesk.broadcast',
                'event_type': 'chat.message',
                'payload': message_data,
            },
        )

    async def helpdesk_broadcast(self, event):
        await self.send_json(
            {
                'type': event.get('event_type', 'chat.message'),
                'message': event.get('payload', {}),
            }
        )