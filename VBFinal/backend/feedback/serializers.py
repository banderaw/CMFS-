from rest_framework import serializers
from .models import FeedbackTemplate, TemplateField, FeedbackResponse, FeedbackAnswer
from accounts.models import Campus, College, Department, User
import uuid
import hashlib


class TemplateFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplateField
        fields = ['id', 'label', 'field_type', 'options', 'is_required', 'order']


class FeedbackTemplateSerializer(serializers.ModelSerializer):
    fields = TemplateFieldSerializer(many=True, read_only=True)
    created_by = serializers.CharField(source='created_by.full_name', read_only=True)
    created_by_role = serializers.SerializerMethodField()
    approved_by = serializers.CharField(source='approved_by.full_name', read_only=True, allow_null=True)
    target_campus_name = serializers.CharField(source='target_campus.campus_name', read_only=True, allow_null=True)
    target_college_name = serializers.CharField(source='target_college.college_name', read_only=True, allow_null=True)
    target_department_name = serializers.CharField(source='target_department.department_name', read_only=True, allow_null=True)
    target_user_ids = serializers.SerializerMethodField()
    
    class Meta:
        model = FeedbackTemplate
        fields = ['id', 'title', 'description', 'office', 'status', 'priority', 
                 'audience_scope', 'target_campus', 'target_college', 'target_department',
                 'target_campus_name', 'target_college_name', 'target_department_name', 'target_user_ids',
                 'created_at', 'updated_at', 'fields', 
                 'created_by', 'created_by_role', 'approved_by', 'approved_at']
        read_only_fields = ['created_by', 'office', 'approved_by', 'approved_at']
    
    def get_created_by_role(self, obj):
        if obj.created_by.is_admin():
            return 'admin'
        elif obj.created_by.is_officer():
            return 'officer'
        return 'user'

    def get_target_user_ids(self, obj):
        return list(obj.target_users.values_list('id', flat=True))


class FeedbackTemplateCreateSerializer(serializers.ModelSerializer):
    fields = TemplateFieldSerializer(many=True)
    target_user_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, write_only=True, default=list)
    audience_scope = serializers.ChoiceField(choices=FeedbackTemplate.AUDIENCE_SCOPE_CHOICES, required=False, default=FeedbackTemplate.AUDIENCE_ALL)
    target_campus = serializers.PrimaryKeyRelatedField(queryset=Campus.objects.all(), required=False, allow_null=True)
    target_college = serializers.PrimaryKeyRelatedField(queryset=College.objects.all(), required=False, allow_null=True)
    target_department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    
    class Meta:
        model = FeedbackTemplate
        fields = [
            'title', 'description', 'fields', 'priority',
            'audience_scope', 'target_campus', 'target_college', 'target_department', 'target_user_ids'
        ]

    def validate(self, attrs):
        audience_scope = attrs.get('audience_scope', FeedbackTemplate.AUDIENCE_ALL)
        target_campus = attrs.get('target_campus')
        target_college = attrs.get('target_college')
        target_department = attrs.get('target_department')
        target_user_ids = attrs.get('target_user_ids', [])

        if audience_scope == FeedbackTemplate.AUDIENCE_CAMPUS and not target_campus:
            raise serializers.ValidationError({'target_campus': 'Target campus is required for campus audience.'})
        if audience_scope == FeedbackTemplate.AUDIENCE_COLLEGE and not target_college:
            raise serializers.ValidationError({'target_college': 'Target college is required for college audience.'})
        if audience_scope == FeedbackTemplate.AUDIENCE_DEPARTMENT and not target_department:
            raise serializers.ValidationError({'target_department': 'Target department is required for department audience.'})
        if audience_scope == FeedbackTemplate.AUDIENCE_USERS and not target_user_ids:
            raise serializers.ValidationError({'target_user_ids': 'Select at least one user for specific users audience.'})

        if target_college and target_campus and target_college.college_campus_id != target_campus.id:
            raise serializers.ValidationError({'target_college': 'Selected college does not belong to target campus.'})
        if target_department and target_college and target_department.department_college_id != target_college.id:
            raise serializers.ValidationError({'target_department': 'Selected department does not belong to target college.'})

        attrs['target_user_ids'] = list(dict.fromkeys(target_user_ids))
        return attrs
    
    def create(self, validated_data):
        fields_data = validated_data.pop('fields')
        target_user_ids = validated_data.pop('target_user_ids', [])
        user = self.context['request'].user
        
        # Set default status based on user role
        if user.is_admin():
            status = FeedbackTemplate.STATUS_ACTIVE
        else:
            status = FeedbackTemplate.STATUS_PENDING
        
        office_name = 'General'
        officer_profile = getattr(user, 'officer_profile', None)
        student_profile = getattr(user, 'student_profile', None)
        if officer_profile:
            if officer_profile.department_id:
                office_name = officer_profile.department.department_name or office_name
            elif officer_profile.college_id:
                office_name = officer_profile.college.college_name or office_name
        elif student_profile and student_profile.department_id:
            office_name = student_profile.department.department_name or office_name

        template = FeedbackTemplate.objects.create(
            **validated_data,
            created_by=user,
            office=office_name,
            status=status
        )

        if target_user_ids:
            target_users = User.objects.filter(id__in=target_user_ids, is_active=True)
            template.target_users.set(target_users)
        
        for field_data in fields_data:
            TemplateField.objects.create(template=template, **field_data)
        
        return template


class FeedbackAnswerSerializer(serializers.ModelSerializer):
    field_id = serializers.UUIDField(write_only=True)
    
    class Meta:
        model = FeedbackAnswer
        fields = ['field_id', 'text_value', 'number_value', 'rating_value', 
                 'choice_value', 'checkbox_values']


class FeedbackResponseSerializer(serializers.ModelSerializer):
    answers = FeedbackAnswerSerializer(many=True)
    
    class Meta:
        model = FeedbackResponse
        fields = ['template', 'answers']
    
    def create(self, validated_data):
        answers_data = validated_data.pop('answers')
        request = self.context['request']
        
        # Generate session token
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        ip_address = self.get_client_ip(request)
        timestamp = str(uuid.uuid4())
        session_token = hashlib.sha256(f"{user_agent}{ip_address}{timestamp}".encode()).hexdigest()
        
        response = FeedbackResponse.objects.create(
            **validated_data,
            session_token=session_token,
            ip_address=ip_address,
            user=request.user
        )
        
        for answer_data in answers_data:
            field_id = answer_data.pop('field_id')
            field = TemplateField.objects.get(id=field_id, template=response.template)
            FeedbackAnswer.objects.create(
                response=response,
                field=field,
                **answer_data
            )
        
        return response
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class FeedbackAnalyticsSerializer(serializers.Serializer):
    total_responses = serializers.IntegerField()
    field_analytics = serializers.DictField()
    response_trend = serializers.ListField()
