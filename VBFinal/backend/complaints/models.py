from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
import uuid

class Category(models.Model):
    SCOPE_GENERAL = "general"
    SCOPE_CAMPUS = "campus"
    SCOPE_COLLEGE = "college"
    SCOPE_DEPARTMENT = "department"
    SCOPE_CHOICES = [
        (SCOPE_GENERAL, "General"),
        (SCOPE_CAMPUS, "Campus"),
        (SCOPE_COLLEGE, "College"),
        (SCOPE_DEPARTMENT, "Department"),
    ]

    category_id = models.CharField(
        max_length=30,
        primary_key=True,
        editable=False
    )

    office_name = models.CharField(max_length=150)
    office_description = models.TextField(blank=True)
    office_scope = models.CharField(
        max_length=20,
        choices=SCOPE_CHOICES,
        default=SCOPE_GENERAL,
    )

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
        unique_together = ("office_name", "office_scope", "campus", "college", "department")

    def clean(self):
        if self.office_scope == self.SCOPE_GENERAL:
            return

        if self.office_scope == self.SCOPE_CAMPUS and not self.campus_id:
            raise ValidationError("Campus office categories must specify a campus.")

        if self.office_scope == self.SCOPE_COLLEGE and not self.college_id:
            raise ValidationError("College office categories must specify a college.")

        if self.office_scope == self.SCOPE_DEPARTMENT and not self.department_id:
            raise ValidationError("Department office categories must specify a department.")

        if self.department_id and self.college_id:
            if self.department.department_college_id != self.college_id:
                raise ValidationError("Selected department does not belong to the selected college.")

        if self.college_id and self.campus_id:
            if self.college.college_campus_id != self.campus_id:
                raise ValidationError("Selected college does not belong to the selected campus.")

    def matches_scope(self, campus=None, college=None, department=None):
        if self.office_scope == self.SCOPE_GENERAL:
            return True
        if self.office_scope == self.SCOPE_CAMPUS:
            return bool(campus and self.campus_id == campus.id)
        if self.office_scope == self.SCOPE_COLLEGE:
            return bool(college and self.college_id == college.id)
        if self.office_scope == self.SCOPE_DEPARTMENT:
            return bool(department and self.department_id == department.id)
        return False

    def matches_officer(self, officer_user):
        profile = getattr(officer_user, "officer_profile", None)
        if profile is None:
            return False

        department = profile.department
        college = profile.college or (department.department_college if department else None)
        campus = college.college_campus if college else None
        return self.matches_scope(campus=campus, college=college, department=department)

    def save(self, *args, **kwargs):
        if not self.category_id:
            self.category_id = f"CAT-{uuid.uuid4().hex[:10].upper()}"
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.office_name



class ResolverLevel(models.Model):
    name = models.CharField(max_length=100)  # e.g. Department, Dean, President
    level_order = models.PositiveIntegerField(unique=True)  # 1, 2, 3...
    escalation_time = models.DurationField(
        help_text="Time before escalation (e.g. 48 hours)"
    )

    class Meta:
        ordering = ["level_order"]

    def __str__(self):
        return f"{self.name} (L{self.level_order})"




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

    submitter_campus = models.ForeignKey(
        "accounts.Campus",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_complaints",
    )
    submitter_college = models.ForeignKey(
        "accounts.College",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_complaints",
    )
    submitter_department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_complaints",
    )

    title = models.CharField(max_length=255)
    description = models.TextField()
    attachment = models.FileField(
        upload_to="attachments/",
        null=True,
        blank=True
    )
    is_anonymous = models.BooleanField(default=False)

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

    def _get_submitter_scope(self):
        student_profile = getattr(self.submitted_by, "student_profile", None)
        if student_profile is not None:
            department = student_profile.department
            college = department.department_college if department else None
            campus = college.college_campus if college else None
            return campus, college, department

        officer_profile = getattr(self.submitted_by, "officer_profile", None)
        if officer_profile is not None:
            department = officer_profile.department
            college = officer_profile.college or (department.department_college if department else None)
            campus = college.college_campus if college else None
            return campus, college, department

        return None, None, None

    def _sync_submitter_scope_snapshot(self):
        campus, college, department = self._get_submitter_scope()
        self.submitter_campus = campus
        self.submitter_college = college
        self.submitter_department = department

    def clean(self):
        if self.submitted_by_id:
            self._sync_submitter_scope_snapshot()

        if self.category:
            if not self.category.matches_scope(
                campus=self.submitter_campus,
                college=self.submitter_college,
                department=self.submitter_department,
            ):
                raise ValidationError("Selected office category does not match the complainant's campus/college/department.")

        if self.assigned_officer_id and self.category:
            if not self.category.matches_officer(self.assigned_officer):
                raise ValidationError("Assigned officer does not match the complaint office scope.")

    def __str__(self):
        return f"{self.complaint_id}  {self.title}  ({self.status})"

    def set_escalation_deadline(self):
        if self.current_level:
            self.escalation_deadline = timezone.now() + self.current_level.escalation_time

    def save(self, *args, **kwargs):
        if self.current_level and not self.escalation_deadline:
            self.set_escalation_deadline()
        self.full_clean()
        super().save(*args, **kwargs)

    def escalate_to_next_level(self):
        """Escalate complaint to the next resolver level"""
        if not self.category or not self.current_level:
            return False
        
        # Find the next level for this category
        next_level = ResolverLevel.objects.filter(
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
    file_data = models.BinaryField(null=True, blank=True)
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


class AnnouncementLike(models.Model):
    announcement = models.ForeignKey(
        PublicAnnouncement,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='announcement_likes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('announcement', 'user')
        ordering = ['-created_at']


class AnnouncementComment(models.Model):
    announcement = models.ForeignKey(
        PublicAnnouncement,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='announcement_comments'
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']



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
