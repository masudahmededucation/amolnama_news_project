from django.db import models


class Article(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=200)
    section = models.CharField(max_length=100, blank=True, null=True)
    author = models.CharField(max_length=100, blank=True, null=True)
    published_at = models.DateTimeField()
    read_time = models.IntegerField(blank=True, null=True)  # in minutes
    hero_image = models.ImageField(upload_to='articles/', blank=True, null=True)
    hero_image_alt = models.CharField(max_length=200, blank=True, null=True)
    hero_caption = models.CharField(max_length=500, blank=True, null=True)
    body = models.TextField()
    
    class Meta:
        db_table = '[article].[article]'
        managed = False  # Changed to True so Django can create the table
        
    def __str__(self):
        return self.title