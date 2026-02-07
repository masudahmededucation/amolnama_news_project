import os
import django
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'amolnama_news.settings.dev')
django.setup()

from amolnama_news.site_apps.core.models import Article

# Sample articles
articles_data = [
    {
        'slug': 'riverside-renewal-plan',
        'title': 'Riverside Renewal Plan Transforms Waterfront',
        'section': 'Urban Development',
        'author': 'Jane Smith',
        'published_at': datetime.now() - timedelta(days=2),
        'read_time': 5,
        'hero_image_alt': 'Riverside development project',
        'hero_caption': 'New waterfront development bringing community spaces and green areas',
        'body': '<p>The city unveiled an ambitious riverside renewal plan that promises to transform the aging waterfront into a vibrant community hub. The project includes new parks, walking trails, and mixed-use developments.</p><p>Key features of the plan include:</p><ul><li>20 acres of new green space</li><li>Restored historic buildings</li><li>Modern apartment and retail developments</li><li>Public waterfront access</li></ul><p>Local officials expect the project to be completed over the next five years, creating thousands of jobs and boosting property values in the area.</p>'
    },
    {
        'slug': 'street-food',
        'title': 'Five Dishes Redefining Street Food',
        'section': 'Food & Culture',
        'author': 'Marcus Johnson',
        'published_at': datetime.now() - timedelta(days=5),
        'read_time': 7,
        'hero_image_alt': 'Street food vendors',
        'hero_caption': 'Creative street food chefs are innovating traditional recipes',
        'body': '<p>Street food vendors across the city are pushing culinary boundaries with innovative takes on traditional dishes. From fusion tacos to gourmet dumplings, these five establishments are worth the visit.</p><p>Featured vendors:</p><ol><li>Taco Revolution - Korean-Mexican fusion</li><li>Golden Dumpling - Handmade in-house daily</li><li>Spice Route - Indian street food reimagined</li><li>Banh My Modern - Vietnamese with a twist</li><li>Dessert Truck Dreams - Artisanal pastries</li></ol>'
    },
    {
        'slug': 'tech-startup-boom',
        'title': 'Tech Startup Boom Creates Innovation Hub',
        'section': 'Technology',
        'author': 'David Chen',
        'published_at': datetime.now() - timedelta(days=1),
        'read_time': 6,
        'hero_image_alt': 'Tech startup office',
        'hero_caption': 'New innovation district attracts tech entrepreneurs',
        'body': '<p>The city has emerged as an unexpected hotspot for tech startups, with venture capital investment reaching record levels this quarter.</p><p>Recent developments include:</p><ul><li>$500M in venture funding announced</li><li>30 new startups founded this quarter</li><li>Co-working spaces exceeding capacity</li><li>Tech talent relocating from Silicon Valley</li></ul>'
    }
]

# Clear existing articles
Article.objects.all().delete()
print("Cleared existing articles")

# Create articles
for data in articles_data:
    article = Article.objects.create(**data)
    print(f"Created: {article.title}")

print("\nSample articles created successfully!")
