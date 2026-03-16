from rest_framework.routers import DefaultRouter
from .views import FeedbackTemplateViewSet, FeedbackResponseViewSet

router = DefaultRouter()
router.register(r'feedback/templates', FeedbackTemplateViewSet, basename='feedback-template')
router.register(r'feedback/responses', FeedbackResponseViewSet, basename='feedback-response')

urlpatterns = router.urls
