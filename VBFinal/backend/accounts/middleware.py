import threading

_local = threading.local()

SKIP_PATHS = ['/swagger/', '/redoc/', '/static/', '/admin/jsi18n/']


class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Skip non-API and static paths
        if not request.path.startswith('/api/') or any(request.path.startswith(p) for p in SKIP_PATHS):
            return response

        # Skip token refresh noise
        if 'token/refresh' in request.path or 'token/verify' in request.path:
            return response

        try:
            from .models import SystemLog

            user = None
            if hasattr(request, 'user') and request.user and request.user.is_authenticated:
                user = request.user.email

            ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
            if ',' in ip:
                ip = ip.split(',')[0].strip()

            status = response.status_code
            level = 'SUCCESS' if status < 400 else ('WARN' if status < 500 else 'ERROR')

            method = request.method
            path = request.path

            # Derive category from path
            if 'accounts' in path:
                category = 'AUTH'
            elif 'complaints' in path:
                category = 'COMPLAINT'
            elif 'campuses' in path or 'colleges' in path or 'departments' in path:
                category = 'INSTITUTION'
            elif 'contact' in path:
                category = 'CONTACT'
            elif 'feedback' in path:
                category = 'FEEDBACK'
            elif 'system' in path:
                category = 'SYSTEM'
            else:
                category = 'API'

            message = f"{method} {path} → {status}"

            SystemLog.objects.create(
                level=level,
                message=message,
                category=category,
                user=user,
                ip_address=ip or None,
                method=method,
                path=path,
                status_code=status,
            )
        except Exception:
            pass  # Never break the request

        return response
