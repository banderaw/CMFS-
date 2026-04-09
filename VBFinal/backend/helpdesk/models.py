import uuid

from django.conf import settings
from django.db import models


class HelpdeskSession(models.Model):
	KIND_AUDIO_CALL = 'audio_call'
	KIND_VIDEO_CALL = 'video_call'
	KIND_AUDIO_CONFERENCE = 'audio_conference'
	KIND_VIDEO_CONFERENCE = 'video_conference'
	KIND_CHOICES = [
		(KIND_AUDIO_CALL, 'Audio Call'),
		(KIND_VIDEO_CALL, 'Video Call'),
		(KIND_AUDIO_CONFERENCE, 'Audio Conference'),
		(KIND_VIDEO_CONFERENCE, 'Video Conference'),
	]

	STATUS_PENDING = 'pending'
	STATUS_ACTIVE = 'active'
	STATUS_ENDED = 'ended'
	STATUS_CANCELLED = 'cancelled'
	STATUS_CHOICES = [
		(STATUS_PENDING, 'Pending'),
		(STATUS_ACTIVE, 'Active'),
		(STATUS_ENDED, 'Ended'),
		(STATUS_CANCELLED, 'Cancelled'),
	]

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	title = models.CharField(max_length=255, blank=True)
	kind = models.CharField(max_length=30, choices=KIND_CHOICES, default=KIND_VIDEO_CALL)
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='helpdesk_sessions_created',
	)
	started_at = models.DateTimeField(null=True, blank=True)
	ended_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['status', 'created_at']),
			models.Index(fields=['created_by', 'created_at']),
		]

	def __str__(self):
		return f'{self.kind} ({self.id})'


class HelpdeskSessionParticipant(models.Model):
	ROLE_HOST = 'host'
	ROLE_PARTICIPANT = 'participant'
	ROLE_CHOICES = [
		(ROLE_HOST, 'Host'),
		(ROLE_PARTICIPANT, 'Participant'),
	]

	session = models.ForeignKey(
		HelpdeskSession,
		on_delete=models.CASCADE,
		related_name='participants',
	)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='helpdesk_session_participations',
	)
	role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_PARTICIPANT)
	joined_at = models.DateTimeField(auto_now_add=True)
	left_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		unique_together = [('session', 'user')]
		ordering = ['joined_at']
		indexes = [
			models.Index(fields=['session', 'user']),
			models.Index(fields=['user', 'joined_at']),
		]

	def __str__(self):
		return f'{self.user_id} in {self.session_id}'


class HelpdeskMessage(models.Model):
	TYPE_TEXT = 'text'
	TYPE_SIGNAL = 'signal'
	TYPE_SYSTEM = 'system'
	TYPE_CHOICES = [
		(TYPE_TEXT, 'Text'),
		(TYPE_SIGNAL, 'Signal'),
		(TYPE_SYSTEM, 'System'),
	]

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	session = models.ForeignKey(
		HelpdeskSession,
		on_delete=models.CASCADE,
		related_name='messages',
	)
	sender = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='helpdesk_messages_sent',
	)
	message_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_TEXT)
	content = models.TextField(blank=True)
	payload = models.JSONField(default=dict, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['created_at']
		indexes = [
			models.Index(fields=['session', 'created_at']),
			models.Index(fields=['sender', 'created_at']),
		]

	def __str__(self):
		return f'{self.message_type} by {self.sender_id} in {self.session_id}'
