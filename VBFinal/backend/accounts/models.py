from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager
)
from django.contrib.auth.models import Group, Permission
from django.utils import timezone
from django.conf import settings
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError


class SystemLog(models.Model):
    LEVEL_CHOICES = [
        ('INFO', 'Info'),
        ('WARN', 'Warning'),
        ('ERROR', 'Error'),
        ('SUCCESS', 'Success'),
    ]
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='INFO')
    message = models.TextField()
    category = models.CharField(max_length=50, default='SYSTEM')
    user = models.CharField(max_length=255, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    method = models.CharField(max_length=10, blank=True, null=True)
    path = models.CharField(max_length=500, blank=True, null=True)
    status_code = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['level', 'created_at'])]

    def __str__(self):
        return f"[{self.level}] {self.category}: {self.message[:60]}"


class EmailLog(models.Model):
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('pending', 'Pending'),
    ]
    
    EMAIL_TYPE_CHOICES = [
        ('verification', 'Email Verification'),
        ('password_reset', 'Password Reset'),
        ('complaint_notification', 'Complaint Notification'),
        ('assignment_notification', 'Assignment Notification'),
        ('escalation_alert', 'Escalation Alert'),
        ('general', 'General'),
    ]
    
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='email_logs'
    )
    email = models.EmailField()
    subject = models.CharField(max_length=255)
    message = models.TextField()
    email_type = models.CharField(max_length=50, choices=EMAIL_TYPE_CHOICES, default='general')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['email', 'status']),
            models.Index(fields=['email_type', 'sent_at']),
        ]
    
    def __str__(self):
        return f"{self.email_type} to {self.email} - {self.status}"


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', User.ROLE_ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_superuser') is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)

class Campus(models.Model):
    campus_name = models.CharField(max_length=100, blank=True, null=True)
    location    = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.campus_name or ''


class College(models.Model):
    college_name   = models.CharField(max_length=100, null=True, blank=True)
    college_code   = models.CharField(max_length=20, null=True, blank=True)
    college_campus = models.ForeignKey(Campus, on_delete=models.CASCADE, null=True, blank=True, related_name='colleges')
    description    = models.TextField(blank=True, null=True)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.college_name or ''


class Department(models.Model):
    department_name    = models.CharField(max_length=100, null=True, blank=True)
    department_college = models.ForeignKey(College, on_delete=models.CASCADE, null=True, blank=True, related_name='departments')
    description        = models.TextField(blank=True, null=True)
    is_active          = models.BooleanField(default=True)
    created_at         = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.department_name or ''


class Program(models.Model):
    program_name       = models.CharField(max_length=100, null=True, blank=True)
    description        = models.TextField(blank=True, null=True)
    is_active          = models.BooleanField(default=True)
    created_at         = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.program_name or ''
