from django.contrib import admin

from .models import HelpdeskMessage, HelpdeskSession, HelpdeskSessionParticipant


@admin.register(HelpdeskSession)
class HelpdeskSessionAdmin(admin.ModelAdmin):
	list_display = ('id', 'kind', 'status', 'created_by', 'created_at', 'started_at', 'ended_at')
	list_filter = ('kind', 'status', 'created_at')
	search_fields = ('id', 'title', 'created_by__email', 'created_by__first_name', 'created_by__last_name')


@admin.register(HelpdeskSessionParticipant)
class HelpdeskSessionParticipantAdmin(admin.ModelAdmin):
	list_display = ('session', 'user', 'role', 'joined_at', 'left_at')
	list_filter = ('role', 'joined_at')
	search_fields = ('session__id', 'user__email', 'user__first_name', 'user__last_name')


@admin.register(HelpdeskMessage)
class HelpdeskMessageAdmin(admin.ModelAdmin):
	list_display = ('id', 'session', 'sender', 'message_type', 'created_at')
	list_filter = ('message_type', 'created_at')
	search_fields = ('id', 'session__id', 'sender__email', 'content')
