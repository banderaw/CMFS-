from accounts.models import User
from complaints.models import Notification

from .models import FeedbackTemplate


def _iter_visible_end_users(template):
    users = User.objects.filter(is_active=True, role=User.ROLE_USER).select_related(
        'student_profile__department__department_college__college_campus',
        'officer_profile__college__college_campus',
        'officer_profile__department__department_college__college_campus',
    )
    for user in users:
        try:
            if template.is_visible_to_user(user):
                yield user
        except Exception:
            continue


def notify_users_about_template(template, actor=None):
    if template.status != FeedbackTemplate.STATUS_ACTIVE:
        return 0

    actor_name = None
    if actor is not None:
        actor_name = (getattr(actor, 'full_name', '') or '').strip() or getattr(actor, 'email', '')

    title = f"New feedback template: {template.title}"
    if actor_name:
        message = f"{actor_name} published a new feedback template '{template.title}'."
    else:
        message = f"A new feedback template '{template.title}' is now available."

    created_count = 0
    for user in _iter_visible_end_users(template):
        try:
            Notification.objects.create(
                user=user,
                complaint=None,
                notification_type='general',
                title=title,
                message=message,
            )
            created_count += 1
        except Exception:
            continue

    return created_count
