from rest_framework.routers import DefaultRouter
from .views import UserViewSet, SystemViewSet, MicrosoftAuthViewSet, TokenViewSet

router = DefaultRouter()
router.register(r'accounts', UserViewSet, basename='accounts')
router.register(r'accounts/token', TokenViewSet, basename='token')
router.register(r'accounts/microsoft', MicrosoftAuthViewSet, basename='microsoft')
router.register(r'system', SystemViewSet, basename='system')

urlpatterns = router.urls
