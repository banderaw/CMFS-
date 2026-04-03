from django.contrib.auth import authenticate
from django.db import IntegrityError
from rest_framework import serializers

from .models import (
    Campus,
    College,
    Department,
    EmailLog,
    EmailVerificationToken,
    Officer,
    PasswordResetToken,
    Program,
    Student,
    StudentType,
    SystemLog,
    User,
)


class UserSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'is_active', 'is_email_verified']
        read_only_fields = fields


class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = ['id', 'campus_name', 'location', 'description', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class CollegeSerializer(serializers.ModelSerializer):
    campus_name = serializers.CharField(source='college_campus.campus_name', read_only=True)
    campus_detail = CampusSerializer(source='college_campus', read_only=True)

    class Meta:
        model = College
        fields = [
            'id',
            'college_name',
            'college_code',
            'college_campus',
            'campus_name',
            'campus_detail',
            'description',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['campus_name', 'campus_detail', 'created_at']


class DepartmentSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='department_college.college_name', read_only=True)
    college_detail = CollegeSerializer(source='department_college', read_only=True)

    class Meta:
        model = Department
        fields = [
            'id',
            'department_name',
            'department_college',
            'college_name',
            'college_detail',
            'description',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['college_name', 'college_detail', 'created_at']


class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = ['id', 'program_name', 'description', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class StudentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentType
        fields = ['id', 'type_name', 'description', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class SystemLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemLog
        fields = [
            'id',
            'level',
            'message',
            'category',
            'user',
            'ip_address',
            'method',
            'path',
            'status_code',
            'created_at',
        ]


class EmailLogSerializer(serializers.ModelSerializer):
    recipient_detail = UserSummarySerializer(source='recipient', read_only=True)

    class Meta:
        model = EmailLog
        fields = [
            'id',
            'recipient',
            'recipient_detail',
            'email',
            'subject',
            'message',
            'email_type',
            'status',
            'error_message',
            'sent_at',
        ]
        read_only_fields = ['recipient_detail', 'sent_at']


class StudentSerializer(serializers.ModelSerializer):
    user_detail = UserSummarySerializer(source='user', read_only=True)
    student_type_detail = StudentTypeSerializer(source='student_type', read_only=True)
    department_detail = DepartmentSerializer(source='department', read_only=True)
    program_detail = ProgramSerializer(source='program', read_only=True)

    class Meta:
        model = Student
        fields = [
            'id',
            'user',
            'user_detail',
            'student_id',
            'student_type',
            'student_type_detail',
            'campus_id',
            'department',
            'department_detail',
            'program',
            'program_detail',
            'year_of_study',
        ]
        read_only_fields = ['user_detail', 'student_type_detail', 'department_detail', 'program_detail']

    def validate_user(self, value):
        if value.role != User.ROLE_USER:
            raise serializers.ValidationError('Only users with the student role can have a student profile.')

        existing_student = getattr(value, 'student_profile', None)
        if existing_student is not None and getattr(self.instance, 'pk', None) != getattr(existing_student, 'pk', None):
            raise serializers.ValidationError('This user already has a student profile.')

        if getattr(value, 'officer_profile', None) is not None:
            raise serializers.ValidationError('This user already has an officer profile and cannot be assigned a student profile.')

        return value

    def create(self, validated_data):
        return super().create(validated_data)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class OfficerSerializer(serializers.ModelSerializer):
    user_detail = UserSummarySerializer(source='user', read_only=True)
    college_detail = CollegeSerializer(source='college', read_only=True)
    department_detail = DepartmentSerializer(source='department', read_only=True)

    class Meta:
        model = Officer
        fields = [
            'id',
            'user',
            'user_detail',
            'employee_id',
            'college',
            'college_detail',
            'department',
            'department_detail',
        ]
        read_only_fields = ['user_detail', 'college_detail', 'department_detail']

    def validate_user(self, value):
        if value.role != User.ROLE_OFFICER:
            raise serializers.ValidationError('Only users with the officer role can have an officer profile.')

        existing_officer = getattr(value, 'officer_profile', None)
        if existing_officer is not None and getattr(self.instance, 'pk', None) != getattr(existing_officer, 'pk', None):
            raise serializers.ValidationError('This user already has an officer profile.')

        if getattr(value, 'student_profile', None) is not None:
            raise serializers.ValidationError('This user already has a student profile and cannot be assigned an officer profile.')

        return value

    def create(self, validated_data):
        return super().create(validated_data)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=False, min_length=8)
    full_name = serializers.CharField(read_only=True)
    role_level = serializers.IntegerField(read_only=True)
    student_profile = StudentSerializer(read_only=True)
    officer_profile = OfficerSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'gmail_account',
            'username',
            'first_name',
            'last_name',
            'phone',
            'role',
            'full_name',
            'role_level',
            'student_profile',
            'officer_profile',
            'is_active',
            'is_staff',
            'is_email_verified',
            'microsoft_id',
            'google_id',
            'password',
            'confirm_password',
            'auth_provider',
            'date_joined',
            'last_login',
        ]
        read_only_fields = [
            'id',
            'auth_provider',
            'date_joined',
            'last_login',
            'full_name',
            'role_level',
            'student_profile',
            'officer_profile',
            'microsoft_id',
            'google_id',
        ]

    def validate_email(self, value):
        return value.strip().lower()

    def validate_username(self, value):
        if value is None:
            return value
        normalized = value.strip()
        return normalized or None

    def validate_gmail_account(self, value):
        if value and not value.lower().endswith('@gmail.com'):
            raise serializers.ValidationError('Gmail account must be a valid @gmail.com address.')
        return value.lower() if value else value

    def validate(self, data):
        data = super().validate(data)

        role = data.get('role', getattr(self.instance, 'role', None))
        current_student_profile = getattr(self.instance, 'student_profile', None) if self.instance else None
        current_officer_profile = getattr(self.instance, 'officer_profile', None) if self.instance else None

        if current_student_profile is not None and role == User.ROLE_OFFICER:
            raise serializers.ValidationError({'role': 'This user already has a student profile and cannot be changed to officer role.'})

        if current_officer_profile is not None and role == User.ROLE_USER:
            raise serializers.ValidationError({'role': 'This user already has an officer profile and cannot be changed to student role.'})

        if data.get('password') or data.get('confirm_password'):
            if data.get('password') != data.get('confirm_password'):
                raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        password = validated_data.pop('password', None)
        email = validated_data.pop('email')
        return User.objects.create_user(email=email, password=password, **validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('confirm_password', None)
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        identifier = data.get('identifier', '').strip()
        password = data.get('password')

        lookup = identifier.lower() if '@' in identifier else identifier
        user = authenticate(username=lookup, password=password)
        if not user:
            raise serializers.ValidationError('Invalid credentials')
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled')

        data['user'] = user
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    gmail_account = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            'email',
            'gmail_account',
            'username',
            'first_name',
            'last_name',
            'phone',
            'password',
            'confirm_password',
        ]

    def validate_email(self, value):
        return value.strip().lower()

    def validate_gmail_account(self, value):
        if value and not value.lower().endswith('@gmail.com'):
            raise serializers.ValidationError('Gmail account must be a valid @gmail.com address.')
        return value.lower() if value else value

    def validate_username(self, value):
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    def validate(self, data):
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        email = validated_data.pop('email')

        try:
            return User.objects.create_user(email=email, password=password, **validated_data)
        except IntegrityError as exc:
            message = str(exc)
            if 'accounts_user.username' in message:
                raise serializers.ValidationError({'username': 'This username is already in use.'})
            if 'accounts_user.email' in message:
                raise serializers.ValidationError({'email': 'This email is already in use.'})
            if 'accounts_user.gmail_account' in message:
                raise serializers.ValidationError({'gmail_account': 'This Gmail account is already in use.'})
            raise serializers.ValidationError({'detail': 'Unable to create account with the provided data.'})


class PasswordResetTokenSerializer(serializers.ModelSerializer):
    user_detail = UserSummarySerializer(source='user', read_only=True)

    class Meta:
        model = PasswordResetToken
        fields = ['id', 'user', 'user_detail', 'token', 'created_at', 'expires_at', 'is_used']
        read_only_fields = ['user_detail', 'created_at']


class EmailVerificationTokenSerializer(serializers.ModelSerializer):
    user_detail = UserSummarySerializer(source='user', read_only=True)

    class Meta:
        model = EmailVerificationToken
        fields = ['id', 'user', 'user_detail', 'token', 'created_at', 'expires_at', 'is_used']
        read_only_fields = ['user_detail', 'created_at']