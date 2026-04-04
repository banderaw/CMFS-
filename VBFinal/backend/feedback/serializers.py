from rest_framework import serializers
from .models import FeedbackTemplate, TemplateField, FeedbackResponse, FeedbackAnswer
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
    
    class Meta:
        model = FeedbackTemplate
        fields = ['id', 'title', 'description', 'office', 'status', 'priority', 
                 'created_at', 'updated_at', 'fields', 
                 'created_by', 'created_by_role', 'approved_by', 'approved_at']
        read_only_fields = ['created_by', 'office', 'approved_by', 'approved_at']
    
    def get_created_by_role(self, obj):
        if obj.created_by.is_admin():
            return 'admin'
        elif obj.created_by.is_officer():
            return 'officer'
        return 'user'


class FeedbackTemplateCreateSerializer(serializers.ModelSerializer):
    fields = TemplateFieldSerializer(many=True)
    
    class Meta:
        model = FeedbackTemplate
        fields = ['title', 'description', 'fields', 'priority']
    
    def create(self, validated_data):
        fields_data = validated_data.pop('fields')
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
