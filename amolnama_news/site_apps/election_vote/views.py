from django.shortcuts import render


def home(request):
    return render(request, 'election_vote/pages/home.html')
