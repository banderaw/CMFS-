from django.core.mail import send_mail
from django.conf import settings
from .utils import log_email


class EmailService:
    @staticmethod
    def send_email(subject, message, recipient_list, email_type='general', recipient_user=None, html_message=None):
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipient_list,
                html_message=html_message,
                fail_silently=False,
            )
            
            for email in recipient_list:
                log_email(
                    email=email,
                    subject=subject,
                    message=message,
                    email_type=email_type,
                    recipient=recipient_user,
                    status='sent'
                )
            return True
        except Exception as e:
            for email in recipient_list:
                log_email(
                    email=email,
                    subject=subject,
                    message=message,
                    email_type=email_type,
                    recipient=recipient_user,
                    status='failed',
                    error_message=str(e)
                )
            return False

    @staticmethod
    def send_verification_email(user, token):
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        verify_url = f"{frontend_url}/verify-email?token={token.token}"
        
        subject = "Verify Your Email"
        message = f"Click the link to verify your email: {verify_url}"
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[user.email],
            email_type='verification',
            recipient_user=user
        )

    @staticmethod
    def send_password_reset_email(user, token):
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        reset_url = f"{frontend_url}/reset-password?token={token.token}"
        destination = getattr(user, 'preferred_notification_email', None) or user.email
        
        subject = "Reset Your Password"
        message = f"Click the link to reset your password: {reset_url}"
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[destination],
            email_type='password_reset',
            recipient_user=user
        )

    @staticmethod
    def send_complaint_notification(user, complaint):
        subject = f"Complaint Update: {complaint.title}"
        message = f"Your complaint (ID: {complaint.complaint_id}) status: {complaint.status}"
        destination = getattr(user, 'preferred_notification_email', None) or user.email
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[destination],
            email_type='complaint_notification',
            recipient_user=user
        )

    @staticmethod
    def send_assignment_notification(officer, complaint):
        subject = f"New Complaint Assigned: {complaint.title}"
        message = f"You have been assigned complaint ID: {complaint.complaint_id}"
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[officer.email],
            email_type='assignment_notification',
            recipient_user=officer
        )

    @staticmethod
    def send_cc_complaint_notification(user, complaint):
        """Send email when officer is CC'd on a complaint"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        complaint_url = f"{frontend_url}/officer/dashboard?tab=complaints&complaint={complaint.complaint_id}"
        
        subject = f"[CC] New Complaint: {complaint.title}"
        
        category_name = complaint.category.office_name if complaint.category else 'Not assigned'
        submitted_by = f"{complaint.submitted_by.first_name} {complaint.submitted_by.last_name}"
        
        html_message = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #3b82f6; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
                .content {{ background-color: #f9fafb; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
                .field {{ margin-bottom: 15px; }}
                .label {{ font-weight: bold; color: #1f2937; }}
                .value {{ color: #374151; margin-top: 5px; }}
                .button {{ display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #999; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>You've been CC'd on a complaint</h2>
                </div>
                
                <div class="content">
                    <div class="field">
                        <div class="label">Complaint Title:</div>
                        <div class="value">{complaint.title}</div>
                    </div>
                    
                    <div class="field">
                        <div class="label">Complaint ID:</div>
                        <div class="value">{complaint.complaint_id}</div>
                    </div>
                    
                    <div class="field">
                        <div class="label">Submitted by:</div>
                        <div class="value">{submitted_by}</div>
                    </div>
                    
                    <div class="field">
                        <div class="label">Category:</div>
                        <div class="value">{category_name}</div>
                    </div>
                    
                    <div class="field">
                        <div class="label">Description:</div>
                        <div class="value">{complaint.description[:300]}{"..." if len(complaint.description) > 300 else ""}</div>
                    </div>
                    
                    <a href="{complaint_url}" class="button">View Complaint</a>
                </div>
                
                <div class="footer">
                    <p>This is a notification from the Complaint Management System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        message = f"You've been CC'd on complaint '{complaint.title}'. Submitted by {submitted_by}. Visit the dashboard to view it."
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[user.email],
            email_type='cc_complaint',
            recipient_user=user,
            html_message=html_message
        )

    @staticmethod
    def send_escalation_alert(officer, complaint):
        subject = f"Complaint Escalated: {complaint.title}"
        message = f"Complaint ID {complaint.complaint_id} has been escalated to your level"
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[officer.email],
            email_type='escalation_alert',
            recipient_user=officer
        )
