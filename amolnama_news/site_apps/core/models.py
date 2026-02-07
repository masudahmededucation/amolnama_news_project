from django.db import models

class MediaAppAsset(models.Model):
    app_asset_id = models.AutoField(primary_key=True)
    asset_key = models.CharField(max_length=100, blank=True, null=True)  # <-- added asset_key
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    alt_text_en = models.CharField(max_length=255, blank=True, null=True)
    alt_text_bn = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'media.app_asset'
        managed = False  # Set to True if you want Django to manage the table

    def __str__(self):
        return self.file_name
    
    
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
        managed = True  # Changed to True so Django can create the table
        
    def __str__(self):
        return self.title