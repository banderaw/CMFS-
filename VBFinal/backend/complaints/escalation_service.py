"""
Escalation Service for handling automatic complaint escalations
"""
from django.utils import timezone
from django.db.models import Q
from .models import Complaint, Assignment, ResolverLevel, CategoryResolver
from accounts.email_service import EmailService
from accounts.models import User, EmailLog


class EscalationService:
    """Service for handling automatic escalation of complaints"""
    
    @staticmethod
    def check_and_escalate_complaints():
        """
        Check all pending and in_progress complaints for escalation deadline
        If deadline passed, automatically escalate to next level
        """
        now = timezone.now()
        escalatable_complaints = Complaint.objects.filter(
            Q(status='in_progress') | Q(status='pending'),
            escalation_deadline__isnull=False,
            escalation_deadline__lte=now
        )
        
        escalation_results = {
            'total_checked': escalatable_complaints.count(),
            'escalated': 0,
            'failed': 0,
            'errors': []
        }
        
        for complaint in escalatable_complaints:
            try:
                if complaint.escalate_to_next_level():
                    escalation_results['escalated'] += 1
                    EscalationService.send_escalation_notifications(complaint)
                else:
                    # No more levels to escalate to, notify admin
                    escalation_results['failed'] += 1
                    EscalationService.notify_admin_max_escalation(complaint)
            except Exception as e:
                escalation_results['failed'] += 1
                escalation_results['errors'].append({
                    'complaint_id': str(complaint.complaint_id),
                    'error': str(e)
                })
        
        return escalation_results
    
    @staticmethod
    def send_escalation_notifications(complaint):
        """Send notifications about escalation to all relevant parties"""
        try:
            # Notify the new assigned officer
            if complaint.assigned_officer:
                EmailService.send_escalation_alert(
                    complaint.assigned_officer,
                    complaint
                )
                EscalationService._create_notification(
                    user=complaint.assigned_officer,
                    complaint=complaint,
                    notification_type='escalation_assigned',
                    title=f"Complaint Escalated: {complaint.title}",
                    message=f"Complaint {complaint.complaint_id} has been escalated to your level for resolution."
                )
            
            # Notify the original complainant
            EmailService.send_complaint_notification(
                complaint.submitted_by,
                complaint
            )
            EscalationService._create_notification(
                user=complaint.submitted_by,
                complaint=complaint,
                notification_type='escalation_update',
                title="Your Complaint Has Been Escalated",
                message=f"Your complaint {complaint.complaint_id} has been escalated to a higher level for faster resolution."
            )
            
            # Notify institution admin
            EscalationService._notify_institution_admin(complaint)
            
        except Exception as e:
            print(f"Error sending escalation notifications for complaint {complaint.complaint_id}: {str(e)}")
    
    @staticmethod
    def notify_admin_max_escalation(complaint):
        """Notify admin when complaint reaches maximum escalation level"""
        try:
            # Get institution admins
            admin_users = User.objects.filter(
                role=User.ROLE_ADMIN,
                is_active=True
            )
            
            subject = f"URGENT: Complaint Requires Admin Intervention - {complaint.title}"
            message = f"""
Complaint ID: {complaint.complaint_id}
Title: {complaint.title}
Status: {complaint.get_status_display()}

This complaint has reached the maximum escalation level and requires administrative intervention.
            """
            
            for admin in admin_users:
                EmailService.send_email(
                    subject=subject,
                    message=message,
                    recipient_list=[admin.email],
                    email_type='escalation_alert',
                    recipient_user=admin
                )
                EscalationService._create_notification(
                    user=admin,
                    complaint=complaint,
                    notification_type='max_escalation',
                    title="URGENT: Complaint Requires Admin Intervention",
                    message=f"Complaint {complaint.complaint_id} has reached maximum escalation and needs immediate attention."
                )
        except Exception as e:
            print(f"Error notifying admin for max escalation: {str(e)}")
    
    @staticmethod
    def _notify_institution_admin(complaint):
        """Notify institution-specific admins about escalation"""
        try:
            if complaint.institution:
                # This assumes there's a way to identify institution admins
                # Modify based on your institution admin assignment logic
                admin_users = User.objects.filter(
                    role=User.ROLE_ADMIN,
                    is_active=True
                )
                
                for admin in admin_users:
                    subject = f"Escalation Alert: {complaint.title}"
                    message = f"Complaint {complaint.complaint_id} in {complaint.institution.name} has been escalated."
                    
                    EmailService.send_email(
                        subject=subject,
                        message=message,
                        recipient_list=[admin.email],
                        email_type='escalation_alert',
                        recipient_user=admin
                    )
        except Exception as e:
            print(f"Error notifying institution admin: {str(e)}")
    
    @staticmethod
    def _create_notification(user, complaint, notification_type, title, message):
        """Create a notification record for a user"""
        try:
            # Import here to avoid circular imports
            from .models import Notification
            
            Notification.objects.create(
                user=user,
                complaint=complaint,
                notification_type=notification_type,
                title=title,
                message=message
            )
        except ImportError:
            # Notification model doesn't exist yet, that's ok
            pass
        except Exception as e:
            print(f"Error creating notification: {str(e)}")
    
    @staticmethod
    def get_escalation_statistics():
        """Get statistics about escalations"""
        escalated_complaints = Complaint.objects.filter(status='escalated')
        pending_escalation = Complaint.objects.filter(
            Q(status='in_progress') | Q(status='pending'),
            escalation_deadline__isnull=False,
            escalation_deadline__lte=timezone.now()
        )
        
        return {
            'total_escalated': escalated_complaints.count(),
            'pending_escalation': pending_escalation.count(),
        }
    
    @staticmethod
    def set_escalation_deadline(complaint):
        """Manually set escalation deadline for a complaint"""
        if complaint.current_level and not complaint.escalation_deadline:
            complaint.set_escalation_deadline()
            complaint.save()
            return True
        return False
