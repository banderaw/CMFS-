from django.urls import path

from complaints.consumers import AnalyticsConsumer, ComplaintThreadConsumer, NotificationConsumer
from helpdesk.consumers import HelpdeskSessionConsumer

websocket_urlpatterns = [
    path('ws/complaints/<uuid:complaint_id>/', ComplaintThreadConsumer.as_asgi()),
    path('ws/notifications/', NotificationConsumer.as_asgi()),
    path('ws/analytics/', AnalyticsConsumer.as_asgi()),
    path('ws/helpdesk/<uuid:session_id>/', HelpdeskSessionConsumer.as_asgi()),
]
