from django.contrib import admin
from .models import (
    RefEvaluation,
    RefQuestionCategory,
    RefQuestion,
    RefQuestionOption,
    EvaluationResponse,
    EvaluationResult,
    UserDevice,
    UserProfile,
    UserSession,
    RefParty,  

)





@admin.register(RefEvaluation)
class RefEvaluationAdmin(admin.ModelAdmin):
    list_display = ['evaluation_id', 'evaluation_name_en', 'end_date', 'is_active']
    list_filter = ['is_active']
    search_fields = ['evaluation_name_en', 'evaluation_name_bn']


@admin.register(RefQuestionCategory)
class RefQuestionCategoryAdmin(admin.ModelAdmin):
    list_display = ['question_category_id', 'category_name_en', 'is_active']
    list_filter = ['is_active']


@admin.register(RefQuestion)
class RefQuestionAdmin(admin.ModelAdmin):
    list_display = ['question_id', 'question_no', 'question_text_en', 'is_active']
    list_filter = ['is_active']


@admin.register(RefQuestionOption)
class RefQuestionOptionAdmin(admin.ModelAdmin):
    list_display = ['question_option_id', 'question_option_text_en', 'answer_marks', 'is_active']
    list_filter = ['is_active']


@admin.register(EvaluationResponse)
class EvaluationResponseAdmin(admin.ModelAdmin):
    list_display = ['evaluation_response_id', 'link_evaluation_id', 'marks_awarded', 'created_at']
    list_filter = ['is_active']


@admin.register(EvaluationResult)
class EvaluationResultAdmin(admin.ModelAdmin):
    list_display = ['evaluation_result_id', 'total_score', 'result_status', 'is_active']
    list_filter = ['is_active', 'result_status']


@admin.register(UserDevice)
class UserDeviceAdmin(admin.ModelAdmin):
    list_display = ['user_device_id', 'app_platform_name', 'device_category', 'browser_name', 'is_blocked', 'first_seen_at']
    list_filter = ['is_blocked', 'app_platform_name', 'device_category']


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user_profile_id', 'display_name', 'is_blocked', 'created_at']
    list_filter = ['is_blocked']


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ['user_session_id', 'ip_address', 'is_blocked', 'started_at']
    list_filter = ['is_blocked', 'is_vpn_suspected']


#########################   party  #########################
@admin.register(RefParty)
class RefPartyAdmin(admin.ModelAdmin):
    list_display = ['party_id', 'party_name_en', 'party_short_name_en', 'is_active']
    list_filter = ['is_active']
    search_fields = ['party_name_en', 'party_name_bn']
