from django.shortcuts import render


def marriage(request):
    return render(request, "marriage/marriage.html", {
        'seo': {
            'title': 'বিবাহ — আমলনামা নিউজ | Marriage',
            'description': 'বিবাহ সংক্রান্ত তথ্য ও সেবা। Marriage information and services.',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'বিবাহ', 'url': None},
            ],
        },
    })


def marriage_form(request):
    return render(request, "marriage/marriage-form.html", {
        'seo': {
            'title': 'বিবাহ ফর্ম — আমলনামা নিউজ | Marriage Form',
            'description': 'বিবাহ নিবন্ধনের জন্য ফর্ম পূরণ করুন। Fill out the marriage registration form.',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'বিবাহ', 'url': '/marriage/'},
                {'name': 'বিবাহ ফর্ম', 'url': None},
            ],
        },
    })


def register_marriage(request):
    return render(request, "marriage/marriage-form.html", {
        'seo': {
            'title': 'বিবাহ নিবন্ধন — আমলনামা নিউজ | Register Marriage',
            'description': 'বিবাহ নিবন্ধন করুন। Register your marriage.',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'বিবাহ', 'url': '/marriage/'},
                {'name': 'বিবাহ নিবন্ধন', 'url': None},
            ],
        },
    })


def marriage_certificate(request):
    return render(request, "marriage/marriage-certificate.html", {
        'seo': {
            'title': 'বিবাহ সনদ — আমলনামা নিউজ | Marriage Certificate',
            'description': 'বিবাহ সনদ দেখুন ও ডাউনলোড করুন। View and download your marriage certificate.',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'বিবাহ', 'url': '/marriage/'},
                {'name': 'বিবাহ সনদ', 'url': None},
            ],
        },
    })
