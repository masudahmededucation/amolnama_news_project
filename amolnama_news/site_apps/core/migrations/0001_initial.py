# Generated migration to create article schema and tables

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.RunSQL(
            sql="IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'article') CREATE SCHEMA [article];",
            reverse_sql="DROP SCHEMA [article];",
        ),
        migrations.CreateModel(
            name='MediaAppAsset',
            fields=[
                ('app_asset_id', models.AutoField(primary_key=True, serialize=False)),
                ('asset_key', models.CharField(blank=True, max_length=100, null=True)),
                ('file_name', models.CharField(max_length=255)),
                ('file_path', models.CharField(max_length=500)),
                ('alt_text_en', models.CharField(blank=True, max_length=255, null=True)),
                ('alt_text_bn', models.CharField(blank=True, max_length=255, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'app_asset',
                'managed': False,
            },
        ),
        migrations.CreateModel(
            name='Article',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(unique=True)),
                ('title', models.CharField(max_length=200)),
                ('section', models.CharField(blank=True, max_length=100, null=True)),
                ('author', models.CharField(blank=True, max_length=100, null=True)),
                ('published_at', models.DateTimeField()),
                ('read_time', models.IntegerField(blank=True, null=True)),
                ('hero_image', models.ImageField(blank=True, null=True, upload_to='articles/')),
                ('hero_image_alt', models.CharField(blank=True, max_length=200, null=True)),
                ('hero_caption', models.CharField(blank=True, max_length=500, null=True)),
                ('body', models.TextField()),
            ],
            options={
                'db_table': '[article].[article]',
                'managed': True,
            },
        ),
    ]
