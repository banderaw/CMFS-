from django.apps import AppConfig


class ComplaintsConfig(AppConfig):
    name = 'complaints'

    def ready(self):
        import complaints.signals  # noqa: F401
