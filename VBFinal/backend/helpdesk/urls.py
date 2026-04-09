from rest_framework.routers import DefaultRouter

from .views import HelpdeskMessageViewSet, HelpdeskSessionViewSet

router = DefaultRouter()
router.register(r'sessions', HelpdeskSessionViewSet, basename='helpdesk-session')
router.register(r'messages', HelpdeskMessageViewSet, basename='helpdesk-message')

urlpatterns = router.urls