from rest_framework.routers import DefaultRouter
from .views import UserViewSet, SystemViewSet, MicrosoftAuthViewSet, TokenViewSet, CampusViewSet, CollegeViewSet, DepartmentViewSet

router = DefaultRouter()
router.register(r'accounts', UserViewSet, basename='accounts')
router.register(r'accounts/token', TokenViewSet, basename='token')
router.register(r'accounts/microsoft', MicrosoftAuthViewSet, basename='microsoft')
router.register(r'accounts/campuses', CampusViewSet, basename='campuses')
router.register(r'accounts/colleges', CollegeViewSet, basename='colleges')
router.register(r'accounts/departments', DepartmentViewSet, basename='departments')
router.register(r'system', SystemViewSet, basename='system')

urlpatterns = router.urls
