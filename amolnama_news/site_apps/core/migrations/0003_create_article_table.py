# Migration to create article table in article schema

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_alter_mediaappasset_table'),
    ]

    operations = [
        migrations.RunSQL(
            sql="IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'article') EXEC sp_executesql N'CREATE SCHEMA [article]';",
            reverse_sql="",
        ),
        migrations.RunSQL(
            sql="IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'article' AND t.name = 'article') CREATE TABLE [article].[article] (id bigint PRIMARY KEY IDENTITY(1,1), slug nvarchar(50) NOT NULL UNIQUE, title nvarchar(200) NOT NULL, section nvarchar(100) NULL, author nvarchar(100) NULL, published_at datetime2 NOT NULL, read_time int NULL, hero_image nvarchar(100) NULL, hero_image_alt nvarchar(200) NULL, hero_caption nvarchar(500) NULL, body nvarchar(max) NOT NULL);",
            reverse_sql="",
        ),
    ]
