from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from .models import User, PasswordResetToken, EmailVerificationToken, Campus, College, Department
from .serialzers import RegisterSerializer, UserSerializer, LoginSerializer, CampusSerializer, CollegeSerializer, DepartmentSerializer
from .email_service import EmailService
from .utils import generate_password_reset_token, generate_email_verification_token
from conf.system_monitor import SystemMonitor

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def get_serializer_class(self):
        if self.action == "register":
            return RegisterSerializer
        if self.action == "login":
            return LoginSerializer
        if self.action == "me":
            return UserSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ["register", "login", "request_password_reset", "reset_password", "verify_email"]:
            return [permissions.AllowAny()]
        if self.action in ["me", "logout"]:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]  # For development 
        

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user, context={"request": request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="register")
    def register(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save() 
        token = generate_email_verification_token(user)
        EmailService.send_verification_email(user, token)
        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user, context={"request": request}).data,
            "message": "Verification email sent"
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="logout")
    def logout(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get", "put", "patch"], url_path="me")
    def me(self, request):
        if request.method == "GET":
            serializer = self.get_serializer(request.user, context={"request": request})
            return Response(serializer.data)

        elif request.method in ["PUT", "PATCH"]:
            serializer = self.get_serializer(request.user, data=request.data, partial=True, context={"request": request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="verify-email")
    def verify_email(self, request):
        token_str = request.data.get("token")
        if not token_str:
            return Response({"error": "Token required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            token = EmailVerificationToken.objects.get(token=token_str)
            if not token.is_valid():
                return Response({"error": "Token expired or already used"}, status=status.HTTP_400_BAD_REQUEST)
            
            token.user.is_email_verified = True
            token.user.save()
            token.is_used = True
            token.save()
            
            return Response({"message": "Email verified successfully"}, status=status.HTTP_200_OK)
        except EmailVerificationToken.DoesNotExist:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="request-password-reset")
    def request_password_reset(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"error": "Email required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
            token = generate_password_reset_token(user)
            EmailService.send_password_reset_email(user, token)
            return Response({"message": "Password reset email sent"}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"message": "Password reset email sent"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="reset-password")
    def reset_password(self, request):
        token_str = request.data.get("token")
        new_password = request.data.get("password")
        
        if not token_str or not new_password:
            return Response({"error": "Token and password required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            token = PasswordResetToken.objects.get(token=token_str)
            if not token.is_valid():
                return Response({"error": "Token expired or already used"}, status=status.HTTP_400_BAD_REQUEST)
            
            token.user.set_password(new_password)
            token.user.save()
            token.is_used = True
            token.save()
            
            return Response({"message": "Password reset successfully"}, status=status.HTTP_200_OK)
        except PasswordResetToken.DoesNotExist:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)


class SystemViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        from conf.system_monitor import get_system_stats
        from django.test import RequestFactory
        return get_system_stats(request._request)

    @action(detail=False, methods=['get'], url_path='alerts')
    def alerts(self, request):
        from conf.system_monitor import get_system_alerts
        return get_system_alerts(request._request)

    @action(detail=False, methods=['get', 'post'], url_path='jwt-session')
    def jwt_session(self, request):
        from conf.jwt_session import jwt_session_config
        return jwt_session_config(request._request)

    @action(detail=False, methods=['post'], url_path='token/check-expiry')
    def check_token_expiry(self, request):
        from conf.jwt_session import check_token_expiry
        return check_token_expiry(request._request)


class MicrosoftAuthViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'], url_path='login')
    def login(self, request):
        from .microsoft_auth import microsoft_login
        return microsoft_login(request._request)

    @action(detail=False, methods=['get'], url_path='callback')
    def callback(self, request):
        from .microsoft_auth import microsoft_callback
        return microsoft_callback(request._request)

    @action(detail=False, methods=['get'], url_path='test')
    def test(self, request):
        from .microsoft_auth import microsoft_config_test
        return microsoft_config_test(request._request)


class TokenViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'], url_path='refresh')
    def refresh(self, request):
        return TokenRefreshView.as_view()(request._request)

    @action(detail=False, methods=['post'], url_path='verify')
    def verify(self, request):
        return TokenVerifyView.as_view()(request._request)


class CampusViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Campus.objects.all()
    serializer_class = CampusSerializer
    permission_classes = [permissions.AllowAny]


class CollegeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CollegeSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        campus_id = self.request.query_params.get('campus')
        qs = College.objects.all()
        if campus_id:
            qs = qs.filter(college_campus_id=campus_id)
        return qs


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        college_id = self.request.query_params.get('college')
        qs = Department.objects.all()
        if college_id:
            qs = qs.filter(department_college_id=college_id)
        return qs
