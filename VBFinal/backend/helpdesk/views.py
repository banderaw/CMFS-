import os
import uuid
from urllib.parse import urlparse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import HelpdeskMessage, HelpdeskSession
from .permissions import IsHelpdeskSessionParticipant
from .serializers import (
	HelpdeskMessageSerializer,
	HelpdeskSessionCreateSerializer,
	HelpdeskSessionSerializer,
)
from .service import service


class HelpdeskSessionViewSet(viewsets.ModelViewSet):
	permission_classes = [permissions.IsAuthenticated]
	serializer_class = HelpdeskSessionSerializer

	def get_queryset(self):
		return service.sessions_for_user(self.request.user)

	def get_serializer_class(self):
		if self.action == 'create':
			return HelpdeskSessionCreateSerializer
		return HelpdeskSessionSerializer

	def create(self, request, *args, **kwargs):
		serializer = self.get_serializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		session = service.create_session(
			creator=request.user,
			kind=serializer.validated_data['kind'],
			title=serializer.validated_data.get('title', ''),
			participant_ids=serializer.validated_data.get('participant_ids', []),
		)
		output = HelpdeskSessionSerializer(session, context={'request': request})
		return Response(output.data, status=status.HTTP_201_CREATED)

	def destroy(self, request, *args, **kwargs):
		session = self.get_object()
		service.ensure_session_delete_access(request.user, session)
		session.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

	@action(detail=False, methods=['get'], url_path='candidates')
	def candidates(self, request):
		users = service.candidate_users_for_creator(request.user)
		payload = [
			{
				'id': user.id,
				'email': user.email,
				'full_name': user.full_name,
				'first_name': user.first_name,
				'last_name': user.last_name,
				'role': user.role,
			}
			for user in users
		]
		return Response(payload, status=status.HTTP_200_OK)

	@action(detail=True, methods=['post'], url_path='start')
	def start(self, request, pk=None):
		session = self.get_object()
		service.ensure_session_access(request.user, session)
		service.start_session(session)
		return Response(HelpdeskSessionSerializer(session).data, status=status.HTTP_200_OK)

	@action(detail=True, methods=['post'], url_path='end')
	def end(self, request, pk=None):
		session = self.get_object()
		service.ensure_session_access(request.user, session)
		service.end_session(session)
		return Response(HelpdeskSessionSerializer(session).data, status=status.HTTP_200_OK)

	@action(detail=True, methods=['post'], url_path='livekit-token')
	def livekit_token(self, request, pk=None):
		session = self.get_object()
		service.ensure_session_access(request.user, session)

		livekit_url = os.getenv('LIVEKIT_URL', '').strip()
		livekit_ws_url = os.getenv('LIVEKIT_WS_URL', '').strip()
		livekit_api_key = os.getenv('LIVEKIT_API_KEY', '').strip()
		livekit_api_secret = os.getenv('LIVEKIT_API_SECRET', '').strip()

		if not (livekit_url and livekit_api_key and livekit_api_secret):
			return Response(
				{'detail': 'LiveKit is not configured.Plase configure LIVEKIT KEYS '},
				status=status.HTTP_503_SERVICE_UNAVAILABLE,
			)

		parsed_livekit_url = urlparse(livekit_ws_url or livekit_url)
		connect_scheme = 'wss' if parsed_livekit_url.scheme == 'https' else 'ws'
		connect_url = parsed_livekit_url._replace(scheme=connect_scheme).geturl().rstrip('/')

		try:
			from livekit import api
		except Exception:
			return Response(
				{'detail': 'livekit-api package is not installed on the backend.'},
				status=status.HTTP_503_SERVICE_UNAVAILABLE,
			)

		room_name = f'helpdesk_{session.id}'
		identity_base = str(request.user.id)
		identity = f'{identity_base}-{uuid.uuid4().hex[:8]}'
		participant_name = request.user.full_name or request.user.email or f'user-{identity_base}'

		token = (
			api.AccessToken(livekit_api_key, livekit_api_secret)
			.with_identity(identity)
			.with_name(participant_name)
			.with_grants(
				api.VideoGrants(
					room_join=True,
					room=room_name,
					can_publish=True,
					can_subscribe=True,
				)
			)
			.to_jwt()
		)

		return Response(
			{
				'url': connect_url,
				'token': token,
				'room_name': room_name,
				'session_id': str(session.id),
				'participant_user_id': identity_base,
			},
			status=status.HTTP_200_OK,
		)


class HelpdeskMessageViewSet(viewsets.ModelViewSet):
	serializer_class = HelpdeskMessageSerializer
	permission_classes = [permissions.IsAuthenticated, IsHelpdeskSessionParticipant]

	def get_queryset(self):
		if getattr(self.request.user, 'is_superuser', False) or getattr(self.request.user, 'role', None) == 'admin':
			return (
				HelpdeskMessage.objects.all()
				.select_related('session', 'sender')
				.order_by('created_at')
			)
		return (
			HelpdeskMessage.objects.filter(session__participants__user_id=self.request.user.id)
			.select_related('session', 'sender')
			.distinct()
			.order_by('created_at')
		)

	def list(self, request, *args, **kwargs):
		session_id = request.query_params.get('session_id')
		if not session_id:
			return Response({'detail': 'session_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

		session = get_object_or_404(HelpdeskSession, pk=session_id)
		service.ensure_session_access(request.user, session)
		queryset = self.get_queryset().filter(session_id=session_id)
		serializer = self.get_serializer(queryset, many=True)
		return Response(serializer.data)

	def create(self, request, *args, **kwargs):
		session_id = request.data.get('session')
		message_type = request.data.get('message_type', HelpdeskMessage.TYPE_TEXT)
		content = request.data.get('content', '')
		payload = request.data.get('payload') or {}

		if not session_id:
			return Response({'detail': 'session is required.'}, status=status.HTTP_400_BAD_REQUEST)

		session = get_object_or_404(HelpdeskSession, pk=session_id)
		message = service.create_message(
			session=session,
			sender=request.user,
			message_type=message_type,
			content=content,
			payload=payload,
		)
		serializer = self.get_serializer(message)
		return Response(serializer.data, status=status.HTTP_201_CREATED)
