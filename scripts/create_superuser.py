import os, django, traceback
os.environ.setdefault('DJANGO_SETTINGS_MODULE','amolnama_news.settings.local')

try:
    django.setup()
    from django.contrib.auth import get_user_model
    User = get_user_model()
    email='admin@example.com'
    password='Password123!'
    if User.objects.filter(email=email).exists():
        print('Superuser already exists:', email)
    else:
        User.objects.create_superuser(email=email, password=password)
        print('Created superuser:', email)
except Exception:
    print('ERROR creating superuser:')
    traceback.print_exc()
