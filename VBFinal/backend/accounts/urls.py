from rest_framework.routers import DefaultRouter
from .views import (
	CampusViewSet,
	CollegeViewSet,
	DepartmentViewSet,
	MicrosoftAuthViewSet,
	OfficerViewSet,
	StudentTypeViewSet,
	StudentViewSet,
	SystemLogViewSet,
	SystemViewSet,
	TokenViewSet,
	UserViewSet,
)

router = DefaultRouter()
router.register(r'accounts', UserViewSet, basename='accounts')
router.register(r'accounts/token', TokenViewSet, basename='token')
router.register(r'accounts/microsoft', MicrosoftAuthViewSet, basename='microsoft')
router.register(r'campuses', CampusViewSet, basename='campuses')
router.register(r'colleges', CollegeViewSet, basename='colleges')
router.register(r'departments', DepartmentViewSet, basename='departments')
router.register(r'student-types', StudentTypeViewSet, basename='student-types')
router.register(r'students', StudentViewSet, basename='students')
router.register(r'officers', OfficerViewSet, basename='officers')
router.register(r'system', SystemViewSet, basename='system')
router.register(r'system-logs', SystemLogViewSet, basename='system-logs')

urlpatterns = router.urls
