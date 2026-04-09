import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, '.env'))


def env_bool(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {'1', 'true', 'yes', 'on'}


def env_list(name, default=None):
    raw = os.getenv(name)
    if raw is None:
        return list(default or [])
    return [item.strip() for item in raw.split(',') if item.strip()]


DEBUG = env_bool('DEBUG', False)
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-me' if DEBUG else None)
if not SECRET_KEY:
    raise ValueError('SECRET_KEY environment variable is required when DEBUG is false.')

try:
    import channels  # noqa: F401
    CHANNELS_AVAILABLE = True
except ImportError:
    CHANNELS_AVAILABLE = False

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://127.0.0.1:8000')

default_allowed_hosts = ['localhost', '127.0.0.1']
default_cors_origins = [FRONTEND_URL] if FRONTEND_URL else ['http://localhost:5173']

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', default_allowed_hosts)
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', default_cors_origins)
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', default_cors_origins)

if DEBUG:
    for host in ['localhost', '127.0.0.1']:
        if host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(host)
    for origin in ['http://127.0.0.1:5173', 'http://localhost:5173']:
        if origin not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(origin)
        if origin not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(origin)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'accounts.apps.AccountsConfig',
    'complaints',
    'feedback',
    'contact',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_yasg',
    'corsheaders',
    'social_django',
    "helpdesk",
]

if CHANNELS_AVAILABLE:
    staticfiles_index = INSTALLED_APPS.index('django.contrib.staticfiles')
    INSTALLED_APPS.insert(staticfiles_index, 'daphne')
    INSTALLED_APPS.append('channels')

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'accounts.middleware.RequestLogMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_EXPOSE_HEADERS = ['content-type', 'x-csrftoken']
CORS_PREFLIGHT_MAX_AGE = 86400

SWAGGER_SETTINGS = {
    'DEFAULT_API_URL': BACKEND_URL,
}

ROOT_URLCONF = 'conf.urls'
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'social_django.context_processors.backends',
                'social_django.context_processors.login_redirect',
            ],
        },
    },
]

WSGI_APPLICATION = 'conf.wsgi.application'
ASGI_APPLICATION = 'conf.asgi.application'



# DATABASES = {
#     'default': dj_database_url.config(
#         default=os.getenv('DATABASE_URL'),
#         conn_max_age=600,
#         ssl_require=True
#     )
# }

DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE'),
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'cmfs-cache',
    }
}

if CHANNELS_AVAILABLE:
    redis_url = os.getenv('REDIS_URL', '').strip()
    try:
        import channels_redis  # noqa: F401

        if redis_url:
            CHANNEL_LAYERS = {
                'default': {
                    'BACKEND': 'channels_redis.core.RedisChannelLayer',
                    'CONFIG': {
                        'hosts': [redis_url],
                    },
                }
            }
        else:
            CHANNEL_LAYERS = {
                'default': {
                    'BACKEND': 'channels.layers.InMemoryChannelLayer',
                }
            }
    except ImportError:
        CHANNEL_LAYERS = {
            'default': {
                'BACKEND': 'channels.layers.InMemoryChannelLayer',
            }
        }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

AUTH_USER_MODEL = 'accounts.User'
AUTHENTICATION_BACKENDS = (
    'social_core.backends.azuread.AzureADOAuth2',
    'accounts.backends.EmailOrUsernameModelBackend',
    'django.contrib.auth.backends.ModelBackend',
)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)

if DEBUG and not EMAIL_HOST_USER:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

JWT_SESSION_TIMEOUT_MINUTES = 600
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=JWT_SESSION_TIMEOUT_MINUTES),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

SOCIAL_AUTH_AZUREAD_OAUTH2_KEY = os.getenv('MICROSOFT_CLIENT_ID', '')
SOCIAL_AUTH_AZUREAD_OAUTH2_SECRET = os.getenv('MICROSOFT_CLIENT_SECRET', '')
SOCIAL_AUTH_AZUREAD_OAUTH2_TENANT_ID = os.getenv('MICROSOFT_TENANT_ID', 'common')

SOCIAL_AUTH_PIPELINE = (
    'social_core.pipeline.social_auth.social_details',
    'social_core.pipeline.social_auth.social_uid',
    'social_core.pipeline.social_auth.auth_allowed',
    'social_core.pipeline.social_auth.social_user',
    'accounts.pipeline.associate_existing_user_by_email',
    'social_core.pipeline.user.get_username',
    'social_core.pipeline.user.create_user',
    'social_core.pipeline.social_auth.associate_user',
    'social_core.pipeline.social_auth.load_extra_data',
    'social_core.pipeline.user.user_details',
    'accounts.pipeline.generate_jwt_token',
)
frontend_base_url = FRONTEND_URL.rstrip('/')
SOCIAL_AUTH_URL_NAMESPACE = os.getenv('SOCIAL_AUTH_URL_NAMESPACE', 'social')
SOCIAL_AUTH_LOGIN_REDIRECT_URL = os.getenv('SOCIAL_AUTH_LOGIN_REDIRECT_URL', f'{frontend_base_url}/auth/success')
SOCIAL_AUTH_NEW_USER_REDIRECT_URL = os.getenv('SOCIAL_AUTH_NEW_USER_REDIRECT_URL', f'{frontend_base_url}/register/complete')
SOCIAL_AUTH_LOGIN_ERROR_URL = os.getenv('SOCIAL_AUTH_LOGIN_ERROR_URL', f'{frontend_base_url}/auth/error')
