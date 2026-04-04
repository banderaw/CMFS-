from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import (
    Campus,
    College,
    Department,
    EmailLog,
    EmailVerificationToken,
    MaintenanceConfiguration,
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


class MaintenanceConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceConfiguration
        fields = ['is_enabled', 'message', 'scheduled_start', 'scheduled_end', 'updated_at']
        read_only_fields = ['updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['is_enabled'] = instance.active_now
        return data


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


class UserProfileMixin:
    campus_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    user_campus = serializers.IntegerField(required=False, allow_null=True)
    college = serializers.IntegerField(required=False, allow_null=True)
    department = serializers.IntegerField(required=False, allow_null=True)

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

    def _extract_profile_data(self, validated_data):
        return {
            'campus_id': validated_data.pop('campus_id', serializers.empty),
            'user_campus': validated_data.pop('user_campus', serializers.empty),
            'college': validated_data.pop('college', serializers.empty),
            'department': validated_data.pop('department', serializers.empty),
        }

    def _normalize_optional_int(self, value):
        if value in (serializers.empty, '', None):
            return None if value != serializers.empty else serializers.empty
        return int(value)

    def _validate_scope_references(self, profile_data, role):
        campus_pk = self._normalize_optional_int(profile_data['user_campus'])
        college_pk = self._normalize_optional_int(profile_data['college'])
        department_pk = self._normalize_optional_int(profile_data['department'])

        campus = None
        college = None
        department = None

        if campus_pk not in (None, serializers.empty):
            campus = Campus.objects.filter(pk=campus_pk).first()
            if campus is None:
                raise serializers.ValidationError({'user_campus': 'Selected campus does not exist.'})

        if college_pk not in (None, serializers.empty):
            college = College.objects.filter(pk=college_pk).first()
            if college is None:
                raise serializers.ValidationError({'college': 'Selected college does not exist.'})
            if campus and college.college_campus_id != campus.id:
                raise serializers.ValidationError({'college': 'Selected college does not belong to the selected campus.'})

        if department_pk not in (None, serializers.empty):
            department = Department.objects.filter(pk=department_pk).first()
            if department is None:
                raise serializers.ValidationError({'department': 'Selected department does not exist.'})
            if college and department.department_college_id != college.id:
                raise serializers.ValidationError({'department': 'Selected department does not belong to the selected college.'})
            if campus and department.department_college.college_campus_id != campus.id:
                raise serializers.ValidationError({'department': 'Selected department does not belong to the selected campus.'})

        if role == User.ROLE_USER and college and department is None:
            raise serializers.ValidationError({'department': 'Student users must select a department.'})

        return {
            'campus': campus,
            'college': college,
            'department': department,
            'campus_pk': campus_pk,
            'college_pk': college_pk,
            'department_pk': department_pk,
        }

    def _validate_role_change(self, role):
        instance = getattr(self, 'instance', None)
        if instance is None:
            return

        current_student_profile = getattr(instance, 'student_profile', None)
        current_officer_profile = getattr(instance, 'officer_profile', None)

        if current_student_profile is not None and role != User.ROLE_USER:
            raise serializers.ValidationError({'role': 'This user already has a student profile and cannot change to a non-user role.'})

        if current_officer_profile is not None and role != User.ROLE_OFFICER:
            raise serializers.ValidationError({'role': 'This user already has an officer profile and cannot change to a non-officer role.'})

    def _sync_profiles(self, user, profile_data, role):
        campus_id_value = profile_data['campus_id']
        refs = self._validate_scope_references(profile_data, role)
        department = refs['department']
        college = refs['college']

        if role == User.ROLE_USER:
            if getattr(user, 'officer_profile', None) is not None:
                raise serializers.ValidationError({'role': 'This user already has an officer profile.'})

            should_update_student = any(
                profile_data[key] is not serializers.empty for key in ['campus_id', 'department', 'college', 'user_campus']
            ) or getattr(user, 'student_profile', None) is not None

            if should_update_student:
                student_profile = getattr(user, 'student_profile', None)
                if student_profile is None:
                    student_profile = Student(user=user)

                if campus_id_value is not serializers.empty:
                    student_profile.campus_id = campus_id_value or None

                if profile_data['department'] is not serializers.empty:
                    student_profile.department = department

                student_profile.save()

        elif role == User.ROLE_OFFICER:
            if getattr(user, 'student_profile', None) is not None:
                raise serializers.ValidationError({'role': 'This user already has a student profile.'})

            should_update_officer = any(
                profile_data[key] is not serializers.empty for key in ['college', 'department']
            ) or getattr(user, 'officer_profile', None) is not None

            if should_update_officer:
                officer_profile = getattr(user, 'officer_profile', None)
                if officer_profile is None:
                    officer_profile = Officer(user=user)

                if profile_data['college'] is not serializers.empty:
                    officer_profile.college = college

                if profile_data['department'] is not serializers.empty:
                    officer_profile.department = department
                    if department and officer_profile.college_id is None:
                        officer_profile.college = department.department_college

                officer_profile.save()

    def _apply_user_updates(self, instance, validated_data):
        validated_data.pop('confirm_password', None)
        password = validated_data.pop('password', None)
        role = validated_data.get('role', instance.role)
        profile_data = self._extract_profile_data(validated_data)

        self._validate_role_change(role)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        self._sync_profiles(instance, profile_data, role)
        instance.refresh_from_db()
        return instance


class UserReadWriteBaseSerializer(UserProfileMixin, serializers.ModelSerializer):
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
            'campus_id',
            'user_campus',
            'college',
            'department',
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

    def validate(self, data):
        data = super().validate(data)
        if data.get('password') or data.get('confirm_password'):
            if data.get('password') != data.get('confirm_password'):
                raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return data

    @transaction.atomic
    def update(self, instance, validated_data):
        return self._apply_user_updates(instance, validated_data)


class SelfUserSerializer(UserReadWriteBaseSerializer):
    class Meta(UserReadWriteBaseSerializer.Meta):
        read_only_fields = UserReadWriteBaseSerializer.Meta.read_only_fields + [
            'email',
            'role',
            'is_active',
            'is_staff',
            'is_email_verified',
        ]


class AdminUserSerializer(UserReadWriteBaseSerializer):
    class Meta(UserReadWriteBaseSerializer.Meta):
        read_only_fields = UserReadWriteBaseSerializer.Meta.read_only_fields + ['is_staff']

    def validate(self, data):
        data = super().validate(data)
        role = data.get('role', getattr(self.instance, 'role', User.ROLE_USER))
        self._validate_role_change(role)
        return data

    @transaction.atomic
    def create(self, validated_data):
        profile_data = self._extract_profile_data(validated_data)
        password = validated_data.pop('password', None)
        validated_data.pop('confirm_password', None)

        if not password:
            raise serializers.ValidationError({'password': 'Password is required.'})

        email = validated_data.pop('email')
        try:
            user = User.objects.create_user(email=email, password=password, **validated_data)
        except IntegrityError as exc:
            message = str(exc)
            if 'accounts_user_username' in message:
                raise serializers.ValidationError({'username': 'This username is already in use.'})
            if 'accounts_user_email' in message:
                raise serializers.ValidationError({'email': 'This email is already in use.'})
            if 'accounts_user_gmail_account' in message:
                raise serializers.ValidationError({'gmail_account': 'This Gmail account is already in use.'})
            raise serializers.ValidationError({'detail': 'Unable to create account with the provided data.'})

        self._sync_profiles(user, profile_data, user.role)
        user.refresh_from_db()
        return user


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
            if 'accounts_user_username' in message:
                raise serializers.ValidationError({'username': 'This username is already in use.'})
            if 'accounts_user_email' in message:
                raise serializers.ValidationError({'email': 'This email is already in use.'})
            if 'accounts_user_gmail_account' in message:
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
