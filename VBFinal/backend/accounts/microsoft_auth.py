from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.shortcuts import redirect
from django.http import JsonResponse
from urllib.parse import urlencode
import requests
import os

User = get_user_model()


def _build_microsoft_redirect_uri(request):
    explicit_redirect_uri = os.getenv('MICROSOFT_REDIRECT_URI', '').strip()
    if explicit_redirect_uri:
        return explicit_redirect_uri

    backend_url = os.getenv('BACKEND_URL', '').strip()
    if backend_url:
        return f"{backend_url.rstrip('/')}/api/accounts/microsoft/callback/"

    return request.build_absolute_uri('/api/accounts/microsoft/callback/')


@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_config_test(request):
    """Test endpoint to verify Microsoft OAuth configuration"""
    client_id = os.getenv('MICROSOFT_CLIENT_ID', '')
    tenant_id = os.getenv('MICROSOFT_TENANT_ID', '')
    
    return JsonResponse({
        'client_id_configured': bool(client_id),
        'client_id_length': len(client_id) if client_id else 0,
        'tenant_id_configured': bool(tenant_id),
        'client_id_preview': client_id[:8] + '...' if client_id else 'NOT SET'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_login(request):
    """Redirect user to Microsoft login page"""
    client_id = os.getenv('MICROSOFT_CLIENT_ID', '')
    tenant_id = os.getenv('MICROSOFT_TENANT_ID', 'common')
    
    redirect_uri = _build_microsoft_redirect_uri(request)
    
    # Debug: Check if client_id is loaded
    if not client_id:
        return JsonResponse({
            'error': 'MICROSOFT_CLIENT_ID not configured',
            'message': 'Please check backend/.env file',
            'env_check': {
                'client_id': bool(client_id),
                'tenant_id': bool(tenant_id)
            }
        }, status=500)
    
    params = {
        'client_id': client_id,
        'response_type': 'code',
        'redirect_uri': redirect_uri,
        'response_mode': 'query',
        'scope': 'openid profile email User.Read',
    }
    
    auth_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize?{urlencode(params)}'
    return redirect(auth_url)


@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_callback(request):
    """Handle Microsoft OAuth callback"""
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    code = request.GET.get('code')
    error = request.GET.get('error')
    
    if error:
        return redirect(f'{frontend_url}/login?error={error}')
    
    if not code:
        return redirect(f'{frontend_url}/login?error=no_code')
    
    try:
        # Exchange code for access token
        client_id = os.getenv('MICROSOFT_CLIENT_ID', '')
        client_secret = os.getenv('MICROSOFT_CLIENT_SECRET', '')
        tenant_id = os.getenv('MICROSOFT_TENANT_ID', 'common')
        
        redirect_uri = _build_microsoft_redirect_uri(request)
        
        token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
        token_data = {
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
        }
        
        token_response = requests.post(token_url, data=token_data)
        
        if token_response.status_code != 200:
            return redirect(f'{frontend_url}/login?error=token_exchange_failed')
        
        access_token = token_response.json().get('access_token')
        
        # Get user info from Microsoft Graph API
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get('https://graph.microsoft.com/v1.0/me', headers=headers)
        
        if user_response.status_code != 200:
            return redirect(f'{frontend_url}/login?error=user_info_failed')
        
        user_info = user_response.json()
        email = (user_info.get('mail') or user_info.get('userPrincipalName') or '').strip().lower()
        microsoft_id = user_info.get('id')
        first_name = user_info.get('givenName', '')
        last_name = user_info.get('surname', '')
        
        if not email:
            return redirect(f'{frontend_url}/login?error=no_email')
        
        # Check if user exists by Microsoft ID first, then by case-insensitive email.
        user = None
        if microsoft_id:
            user = User.objects.filter(microsoft_id=microsoft_id).first()

        if not user:
            user = User.objects.filter(email__iexact=email).first()

        if user:
            is_new = False
            update_fields = []

            if microsoft_id and not user.microsoft_id:
                user.microsoft_id = microsoft_id
                update_fields.append('microsoft_id')

            if user.auth_provider == User.AUTH_LOCAL:
                user.auth_provider = User.AUTH_MICROSOFT
                update_fields.append('auth_provider')

            if not user.is_email_verified:
                user.is_email_verified = True
                update_fields.append('is_email_verified')

            if first_name and not user.first_name:
                user.first_name = first_name
                update_fields.append('first_name')

            if last_name and not user.last_name:
                user.last_name = last_name
                update_fields.append('last_name')

            if update_fields:
                user.save(update_fields=update_fields)
        else:
            # Create new user with unique username.
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            
            # Ensure unique username
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
            
            try:
                user = User.objects.create_user(
                    email=email,
                    password=None,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    microsoft_id=microsoft_id,
                    auth_provider=User.AUTH_MICROSOFT,
                    is_email_verified=True,
                    role=User.ROLE_USER,
                )
                is_new = True
            except (ValidationError, IntegrityError):
                user = User.objects.filter(email__iexact=email).first()
                if not user:
                    raise
                is_new = False
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        # Redirect based on whether user is new
        if is_new:
            params = {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'is_new': 'true'
            }
            return redirect(f'{frontend_url}/register/complete?{urlencode(params)}')
        else:
            params = {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
            return redirect(f'{frontend_url}/auth/success?{urlencode(params)}')
        
    except Exception as e:
        # Log the error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Microsoft auth error: {str(e)}")
        return redirect(f'{frontend_url}/login?error=auth_failed&detail={str(e)[:50]}')
