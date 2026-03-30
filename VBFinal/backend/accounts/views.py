from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from django.db.models import Q
from datetime import timedelta
from .models import User, PasswordResetToken, EmailVerificationToken, Campus, College, Department, SystemLog
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    LoginSerializer,
    CampusSerializer,
    CollegeSerializer,
    DepartmentSerializer,
    SystemLogSerializer,
)
from .email_service import EmailService
from .utils import generate_password_reset_token, generate_email_verification_token


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('user_campus', 'college', 'department').all()
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

    def get_authenticators(self):
        # Public auth endpoints should not fail with 401 when stale Authorization
        # headers are present from the frontend token interceptor.
        # Check action from self.action (set after dispatch) or from request path
        action = getattr(self, 'action', None)
        
        # If action not set yet, try to detect from request path
        if not action and self.request:
            request_path = self.request.path.lower()
            public_paths = [
                'register', 'login', 'logout', 
                'request-password-reset', 'reset-password', 
                'verify-email', 'request_password_reset',
                'reset_password', 'verify_email'
            ]
            if any(path in request_path for path in public_paths):
                return []
        
        # If action is available, check it
        if action in [
            "register",
            "login",
            "logout",
            "request_password_reset",
            "reset_password",
            "verify_email",
        ]:
            return []
        return super().get_authenticators()

    def get_permissions(self):
        # Check request path as fallback when self.action not yet set
        action = getattr(self, 'action', None)
        if not action and self.request:
            request_path = self.request.path.lower()
            public_paths = [
                'register', 'login', 'logout',
                'request-password-reset', 'reset-password',
                'verify-email', 'request_password_reset',
                'reset_password', 'verify_email'
            ]
            if any(path in request_path for path in public_paths):
                return [permissions.AllowAny()]
        
        if action in ["register", "login", "logout", "request_password_reset", "reset_password", "verify_email"]:
            return [permissions.AllowAny()]
        if action in ["me", "logout"]:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]  # For development 
        

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        # Log the login session
        try:
            ip_address = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
            if ',' in ip_address:
                ip_address = ip_address.split(',')[0].strip()
            
            SystemLog.objects.create(
                level='SUCCESS',
                message=f"User {user.email} logged in",
                category='AUTH',
                user=user.email,
                ip_address=ip_address or None,
                method='POST',
                path='/api/accounts/login/',
                status_code=200,
            )
        except Exception as e:
            pass  # Don't break login if logging fails

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
        email = (
            request.data.get("email")
            or request.data.get("identifier")
            or request.data.get("gmail_account")
        )

        if not email:
            return Response({"error": "Email required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(Q(email__iexact=email) | Q(gmail_account__iexact=email))
            token = generate_password_reset_token(user)
            EmailService.send_password_reset_email(user, token)
            return Response({"message": "Password reset email sent"}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "No email address found in the system."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=["post"], url_path="reset-password")
    def reset_password(self, request):
        token_str = request.data.get("token", "").strip()
        new_password = request.data.get("password")
        
        if not token_str or not new_password:
            return Response(
                {"error": "Token and password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            token = PasswordResetToken.objects.get(token=token_str)
            if not token.is_valid():
                return Response(
                    {"error": "Reset link has expired or has already been used. Please request a new password reset."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            token.user.set_password(new_password)
            token.user.save()
            token.user.mark_password_as_local_auth()
            token.is_used = True
            token.save()
            
            return Response(
                {"message": "Password reset successfully. You can now log in with your new password."},
                status=status.HTTP_200_OK
            )
        except PasswordResetToken.DoesNotExist:
            return Response(
                {"error": "Invalid reset link. This link may not exist or has expired. Please request a new password reset."},
                status=status.HTTP_400_BAD_REQUEST
            )

class SystemViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        from conf.system_monitor import get_system_stats
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

    @action(detail=False, methods=['get'], url_path='active-sessions', permission_classes=[permissions.IsAdminUser])
    def active_sessions(self, request):
        """Get list of active user sessions with IP addresses from recent log entries"""
        try:
            from django.utils import timezone
            
            # Get sessions from last 24 hours (more reliable than 1 hour)
            lookback_time = timezone.now() - timedelta(hours=24)
            
            # Get all auth-related logs (login, API calls from authenticated users)
            recent_logs = SystemLog.objects.filter(
                created_at__gte=lookback_time,
                user__isnull=False,
            ).exclude(
                user=''
            ).exclude(
                ip_address__isnull=True
            ).order_by('-created_at')
            
            # Group by user email and get latest activity per IP
            user_sessions = {}
            for log in recent_logs:
                if log.user:
                    # Create a unique key for each user-IP combination
                    key = f"{log.user}_{log.ip_address}"
                    if key not in user_sessions:
                        # Get user object to fetch full info
                        try:
                            user_obj = User.objects.get(email=log.user)
                            user_sessions[key] = {
                                'id': user_obj.id,
                                'email': user_obj.email,
                                'first_name': user_obj.first_name or 'Unknown',
                                'last_name': user_obj.last_name or 'User',
                                'role': user_obj.role,
                                'ip_address': log.ip_address,
                                'last_activity': log.created_at.isoformat(),
                                'method': log.method,
                                'path': log.path,
                                'status_code': log.status_code
                            }
                        except User.DoesNotExist:
                            user_sessions[key] = {
                                'email': log.user,
                                'first_name': 'Unknown',
                                'last_name': 'User',
                                'role': 'user',
                                'ip_address': log.ip_address,
                                'last_activity': log.created_at.isoformat(),
                                'method': log.method,
                                'path': log.path,
                                'status_code': log.status_code
                            }
            
            # Sort by most recent activity
            sessions = sorted(
                list(user_sessions.values()),
                key=lambda x: x['last_activity'],
                reverse=True
            )
            
            return Response({
                'count': len(sessions),
                'results': sessions
            }, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'count': 0,
                'results': [],
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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


class CampusViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.order_by('id')
    serializer_class = CampusSerializer
    permission_classes = [permissions.AllowAny]


class CollegeViewSet(viewsets.ModelViewSet):
    serializer_class = CollegeSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        campus_id = self.request.query_params.get('campus')
        qs = College.objects.order_by('id')
        if campus_id:
            qs = qs.filter(college_campus_id=campus_id)
        return qs


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        college_id = self.request.query_params.get('college')
        qs = Department.objects.order_by('id')
        if college_id:
            qs = qs.filter(department_college_id=college_id)
        return qs


class SystemLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SystemLogSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = SystemLog.objects.all()
        level = self.request.query_params.get('level')
        category = self.request.query_params.get('category')
        limit = self.request.query_params.get('limit', 100)
        if level:
            qs = qs.filter(level=level.upper())
        if category:
            qs = qs.filter(category=category.upper())
        return qs[:int(limit)]

    @action(detail=False, methods=['delete'], url_path='clear', permission_classes=[permissions.IsAdminUser])
    def clear(self, request):
        SystemLog.objects.all().delete()
        return Response({'message': 'Logs cleared.'})
