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
    employee_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    student_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    student_type = serializers.IntegerField(required=False, allow_null=True)
    program = serializers.IntegerField(required=False, allow_null=True)
    year_of_study = serializers.IntegerField(required=False, allow_null=True)

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
            'employee_id': validated_data.pop('employee_id', serializers.empty),
            'student_id': validated_data.pop('student_id', serializers.empty),
            'student_type': validated_data.pop('student_type', serializers.empty),
            'program': validated_data.pop('program', serializers.empty),
            'year_of_study': validated_data.pop('year_of_study', serializers.empty),
        }

    def _normalize_optional_int(self, value):
        if value in (serializers.empty, '', None):
            return None if value != serializers.empty else serializers.empty
        return int(value)

    def _validate_scope_references(self, profile_data, role):
        campus_pk = self._normalize_optional_int(profile_data['user_campus'])
        college_pk = self._normalize_optional_int(profile_data['college'])
        department_pk = self._normalize_optional_int(profile_data['department'])
        student_type_pk = self._normalize_optional_int(profile_data['student_type'])
        program_pk = self._normalize_optional_int(profile_data['program'])
        year_of_study = self._normalize_optional_int(profile_data['year_of_study'])

        campus = None
        college = None
        department = None
        student_type = None
        program = None

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

        if student_type_pk not in (None, serializers.empty):
            student_type = StudentType.objects.filter(pk=student_type_pk).first()
            if student_type is None:
                raise serializers.ValidationError({'student_type': 'Selected student type does not exist.'})

        if program_pk not in (None, serializers.empty):
            program = Program.objects.filter(pk=program_pk).first()
            if program is None:
                raise serializers.ValidationError({'program': 'Selected program does not exist.'})

        if year_of_study not in (None, serializers.empty) and year_of_study <= 0:
            raise serializers.ValidationError({'year_of_study': 'Year of study must be greater than 0.'})

        return {
            'campus': campus,
            'college': college,
            'department': department,
            'student_type': student_type,
            'program': program,
            'year_of_study': year_of_study,
            'campus_pk': campus_pk,
            'college_pk': college_pk,
            'department_pk': department_pk,
            'student_type_pk': student_type_pk,
            'program_pk': program_pk,
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
        student_id_value = profile_data['student_id']
        employee_id_value = profile_data['employee_id']
        refs = self._validate_scope_references(profile_data, role)
        department = refs['department']
        college = refs['college']
        student_type = refs['student_type']
        program = refs['program']
        year_of_study = refs['year_of_study']

        if role == User.ROLE_USER:
            if getattr(user, 'officer_profile', None) is not None:
                raise serializers.ValidationError({'role': 'This user already has an officer profile.'})

            should_update_student = any(
                profile_data[key] is not serializers.empty
                for key in ['campus_id', 'department', 'college', 'user_campus', 'student_id', 'student_type', 'program', 'year_of_study']
            ) or getattr(user, 'student_profile', None) is not None

            if should_update_student:
                student_profile = getattr(user, 'student_profile', None)
                if student_profile is None:
                    student_profile = Student(user=user)

                if campus_id_value is not serializers.empty:
                    student_profile.campus_id = campus_id_value or None

                if profile_data['department'] is not serializers.empty:
                    student_profile.department = department

                if student_id_value is not serializers.empty:
                    student_profile.student_id = (student_id_value or None)

                if profile_data['student_type'] is not serializers.empty:
                    student_profile.student_type = student_type

                if profile_data['program'] is not serializers.empty:
                    student_profile.program = program

                if profile_data['year_of_study'] is not serializers.empty:
                    student_profile.year_of_study = year_of_study

                student_profile.save()

        elif role == User.ROLE_OFFICER:
            if getattr(user, 'student_profile', None) is not None:
                raise serializers.ValidationError({'role': 'This user already has a student profile.'})

            should_update_officer = (
                role == User.ROLE_OFFICER
                or any(profile_data[key] is not serializers.empty for key in ['employee_id', 'college', 'department'])
                or getattr(user, 'officer_profile', None) is not None
            )

            if should_update_officer:
                officer_profile = getattr(user, 'officer_profile', None)
                if officer_profile is None:
                    officer_profile = Officer(user=user)

                if employee_id_value is not serializers.empty:
                    officer_profile.employee_id = employee_id_value or None

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
    employee_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    student_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    student_type = serializers.IntegerField(required=False, allow_null=True)
    program = serializers.IntegerField(required=False, allow_null=True)
    year_of_study = serializers.IntegerField(required=False, allow_null=True)
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
            'employee_id',
            'student_id',
            'student_type',
            'program',
            'year_of_study',
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
            if 'accounts_officer_employee_id' in message:
                raise serializers.ValidationError({'employee_id': 'This employee ID is already in use.'})
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


class RegisterSerializer(UserProfileMixin, serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    gmail_account = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    student_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    student_type = serializers.IntegerField(required=False, allow_null=True)
    program = serializers.IntegerField(required=False, allow_null=True)
    year_of_study = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'email',
            'gmail_account',
            'username',
            'first_name',
            'last_name',
            'phone',
            'campus_id',
            'user_campus',
            'college',
            'department',
            'student_id',
            'student_type',
            'program',
            'year_of_study',
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

        profile_data = {
            'campus_id': data.get('campus_id', serializers.empty),
            'user_campus': data.get('user_campus', serializers.empty),
            'college': data.get('college', serializers.empty),
            'department': data.get('department', serializers.empty),
            'student_id': data.get('student_id', serializers.empty),
            'student_type': data.get('student_type', serializers.empty),
            'program': data.get('program', serializers.empty),
            'year_of_study': data.get('year_of_study', serializers.empty),
        }
        self._validate_scope_references(profile_data, User.ROLE_USER)
        return data

    @transaction.atomic
    def create(self, validated_data):
        profile_data = self._extract_profile_data(validated_data)
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        email = validated_data.pop('email')

        try:
            user = User.objects.create_user(email=email, password=password, **validated_data)
            self._sync_profiles(user, profile_data, user.role)
            user.refresh_from_db()
            return user
        except IntegrityError as exc:
            message = str(exc)
            if 'accounts_user_username' in message:
                raise serializers.ValidationError({'username': 'This username is already in use.'})
            if 'accounts_user_email' in message:
                raise serializers.ValidationError({'email': 'This email is already in use.'})
            if 'accounts_user_gmail_account' in message:
                raise serializers.ValidationError({'gmail_account': 'This Gmail account is already in use.'})
            if 'accounts_student_student_id' in message:
                raise serializers.ValidationError({'student_id': 'This student ID is already in use.'})
            if 'accounts_student_campus_id' in message:
                raise serializers.ValidationError({'campus_id': 'This campus ID is already in use.'})
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
