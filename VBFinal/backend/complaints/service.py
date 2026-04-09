from complaints.models import Category, ResolverLevel, CategoryResolver, Assignment
import logging

logger = logging.getLogger(__name__)


class ComplaintService:

    def assign_to_first_level_officer(self, complaint):
        try:
            if not complaint.category:
                return None

            first_level = ResolverLevel.objects.filter(level_order=1).first()

            if not first_level:
                return None

            category_resolver = CategoryResolver.objects.filter(
                category=complaint.category,
                level=first_level,
                active=True
            ).select_related('officer').order_by('id')

            matched_resolver = None
            for resolver in category_resolver:
                if complaint.category.matches_officer(resolver.officer):
                    matched_resolver = resolver
                    break

            if matched_resolver:
                complaint.assigned_officer = matched_resolver.officer
                complaint.current_level = first_level
                complaint.set_escalation_deadline(matched_resolver.escalation_time, base_time=complaint.created_at)
                complaint.save()

                Assignment.objects.create(
                    complaint=complaint,
                    officer=matched_resolver.officer,
                    level=first_level,
                    reason='initial'
                )

                return matched_resolver.officer

            return None
        except Exception as e:
            logger.error(f"Assignment failed: {e}")
            return None

    def process_complaint(self, complaint):
        try:
            complaint.save()
            assigned_officer = self.assign_to_first_level_officer(complaint)
            return {
                'category': complaint.category,
                'assigned_officer': assigned_officer,
            }
        except Exception as e:
            logger.error(f"Complaint processing failed: {e}")
            return None


service = ComplaintService()
