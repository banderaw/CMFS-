from django.contrib import admin
from .models import User, EmailLog, PasswordResetToken, EmailVerificationToken , Campus, College, Department
admin.site.register(Campus)
admin.site.register(College)
admin.site.register(Department)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "full_name", "role", "college", "is_active", "is_email_verified", "date_joined")
    list_filter = ("role", "is_active", "is_email_verified", "auth_provider", "college")
    search_fields = ("email", "first_name", "last_name", "campus_id")
    readonly_fields = ("date_joined", "last_login")


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ("email", "email_type", "status", "sent_at")
    list_filter = ("status", "email_type", "sent_at")
    search_fields = ("email", "subject")
    readonly_fields = ("sent_at",)


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "is_used", "created_at", "expires_at")
    list_filter = ("is_used", "created_at")
    search_fields = ("user__email",)
    readonly_fields = ("created_at",)


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "is_used", "created_at", "expires_at")
    list_filter = ("is_used", "created_at")
    search_fields = ("user__email",)
    readonly_fields = ("created_at",)
