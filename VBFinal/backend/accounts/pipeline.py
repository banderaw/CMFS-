from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.shortcuts import redirect
from urllib.parse import urlencode


User = get_user_model()


def associate_existing_user_by_email(strategy, details, user=None, *args, **kwargs):
    """
    Associate Microsoft social auth with an existing account when emails match.
    """
    if user:
        return {'user': user, 'is_new': False}

    email = (details.get('email') or '').strip().lower()
    if not email:
        return None

    existing_user = User.objects.filter(email__iexact=email).first()
    if not existing_user:
        return None

    update_fields = []
    uid = kwargs.get('uid')
    backend_name = getattr(kwargs.get('backend'), 'name', '')

    if backend_name == 'azuread-oauth2' and uid and not existing_user.microsoft_id:
        existing_user.microsoft_id = uid
        update_fields.append('microsoft_id')

    if existing_user.auth_provider == User.AUTH_LOCAL and backend_name == 'azuread-oauth2':
        existing_user.auth_provider = User.AUTH_MICROSOFT
        update_fields.append('auth_provider')

    if not existing_user.is_email_verified:
        existing_user.is_email_verified = True
        update_fields.append('is_email_verified')

    if update_fields:
        existing_user.save(update_fields=update_fields)

    return {'user': existing_user, 'is_new': False}


def generate_jwt_token(strategy, details, user=None, *args, **kwargs):
    """
    Generate JWT tokens after successful Microsoft authentication
    and redirect to frontend with tokens
    """
    if not user:
        return None

    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    is_new = kwargs.get('is_new', False)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')

    redirect_path = '/register/complete' if is_new else '/auth/success'
    redirect_url = f"{frontend_url}{redirect_path}"

    params = {
        'access': access_token,
        'refresh': refresh_token,
        'user_id': user.id,
        'email': user.email,
        'is_new': str(is_new).lower(),
    }

    return redirect(f"{redirect_url}?{urlencode(params)}")
