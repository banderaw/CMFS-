from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Campus, College, Department, SystemLog


class SystemLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemLog
        fields = ['id', 'level', 'message', 'category', 'user', 'ip_address',
                  'method', 'path', 'status_code', 'created_at']


class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = ["id", "campus_name", "location", "description", "is_active", "created_at"]
        read_only_fields = ["created_at"]


class CollegeSerializer(serializers.ModelSerializer):
    campus_name = serializers.CharField(source='college_campus.campus_name', read_only=True)

    class Meta:
        model = College
        fields = ["id", "college_name", "college_code", "college_campus", "campus_name",
                  "dean", "description", "is_active", "created_at"]
        read_only_fields = ["campus_name", "created_at"]


class DepartmentSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='department_college.college_name', read_only=True)

    class Meta:
        model = Department
        fields = ["id", "department_name", "department_code", "department_college", "college_name",
                  "head", "description", "is_active", "created_at"]
        read_only_fields = ["college_name", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=False, min_length=8)
    user_campus_detail = CampusSerializer(source='user_campus', read_only=True)
    college_detail = CollegeSerializer(source='college', read_only=True)
    department_detail = DepartmentSerializer(source='department', read_only=True)
    
    class Meta:
        model = User
        fields = [
            "id", "email", "username", "first_name", "last_name",
            "user_campus", "college", "department",
            "user_campus_detail", "college_detail", "department_detail",
            "phone", "role", "campus_id",
            "is_active", "is_email_verified", "password", "confirm_password", "auth_provider"
        ]
        extra_kwargs = {
            "is_email_verified": {"read_only": True},
            "id": {"read_only": True},
            "auth_provider": {"read_only": True},
            "user_campus_detail": {"read_only": True},
            "college_detail": {"read_only": True},
            "department_detail": {"read_only": True}
        }
    
    def validate(self, data):
        if 'password' in data or 'confirm_password' in data:
            password = data.get('password')
            confirm_password = data.get('confirm_password')
            
            if password != confirm_password:
                raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        
        return data
    
    def create(self, validated_data):
        confirm_password = validated_data.pop('confirm_password', None)
        password = validated_data.pop('password', None)
        
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        
        return user
    
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
        identifier = data.get("identifier")
        password = data.get("password")

        user = authenticate(username=identifier, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials")
        if not user.is_active:
            raise serializers.ValidationError("User account is disabled")

        data["user"] = user
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "first_name",
            "last_name",
            "user_campus",
            "college",
            "department",
            "campus_id",
            "phone",
            "password",
            "confirm_password",
        ]

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")

        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user
