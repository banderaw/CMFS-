from rest_framework import serializers
from .models import Institution, Category, ResolverLevel, CategoryResolver, Complaint, ComplaintAttachment, ComplaintCC, Comment, Assignment, Response, Notification, Appointment
from .models import PublicAnnouncement

from django.contrib.auth import get_user_model

User = get_user_model()


class ComplaintUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]
        ref_name = "ComplaintUser"


class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        fields = ["id", "name", "domain", "created_at"]


class CategorySerializer(serializers.ModelSerializer):
    campus = serializers.PrimaryKeyRelatedField(
        queryset=Category._meta.get_field("campus").remote_field.model.objects.all(),
        required=False,
        allow_null=True,
    )
    college = serializers.PrimaryKeyRelatedField(
        queryset=Category._meta.get_field("college").remote_field.model.objects.all(),
        required=False,
        allow_null=True,
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Category._meta.get_field("department").remote_field.model.objects.all(),
        required=False,
        allow_null=True,
    )

    institution_name = serializers.CharField(source='institution.name', read_only=True)
    parent_name = serializers.CharField(source='parent.office_name', read_only=True)
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True)
    college_name = serializers.CharField(source='college.college_name', read_only=True)
    department_name = serializers.CharField(source='department.department_name', read_only=True)

    class Meta:
        model = Category
        fields = [
            "category_id",
            "institution",
            "institution_name",
            "office_name",
            "office_description",
            "campus",
            "campus_name",
            "college",
            "college_name",
            "department",
            "department_name",
            "parent",
            "parent_name",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["category_id", "created_at"]

    def validate(self, attrs):
        # Accept empty strings from form submissions for nullable relations.
        for relation_key in ["campus", "college", "department"]:
            raw_value = self.initial_data.get(relation_key, None)
            if raw_value == "" and relation_key not in attrs:
                attrs[relation_key] = None

        # Backward compatibility for clients still sending legacy keys.
        if not attrs.get("office_name"):
            legacy_name = self.initial_data.get("name")
            if legacy_name:
                attrs["office_name"] = legacy_name

        if "office_description" not in attrs:
            legacy_description = self.initial_data.get("description")
            if legacy_description is not None:
                attrs["office_description"] = legacy_description

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Keep `name` and `description` in response payloads for older UI paths.
        data["name"] = data.get("office_name", "")
        data["description"] = data.get("office_description", "")
        return data


class ResolverLevelSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source='institution.name', read_only=True)

    class Meta:
        model = ResolverLevel
        fields = ["id", "institution", "institution_name", "name", "level_order", "escalation_time"]
        read_only_fields = ["id"]


class CategoryResolverSerializer(serializers.ModelSerializer):
    officer_name = serializers.CharField(source='officer.full_name', read_only=True)
    level_name = serializers.CharField(source='level.name', read_only=True)
    category_name = serializers.CharField(source='category.office_name', read_only=True)

    class Meta:
        model = CategoryResolver
        fields = ["id", "category", "category_name", "level", "level_name", "officer", "officer_name", "active"]
        read_only_fields = ["id", "officer_name", "level_name", "category_name"]


class ComplaintCreateSerializer(serializers.ModelSerializer):
    cc_emails = serializers.ListField(
        child=serializers.EmailField(), required=False, write_only=True, default=list
    )
    cc_officer_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, write_only=True, default=list
    )

    class Meta:
        model = Complaint
        fields = ["title", "description", "institution", "category", "attachment", "cc_emails", "cc_officer_ids"]

    def create(self, validated_data):
        cc_emails = validated_data.pop('cc_emails', [])
        cc_officer_ids = validated_data.pop('cc_officer_ids', [])
        request = self.context.get('request')
        complaint = Complaint.objects.create(**validated_data)

        if request and hasattr(request, 'FILES'):
            for key, file in request.FILES.items():
                if key.startswith('attachment_'):
                    ComplaintAttachment.objects.create(
                        complaint=complaint,
                        file=file,
                        filename=file.name,
                        file_size=file.size,
                        content_type=file.content_type
                    )

        for email in cc_emails:
            ComplaintCC.objects.get_or_create(complaint=complaint, email=email)

        cc_officers = User.objects.filter(id__in=cc_officer_ids, role='officer')
        for officer in cc_officers:
            ComplaintCC.objects.get_or_create(complaint=complaint, email=officer.email)
            Notification.objects.create(
                user=officer,
                complaint=complaint,
                notification_type='complaint_update',
                title=f"CC Complaint: {complaint.title}",
                message=f"You were added as CC on complaint '{complaint.title}'.",
            )

        return complaint


class ComplaintAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintAttachment
        fields = ["id", "file", "filename", "file_size", "content_type", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]


class CCSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintCC
        fields = ['email']


class ComplaintSerializer(serializers.ModelSerializer):
    submitted_by = ComplaintUserSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    assigned_officer = ComplaintUserSerializer(read_only=True)
    current_level = ResolverLevelSerializer(read_only=True)
    attachments = ComplaintAttachmentSerializer(many=True, read_only=True)
    cc_list = CCSerializer(many=True, read_only=True)

    class Meta:
        model = Complaint
        fields = [
            "complaint_id", "institution", "submitted_by", "category",
            "title", "description", "attachment", "attachments", "cc_list",
            "created_at", "updated_at", "status",
            "assigned_officer", "current_level", "escalation_deadline",
        ]
        read_only_fields = ["complaint_id", "created_at", "updated_at", "escalation_deadline"]

    def create(self, validated_data):
        request = self.context.get('request')
        complaint = Complaint.objects.create(**validated_data)
        if request and hasattr(request, 'FILES'):
            for key, file in request.FILES.items():
                if key.startswith('attachment_'):
                    ComplaintAttachment.objects.create(
                        complaint=complaint,
                        file=file, filename=file.name,
                        file_size=file.size, content_type=file.content_type
                    )
        return complaint


class CommentSerializer(serializers.ModelSerializer):
    author = ComplaintUserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "complaint", "author", "comment_type", "message", "rating", "created_at", "updated_at"]


class ResponseSerializer(serializers.ModelSerializer):
    responder = ComplaintUserSerializer(read_only=True)

    class Meta:
        model = Response
        fields = ["id", "complaint", "responder", "response_type", "title", "message", "attachment", "is_public", "created_at", "updated_at"]


class AssignmentSerializer(serializers.ModelSerializer):
    officer = ComplaintUserSerializer(read_only=True)

    class Meta:
        model = Assignment
        fields = ["id", "complaint", "officer", "level", "assigned_at", "ended_at", "reason"]


class NotificationSerializer(serializers.ModelSerializer):
    complaint_title = serializers.CharField(source='complaint.title', read_only=True, allow_null=True)
    complaint_id = serializers.CharField(source='complaint.complaint_id', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            "id", "user", "complaint", "complaint_id", "complaint_title",
            "notification_type", "title", "message", "is_read", 
            "read_at", "created_at"
        ]
        read_only_fields = ["id", "user", "created_at"]


class PublicAnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PublicAnnouncement
        fields = [
            "id", "title", "message", "created_by", "created_by_name",
            "is_active", "is_pinned", "expires_at", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        full_name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return full_name or obj.created_by.email




class AppointmentSerializer(serializers.ModelSerializer):
    requested_by = ComplaintUserSerializer(read_only=True)
    officer = ComplaintUserSerializer(read_only=True)
    officer_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='officer', write_only=True, required=False, allow_null=True
    )
    complaint_title = serializers.CharField(source='complaint.title', read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'complaint', 'complaint_title', 'requested_by', 'officer', 'officer_id',
            'scheduled_at', 'location', 'note', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'requested_by', 'created_at', 'updated_at']
