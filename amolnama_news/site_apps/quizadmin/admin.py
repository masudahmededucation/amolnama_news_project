"""Quiz Panel — staff-only Django Admin dashboard for triaging AI-generated questions.

Keeps the mastermind engine headless (no display logic) by hosting review UI here.
Registers the unmanaged CollQuestion model with confidence badges and bulk actions.
"""

from django.contrib import admin
from django.utils.html import format_html

from amolnama_news.site_apps.mastermind.models import CollQuestion


@admin.register(CollQuestion)
class CollQuestionReviewAdmin(admin.ModelAdmin):
    """Visual triage of AI-generated questions via NLI confidence scores."""

    list_display = (
        'mastermind_coll_question_id',
        'question_preview',
        'confidence_badge',
        'similarity_display',
        'entailment_display',
        'question_status_code',
        'question_generation_source_code',
        'created_at',
    )
    list_filter = (
        'question_status_code',
        'question_generation_source_code',
        'nli_verdict_code',
        'nli_confidence_level_code',
        'link_mastermind_coll_quiz_topic_id',
    )
    search_fields = (
        'question_text_bn',
        'question_text_en',
        'question_explanation_bn',
        'source_snippet_text',
    )
    ordering = ('-created_at',)
    list_per_page = 50
    actions = ('approve_questions', 'reject_questions', 'move_to_draft')

    readonly_fields = (
        'mastermind_coll_question_id',
        'question_generation_source_code',
        'nli_verdict_code',
        'nli_confidence_level_code',
        'nli_similarity_score',
        'nli_entailment_score',
        'nli_contradiction_score',
        'source_snippet_text',
        'link_mastermind_coll_book_id',
        'link_mastermind_coll_book_chapter_id',
        'source_page_number',
        'created_at',
        'updated_at',
    )

    fieldsets = (
        ('Question', {
            'fields': (
                'mastermind_coll_question_id',
                'question_text_bn',
                'question_text_en',
                'question_explanation_bn',
                'question_status_code',
                'question_points',
            ),
        }),
        ('NLI Confidence (AI-generated only)', {
            'fields': (
                'nli_verdict_code',
                'nli_confidence_level_code',
                'nli_similarity_score',
                'nli_entailment_score',
                'nli_contradiction_score',
            ),
        }),
        ('Source Citation', {
            'fields': (
                'link_mastermind_coll_book_id',
                'link_mastermind_coll_book_chapter_id',
                'source_page_number',
                'source_snippet_text',
            ),
        }),
        ('Metadata', {
            'fields': (
                'question_generation_source_code',
                'link_mastermind_coll_quiz_topic_id',
                'link_mastermind_ref_quiz_question_type_id',
                'link_mastermind_ref_quiz_difficulty_level_id',
                'is_active',
                'created_at',
                'updated_at',
            ),
            'classes': ('collapse',),
        }),
    )

    # --- Display helpers ---

    @admin.display(description='Question (preview)')
    def question_preview(self, obj):
        text = obj.question_text_bn or ''
        return text[:100] + ('…' if len(text) > 100 else '')

    @admin.display(description='Confidence')
    def confidence_badge(self, obj):
        """Traffic-light badge based on NLI verdict + confidence level."""
        verdict_code = obj.nli_verdict_code or ''
        confidence = obj.nli_confidence_level_code or ''
        is_pass = verdict_code.startswith('pass_')

        if is_pass and confidence == 'high':
            color, label = '#22c55e', 'HIGH'
        elif is_pass and confidence == 'medium':
            color, label = '#f59e0b', 'MED'
        elif is_pass and confidence == 'low':
            color, label = '#facc15', 'LOW'
        elif is_pass:
            color, label = '#6b7280', 'PASS'
        elif verdict_code:
            color, label = '#ef4444', 'REJECT'
        else:
            color, label = '#d1d5db', '—'

        return format_html(
            '<span style="background:{};color:white;padding:3px 10px;border-radius:12px;'
            'font-weight:700;font-size:11px;">{}</span>',
            color, label,
        )

    @admin.display(description='Similarity')
    def similarity_display(self, obj):
        return self._format_decimal(obj.nli_similarity_score)

    @admin.display(description='Entailment')
    def entailment_display(self, obj):
        return self._format_decimal(obj.nli_entailment_score)

    @staticmethod
    def _format_decimal(value):
        if value is None:
            return '—'
        return f'{float(value):.3f}'

    # --- Bulk actions ---

    @admin.action(description='Approve & publish selected questions')
    def approve_questions(self, request, queryset):
        """Move AI-generated questions from review to published."""
        updated = queryset.filter(
            question_status_code='review',
        ).update(
            question_status_code='published',
            question_generation_source_code='ai_reviewed',
        )
        self.message_user(request, f'Approved and published {updated} question(s).')

    @admin.action(description='Reject (archive) selected questions')
    def reject_questions(self, request, queryset):
        """Archive instead of delete (audit trail)."""
        updated = queryset.update(
            question_status_code='archived',
            is_active=False,
        )
        self.message_user(request, f'Archived {updated} question(s).')

    @admin.action(description='Move back to draft')
    def move_to_draft(self, request, queryset):
        updated = queryset.update(question_status_code='draft')
        self.message_user(request, f'Moved {updated} question(s) back to draft.')
