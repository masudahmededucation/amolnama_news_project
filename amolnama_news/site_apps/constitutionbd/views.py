"""Constitution BD views — landing + mastermind quiz consumer pages."""

from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie


def home(request):
    """Constitution BD landing page."""
    seo = {
        'title': 'সংবিধান — আমলনামা নিউজ | Constitution of Bangladesh',
        'description': 'বাংলাদেশের সংবিধান, অনুচ্ছেদ, সংশোধনী এবং আইনি ব্যাখ্যা।',
    }
    return render(request, 'constitutionbd/pages/constitutionbd-home.html', {
        'seo': seo,
        'active_sidebar_nav_id': 'constitutionbd',
    })


def quiz_list(request):
    """List published mastermind quizzes filed under topic 'bd_constitution'.

    Mastermind owns the quiz engine; constitutionbd is just a presentation surface.
    Adding a new constitution quiz = create one in the Quiz Panel with topic
    Bangladesh Constitution. No code change needed in this app.
    """
    from amolnama_news.site_apps.mastermind.models import CollQuiz, CollQuizTopic

    topic = CollQuizTopic.objects.filter(topic_code='bd_constitution', is_active=True).first()
    quizzes = []
    if topic is not None:
        quizzes = list(
            CollQuiz.objects.filter(
                link_mastermind_coll_quiz_topic_id=topic.mastermind_coll_quiz_topic_id,
                exam_status_code='published',
                is_active=True,
            ).order_by('-created_at').values(
                'mastermind_coll_quiz_id',
                'exam_title_bn', 'exam_title_en',
                'exam_description_bn',
                'exam_total_questions',
                'exam_time_limit_minutes',
                'exam_pass_percentage',
                'exam_proctoring_level',
            )
        )

    return render(request, 'constitutionbd/pages/constitutionbd-quiz-list.html', {
        'topic': topic,
        'quizzes': quizzes,
        'active_sidebar_nav_id': 'constitutionbd',
        'seo': {
            'title': 'সংবিধান কুইজ — আমলনামা নিউজ | Bangladesh Constitution Quiz',
            'description': 'বাংলাদেশের সংবিধান নিয়ে কুইজ — অনুচ্ছেদ, মৌলিক অধিকার, সংশোধনী।',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'সংবিধান', 'url': '/songbidhan/'},
                {'name': 'কুইজ', 'url': None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def quiz_take(request, quiz_id):
    """Render the mastermind take partial for one bd_constitution quiz.

    Quiz must (a) exist, (b) be published, (c) be filed under topic
    'bd_constitution' — we don't let an unrelated quiz slip through this URL.
    """
    from amolnama_news.site_apps.mastermind.models import CollQuiz, CollQuizTopic

    quiz = CollQuiz.objects.filter(
        mastermind_coll_quiz_id=quiz_id,
        exam_status_code='published',
        is_active=True,
    ).first()
    if not quiz:
        raise Http404

    topic = CollQuizTopic.objects.filter(topic_code='bd_constitution', is_active=True).first()
    if not topic or quiz.link_mastermind_coll_quiz_topic_id != topic.mastermind_coll_quiz_topic_id:
        raise Http404

    return render(request, 'constitutionbd/pages/constitutionbd-quiz-take.html', {
        'quiz': quiz,
        'active_sidebar_nav_id': 'constitutionbd',
        'seo': {
            'title': f'{quiz.exam_title_bn} — সংবিধান কুইজ',
            'description': quiz.exam_description_bn or quiz.exam_title_bn,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'সংবিধান', 'url': '/songbidhan/'},
                {'name': 'কুইজ', 'url': '/songbidhan/quiz/'},
                {'name': quiz.exam_title_bn, 'url': None},
            ],
        },
    })