class User(AbstractBaseUser, PermissionsMixin):
    ROLE_USER = 'user'  # Complainter
    ROLE_OFFICER = 'officer'  # Resolver
    ROLE_ADMIN = 'admin'  # System Admin
    ROLE_CHOICES = [
        (ROLE_USER, 'User (Complainter)'),
        (ROLE_OFFICER, 'Officer (Resolver)'),
        (ROLE_ADMIN, 'Admin (System Admin)'),
    ]

    ROLE_LEVEL = {
        ROLE_USER: 1,
        ROLE_OFFICER: 2,
        ROLE_ADMIN: 3,
    }
   
    
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,10}$',
        message="Phone number must be entered in the format: '+0918121314'. Up to 10 digits allowed."
    )

    email = models.EmailField(unique=True, db_index=True)
    gmail_account = models.EmailField(unique=True, null=True, blank=True, db_index=True)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True, db_index=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    phone = models.CharField(
        validators=[phone_regex],
        max_length=17,
        null=True,
        blank=True
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_USER,
        db_index=True
    )

    AUTH_LOCAL = 'local'
    AUTH_MICROSOFT = 'microsoft'
    AUTH_GOOGLE = 'google'
    AUTH_PROVIDER_CHOICES = [
        (AUTH_LOCAL, 'Local'),
        (AUTH_MICROSOFT, 'Microsoft'),
        (AUTH_GOOGLE, 'Google'),
    ]

    auth_provider = models.CharField(
        max_length=20,
        choices=AUTH_PROVIDER_CHOICES,
        default=AUTH_LOCAL,
        db_index=True
    )
    microsoft_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        db_index=True
    )
    google_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        db_index=True
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    groups = models.ManyToManyField(
        Group,
        verbose_name='groups',
        blank=True,
        related_name="custom_user_set",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name='user permissions',
        blank=True,
        related_name="custom_user_set",
        related_query_name="user",
    )

    class Meta:
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['auth_provider']),
            models.Index(fields=['is_active', 'role']),
        ]
    
    def clean(self):
        if self.auth_provider == self.AUTH_MICROSOFT and not self.microsoft_id:
            raise ValidationError("Microsoft ID is required for Microsoft auth provider")

        if self.gmail_account and not self.gmail_account.lower().endswith('@gmail.com'):
            raise ValidationError("Gmail account must be a valid @gmail.com address")

        if not self.pk:
            return

        student_profile_exists = Student.objects.filter(user_id=self.pk).exists()
        officer_profile_exists = Officer.objects.filter(user_id=self.pk).exists()

        if student_profile_exists and officer_profile_exists:
            raise ValidationError("A user cannot have both student and officer profiles.")

        if student_profile_exists and self.role != self.ROLE_USER:
            raise ValidationError("Users with a student profile must have the student role.")

        if officer_profile_exists and self.role != self.ROLE_OFFICER:
            raise ValidationError("Users with an officer profile must have the officer role.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def save(self, *args, **kwargs):
        if self.gmail_account:
            self.gmail_account = self.gmail_account.strip().lower()

        # Backward compatibility for legacy records that still carry super_admin.
        if self.role == 'super_admin':
            self.role = self.ROLE_ADMIN

        if self.role == self.ROLE_ADMIN and not self.is_staff:
            self.is_staff = True

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} | {self.role.upper()}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def role_level(self):
        return self.ROLE_LEVEL.get(self.role, 0)

    def is_complainter(self):
        return self.role == self.ROLE_USER

    def is_resolver(self):
        return self.role == self.ROLE_OFFICER

    def is_admin(self):
        return self.role == self.ROLE_ADMIN

    def is_officer(self):
        return self.role == self.ROLE_OFFICER

    @property
    def is_anonymous(self):
        return False

    @property
    def is_authenticated(self):
        return True

    def can_manage(self, other_user):
        return self.role_level > other_user.role_level

    def can_submit_complaint(self):
        return self.role == self.ROLE_USER

    def can_be_assigned_complaints(self):
        return self.role == self.ROLE_OFFICER

    def can_assign_complaints(self):
        return self.role in [self.ROLE_OFFICER, self.ROLE_ADMIN]
    
    def can_escalate_complaints(self):
        return self.role in [self.ROLE_OFFICER, self.ROLE_ADMIN]
    
    def can_view_all_complaints(self):
        return self.role in [self.ROLE_OFFICER, self.ROLE_ADMIN]

    def mark_password_as_local_auth(self):
        if self.auth_provider in [self.AUTH_MICROSOFT, self.AUTH_GOOGLE]:
            self.auth_provider = self.AUTH_LOCAL
            self.save(update_fields=['auth_provider'])

    @property
    def preferred_notification_email(self):
        return self.gmail_account or self.email
    
    def get_accessible_complaints(self):
        from complaints.models import Complaint
        
        if self.can_view_all_complaints():
            return Complaint.objects.all()
        elif self.is_resolver():
            return Complaint.objects.filter(assigned_officer=self)
        else:
            return Complaint.objects.filter(submitted_by=self)

class StudentType(models.Model):
    type_name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['type_name']
        indexes = [models.Index(fields=['type_name'])]

    def __str__(self):
        return self.type_name

class Student(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )
    student_id = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    student_type = models.ForeignKey(StudentType, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    campus_id = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    year_of_study = models.PositiveIntegerField(null=True, blank=True)
    
    class Meta:
        ordering = ['user__first_name', 'user__last_name']
        indexes = [
            models.Index(fields=['student_id']),
            models.Index(fields=['department']),
            models.Index(fields=['program']),
        ]

    def clean(self):
        if self.user and self.user.role != User.ROLE_USER:
            raise ValidationError("Only users with the student role can have a student profile.")

        if self.user_id:
            existing_officer = Officer.objects.filter(user_id=self.user_id)
            if self.pk:
                existing_officer = existing_officer.exclude(user_id=self.user_id, pk=self.pk)
            if existing_officer.exists():
                raise ValidationError("This user already has an officer profile and cannot also be assigned a student profile.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.full_name} ({self.student_id})"

class Officer(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='officer_profile'
    )
    employee_id = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    college = models.ForeignKey(College, on_delete=models.SET_NULL, null=True, blank=True, related_name='officers')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='officers')
    
    class Meta:
        ordering = ['user__first_name', 'user__last_name']
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['college']),
            models.Index(fields=['department']),
        ]

    def clean(self):
        if self.user and self.user.role != User.ROLE_OFFICER:
            raise ValidationError("Only users with the officer role can have an officer profile.")

        if self.user_id:
            existing_student = Student.objects.filter(user_id=self.user_id)
            if self.pk:
                existing_student = existing_student.exclude(user_id=self.user_id, pk=self.pk)
            if existing_student.exists():
                raise ValidationError("This user already has a student profile and cannot also be assigned an officer profile.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.full_name} ({self.employee_id})"
class PasswordResetToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token', 'is_used']),
        ]
    
    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
    
    def __str__(self):
        return f"Reset token for {self.user.email}"


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_verification_tokens'
    )
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token', 'is_used']),
        ]
    
    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
    
    def __str__(self):
        return f"Verification token for {self.user.email}"
