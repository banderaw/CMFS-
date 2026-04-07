from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from accounts.email_service import EmailService

from .models import Assignment, Comment, Complaint, Notification, Response
from .realtime import (
    broadcast_admin_analytics_update,
    broadcast_officer_analytics_update,
    broadcast_notification_update,
    broadcast_thread_update,
    serialize_notification,
)


@receiver(post_save, sender=Complaint)
def complaint_saved(sender, instance, created, **kwargs):
    if created and instance.submitted_by_id:
        try:
            Notification.objects.create(
                user=instance.submitted_by,
                complaint=instance,
                notification_type='complaint_update',
                title='Complaint submitted',
                message=f"Your complaint '{instance.title}' has been received and is being processed.",
            )
        except Exception:
            pass

    broadcast_thread_update(instance.complaint_id)
    if instance.submitted_by_id:
        broadcast_notification_update(instance.submitted_by_id)
    if instance.assigned_officer_id:
        broadcast_notification_update(instance.assigned_officer_id)
    if instance.submitted_by_id:
        try:
            EmailService.send_complaint_notification(instance.submitted_by, instance)
        except Exception:
            pass
    try:
        broadcast_admin_analytics_update()
        if instance.assigned_officer_id:
            broadcast_officer_analytics_update(instance.assigned_officer)
    except Exception:
        pass


@receiver(post_save, sender=Assignment)
def assignment_saved(sender, instance, created, **kwargs):
    if not created:
        return

    try:
        Notification.objects.create(
            user=instance.officer,
            complaint=instance.complaint,
            notification_type='new_assignment',
            title='New complaint assigned',
            message=f"Complaint '{instance.complaint.title}' has been assigned to you.",
        )
    except Exception:
        pass

    try:
        Notification.objects.create(
            user=instance.complaint.submitted_by,
            complaint=instance.complaint,
            notification_type='complaint_update',
            title='Complaint assigned',
            message=f"Your complaint '{instance.complaint.title}' has been assigned to {instance.officer.full_name}.",
        )
    except Exception:
        pass

    broadcast_thread_update(instance.complaint_id)
    broadcast_notification_update(instance.officer_id)
    broadcast_notification_update(instance.complaint.submitted_by_id)
    try:
        broadcast_admin_analytics_update()
        broadcast_officer_analytics_update(instance.officer)
    except Exception:
        pass


@receiver(post_save, sender=Comment)
def comment_saved(sender, instance, created, **kwargs):
    if not created:
        return

    target_user = instance.complaint.assigned_officer or instance.complaint.submitted_by
    if target_user and (target_user_id := getattr(target_user, 'id', None)):
        if target_user_id != instance.author_id:
            try:
                Notification.objects.create(
                    user=target_user,
                    complaint=instance.complaint,
                    notification_type='complaint_update',
                    title='New comment on complaint',
                    message=f"New comment on complaint '{instance.complaint.title}'.",
                )
            except Exception:
                pass
            broadcast_notification_update(target_user_id)

    broadcast_thread_update(instance.complaint_id)
    try:
        broadcast_admin_analytics_update()
        if instance.complaint.assigned_officer_id:
            broadcast_officer_analytics_update(instance.complaint.assigned_officer)
    except Exception:
        pass


@receiver(post_save, sender=Response)
def response_saved(sender, instance, created, **kwargs):
    if not created:
        return

    target_user = instance.complaint.submitted_by
    if target_user and target_user.id != instance.responder_id:
        try:
            Notification.objects.create(
                user=target_user,
                complaint=instance.complaint,
                notification_type='complaint_update',
                title='Officer response received',
                message=f"An officer responded to your complaint '{instance.complaint.title}'.",
            )
        except Exception:
            pass
        broadcast_notification_update(target_user.id)

    broadcast_thread_update(instance.complaint_id)
    try:
        broadcast_admin_analytics_update()
        if instance.complaint.assigned_officer_id:
            broadcast_officer_analytics_update(instance.complaint.assigned_officer)
    except Exception:
        pass


@receiver(post_save, sender=Notification)
def notification_saved(sender, instance, created, **kwargs):
    broadcast_notification_update(instance.user_id)
    payload = serialize_notification(instance)
    if instance.user_id:
        from .realtime import _send, notification_group_name

        _send(
            notification_group_name(instance.user_id),
            'notification.updated' if not created else 'notification.created',
            {'notification': payload},
        )


@receiver(post_delete, sender=Notification)
def notification_deleted(sender, instance, **kwargs):
    broadcast_notification_update(instance.user_id)
