"""Sync User model with new DB schema.

Changes (all already applied in the DB):
- PK renamed: id → user_account_user_id (bigint identity)
- Added: link_user_auth_method_type_id (int NOT NULL)
- Added: user_auth_provider_key (nvarchar(255) NOT NULL)
- Renamed column: email → username_email (db_column)
- Renamed column: password → hash_password (db_column)
- Removed: phone column

This migration only updates Django's state.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('user_account', '0004_email_phone_refcontacttype_delete_contact_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                # Remove old implicit id PK, add explicit user_account_user_id PK
                migrations.RemoveField(
                    model_name='user',
                    name='id',
                ),
                migrations.AddField(
                    model_name='user',
                    name='user_account_user_id',
                    field=models.BigAutoField(primary_key=True, serialize=False),
                ),
                # Add auth method fields
                migrations.AddField(
                    model_name='user',
                    name='link_user_auth_method_type_id',
                    field=models.IntegerField(),
                ),
                migrations.AddField(
                    model_name='user',
                    name='user_auth_provider_key',
                    field=models.CharField(max_length=255),
                ),
                # Rename DB columns via db_column (Python names stay the same)
                migrations.AlterField(
                    model_name='user',
                    name='email',
                    field=models.EmailField(
                        db_column='username_email',
                        max_length=254,
                        unique=True,
                        verbose_name='email address',
                    ),
                ),
                migrations.AlterField(
                    model_name='user',
                    name='password',
                    field=models.CharField(
                        db_column='hash_password',
                        max_length=128,
                    ),
                ),
                # Remove phone field
                migrations.RemoveField(
                    model_name='user',
                    name='phone',
                ),
            ],
            database_operations=[],
        ),
    ]
