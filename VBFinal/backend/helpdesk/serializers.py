from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import HelpdeskMessage, HelpdeskSession, HelpdeskSessionParticipant
from .service import service

User = get_user_model()


class HelpdeskParticipantSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    role_name = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = HelpdeskSessionParticipant
        fields = ['user_id', 'full_name', 'role_name', 'role', 'joined_at', 'left_at']


class HelpdeskMessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)

    class Meta:
        model = HelpdeskMessage
        fields = [
            'id',
            'session',
            'sender_id',
            'sender_name',
            'message_type',
            'content',
            'payload',
            'created_at',
        ]
        read_only_fields = ['id', 'sender_id', 'sender_name', 'created_at', 'session']


class HelpdeskSessionSerializer(serializers.ModelSerializer):
    participants = HelpdeskParticipantSerializer(many=True, read_only=True)
    created_by_id = serializers.IntegerField(source='created_by.id', read_only=True)

    class Meta:
        model = HelpdeskSession
        fields = [
            'id',
            'title',
            'kind',
            'status',
            'created_by_id',
            'participants',
            'started_at',
            'ended_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'status',
            'created_by_id',
            'participants',
            'started_at',
            'ended_at',
            'created_at',
            'updated_at',
        ]


class HelpdeskSessionCreateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    kind = serializers.ChoiceField(choices=HelpdeskSession.KIND_CHOICES)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )

    def validate_participant_ids(self, value):
        participant_ids = set(value)
        participants = list(User.objects.filter(id__in=participant_ids, is_active=True))
        if len(participants) != len(participant_ids):
            raise serializers.ValidationError('One or more participants were not found or inactive.')

        request = self.context.get('request')
        creator = getattr(request, 'user', None)
        if creator and creator.is_authenticated:
            allowed_roles = service.allowed_invitee_roles(creator)
            disallowed_participants = [
                participant for participant in participants if participant.role not in allowed_roles
            ]
            if disallowed_participants:
                raise serializers.ValidationError('You are not allowed to add one or more selected participants.')

        return list(participant_ids)