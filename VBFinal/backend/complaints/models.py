from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class Institution(models.Model):
    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Category(models.Model):
    category_id = models.CharField(
        max_length=30,
        primary_key=True,
        editable=False
    )
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="categories",
        null=True,
        blank=True,
        default=None
    )

    office_name = models.CharField(max_length=150)
    office_description = models.TextField(blank=True)

    campus = models.ForeignKey(
        "accounts.Campus",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaint_categories",
    )
    college = models.ForeignKey(
        "accounts.College",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaint_categories",
    )
    department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaint_categories",
    )

    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.CASCADE
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["office_name"]
        unique_together = ("institution", "office_name")

    def save(self, *args, **kwargs):
        if not self.category_id:
            self.category_id = f"CAT-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.office_name



class ResolverLevel(models.Model):
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="resolver_levels"
    )
    name = models.CharField(max_length=100)  # e.g. Department, Dean, President
    level_order = models.PositiveIntegerField()  # 1, 2, 3...
    escalation_time = models.DurationField(
        help_text="Time before escalation (e.g. 48 hours)"
    )

    class Meta:
        ordering = ["level_order"]
        unique_together = ("institution", "level_order")

    def __str__(self):
        return f"{self.institution.name} - {self.name} (L{self.level_order})"




class CategoryResolver(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="resolvers"
    )
    level = models.ForeignKey(
        ResolverLevel,
        on_delete=models.CASCADE,
        related_name="category_resolvers"
    )
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_categories"
    )

    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("category", "level", "officer")

    def __str__(self):
        return f"{self.officer} → {self.category} (L{self.level.level_order})"



class Complaint(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("escalated", "Escalated"),
        ("resolved", "Resolved"),
        ("closed", "Closed"),
    ]

    complaint_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="complaints",
        null=True,
        blank=True
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="complaints_made"
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints"
    )

    title = models.CharField(max_length=255)
    description = models.TextField()
    attachment = models.FileField(
        upload_to="attachments/",
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    current_level = models.ForeignKey(
        ResolverLevel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints"
    )
    # under review 
    assigned_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_complaints"
    )

    escalation_deadline = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.complaint_id}  {self.title}  ({self.status})"

    def set_escalation_deadline(self):
        if self.current_level:
            self.escalation_deadline = timezone.now() + self.current_level.escalation_time

    def save(self, *args, **kwargs):
        if self.current_level and not self.escalation_deadline:
            self.set_escalation_deadline()
        super().save(*args, **kwargs)

    def escalate_to_next_level(self):
        """Escalate complaint to the next resolver level"""
        if not self.category or not self.current_level:
            return False
        
        # Find the next level for this category
        next_level = ResolverLevel.objects.filter(
            institution=self.current_level.institution,
            level_order__gt=self.current_level.level_order
        ).order_by('level_order').first()
        
        if not next_level:
            return False  # No higher level available
        
        # Find an officer at the next level for this category
        next_resolver = CategoryResolver.objects.filter(
            category=self.category,
            level=next_level,
            active=True
        ).first()
        
        if next_resolver:
            # Create assignment record for the escalation
            Assignment.objects.create(
                complaint=self,
                officer=next_resolver.officer,
                level=next_level,
                reason='escalation'
            )
            
            # Update complaint
            self.current_level = next_level
            self.assigned_officer = next_resolver.officer
            self.status = 'escalated'
            self.set_escalation_deadline()
            self.save()
            
            return True
        
        return False


class ComplaintCC(models.Model):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='cc_list'
    )
    email = models.EmailField()

    class Meta:
        unique_together = ('complaint', 'email')

    def __str__(self):
        return f"CC {self.email} on {self.complaint.complaint_id}"


class ComplaintAttachment(models.Model):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="attachments"
    )
    file = models.FileField(upload_to="complaint_attachments/")
    filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    content_type = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.complaint.complaint_id} - {self.filename}"


