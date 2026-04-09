from rest_framework import permissions

class IsHelpdeskSessionParticipant(permissions.BasePermission):
    message = 'You do not have access to this helpdesk session.'

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if getattr(user, 'is_superuser', False) or getattr(user, 'role', None) == 'admin':
            return True

        if hasattr(obj, 'session_id'):
            return obj.session.participants.filter(user_id=user.id).exists()

        return obj.participants.filter(user_id=user.id).exists()