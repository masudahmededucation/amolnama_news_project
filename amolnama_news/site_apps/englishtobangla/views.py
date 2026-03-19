from django.shortcuts import render


def englishtobangla(request):
    context = {
        "seo": {
            "title": "ইংরেজি থেকে বাংলা — আমলনামা নিউজ | English to Bangla",
            "description": (
                "ইংরেজিতে টাইপ করুন, বাংলায় রূপান্তর হবে — অভ্র ফোনেটিক। "
                "Type in English, get Bengali — Avro Phonetic transliteration."
            ),
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "ইংরেজি থেকে বাংলা", "url": "/englishtobangla/"},
            ],
        },
    }
    return render(request, "englishtobangla/pages/englishtobangla.html", context)