class Assignment(models.Model):
    ASSIGNMENT_REASON = [
        ("initial", "Initial Assignment"),
        ("escalation", "Escalation"),
        ("manual", "Manual Reassignment"),
    ]

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="assignments"
    )
    # under review 
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assignment_history"
    )
    level = models.ForeignKey(
        ResolverLevel,
        on_delete=models.CASCADE
    )

    assigned_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    reason = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_REASON
    )

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.complaint.complaint_id}  → {self.officer} (L{self.level.level_order})"


class Comment(models.Model):
    COMMENT_TYPE_CHOICES = [
        ('comment', 'Comment'),
        ('rating', 'Rating'),
    ]

    complaint = models.ForeignKey(Complaint,on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    comment_type = models.CharField(
        max_length=20,
        choices=COMMENT_TYPE_CHOICES,
        default='comment'
    )
    message = models.TextField()
    
    # Rating fields
    rating = models.IntegerField(
        null=True,
        blank=True,
        help_text="Rating from 1 to 5 stars"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=['complaint', 'comment_type']),
            models.Index(fields=['author', 'created_at']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.comment_type == 'rating':
            if not self.rating or self.rating < 1 or self.rating > 5:
                raise ValidationError("Rating must be between 1 and 5")
        
    def __str__(self):
        if self.comment_type == 'rating':
            return f"Rating ({self.rating}/5) by {self.author} on {self.complaint.complaint_id}"
        return f"Comment by {self.author} on {self.complaint.complaint_id}"


class Response(models.Model):
    RESPONSE_TYPE_CHOICES = [
        ('initial', 'Initial Response'),
        ('update', 'Status Update'),
        ('resolution', 'Final Resolution'),
        ('escalation', 'Escalation Response'),
    ]

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="responses"
    )
    responder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="complaint_responses"
    )
    response_type = models.CharField(
        max_length=20,
        choices=RESPONSE_TYPE_CHOICES,
        default='update'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    attachment = models.FileField(
        upload_to="response_attachments/",
        null=True,
        blank=True
    )
    is_public = models.BooleanField(
        default=True,
        help_text="Whether this response is visible to the complainant"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['complaint', 'response_type']),
            models.Index(fields=['responder', 'created_at']),
        ]

    def __str__(self):
        return f"{self.response_type.title()} response by {self.responder} on {self.complaint.complaint_id}"

class Notification(models.Model):
    """Model for storing notifications about complaints and escalations"""
    
    NOTIFICATION_TYPE_CHOICES = [
        ('escalation_assigned', 'Escalation Assigned'),
        ('escalation_update', 'Escalation Update'),
        ('max_escalation', 'Max Escalation'),
        ('complaint_update', 'Complaint Update'),
        ('new_assignment', 'New Assignment'),
        ('resolution_reminder', 'Resolution Reminder'),
        ('general', 'General'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NOTIFICATION_TYPE_CHOICES,
        default='general'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['notification_type', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.user.email}"
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()
    
    @classmethod
    def get_unread_for_user(cls, user):
        """Get unread notifications for a user"""
        return cls.objects.filter(user=user, is_read=False)
    
    @classmethod
    def get_escalation_notifications(cls, user):
        """Get escalation-related notifications for a user"""
        escalation_types = [
            'escalation_assigned',
            'escalation_update',
            'max_escalation'
        ]
        return cls.objects.filter(
            user=user,
            notification_type__in=escalation_types
        )


class PublicAnnouncement(models.Model):
    title = models.CharField(max_length=200)
    message = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='public_announcements'
    )
    is_active = models.BooleanField(default=True)
    is_pinned = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']
        indexes = [
            models.Index(fields=['is_active', 'created_at']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"{self.title} ({'active' if self.is_active else 'inactive'})"



class Appointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='appointments'
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='appointments_requested'
    )
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments_assigned'
    )
    scheduled_at = models.DateTimeField()
    location = models.CharField(max_length=255, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-scheduled_at']

    def __str__(self):
        return f"Appointment for {self.complaint.complaint_id} on {self.scheduled_at:%Y-%m-%d %H:%M}"
