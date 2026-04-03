"""Text Extractor models — mapped to [textextractor].* SQL Server tables."""

from django.db import models


class ConfigFolderWatcher(models.Model):
    textextractor_config_folder_watcher_id = models.AutoField(primary_key=True)
    watcher_name = models.CharField(max_length=100)
    input_folder_path = models.CharField(max_length=500)
    output_folder_path = models.CharField(max_length=500)
    supported_extensions = models.CharField(max_length=500)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[textextractor].[config_folder_watcher]'

    def __str__(self):
        return self.watcher_name


class RefExtractionEngine(models.Model):
    textextractor_ref_extraction_engine_id = models.AutoField(primary_key=True)
    engine_code = models.CharField(max_length=50)
    engine_name_en = models.CharField(max_length=200)
    engine_name_bn = models.CharField(max_length=200)
    supported_input_types = models.CharField(max_length=500, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[textextractor].[ref_extraction_engine]'

    def __str__(self):
        return self.engine_name_en


class RefDocumentType(models.Model):
    textextractor_ref_document_type_id = models.AutoField(primary_key=True)
    document_type_code = models.CharField(max_length=50)
    document_type_name_en = models.CharField(max_length=200)
    document_type_name_bn = models.CharField(max_length=200)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[textextractor].[ref_document_type]'

    def __str__(self):
        return self.document_type_name_en


class CollExtractionJob(models.Model):
    textextractor_coll_extraction_job_id = models.BigAutoField(primary_key=True)
    job_guid = models.UUIDField()
    link_user_profile_id = models.BigIntegerField(blank=True, null=True)
    link_extraction_engine_id = models.IntegerField(blank=True, null=True)
    link_document_type_id = models.IntegerField(blank=True, null=True)
    link_folder_watcher_id = models.IntegerField(blank=True, null=True)
    source_type_code = models.CharField(max_length=20)
    original_file_name = models.CharField(max_length=500)
    original_file_extension_code = models.CharField(max_length=20)
    original_file_size_bytes = models.BigIntegerField(blank=True, null=True)
    input_file_path = models.CharField(max_length=1000, blank=True, null=True)
    output_file_path = models.CharField(max_length=1000, blank=True, null=True)
    input_language_code = models.CharField(max_length=10, blank=True, null=True)
    detected_language_code = models.CharField(max_length=10, blank=True, null=True)
    status_code = models.CharField(max_length=20)
    extracted_text_plain = models.TextField(blank=True, null=True)
    extracted_text_json = models.TextField(blank=True, null=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=4, blank=True, null=True)
    word_count = models.IntegerField(blank=True, null=True)
    page_count = models.IntegerField(blank=True, null=True)
    processing_time_milliseconds = models.IntegerField(blank=True, null=True)
    error_message = models.CharField(max_length=2000, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[textextractor].[coll_extraction_job]'

    def __str__(self):
        return f'{self.original_file_name} ({self.status_code})'


class ExtractionPage(models.Model):
    textextractor_extraction_page_id = models.BigAutoField(primary_key=True)
    link_extraction_job_id = models.BigIntegerField()
    page_number = models.IntegerField()
    page_text_plain = models.TextField(blank=True, null=True)
    page_text_json = models.TextField(blank=True, null=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=4, blank=True, null=True)
    word_count = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[textextractor].[extraction_page]'


class ExtractionTable(models.Model):
    textextractor_extraction_table_id = models.BigAutoField(primary_key=True)
    link_extraction_job_id = models.BigIntegerField()
    link_extraction_page_id = models.BigIntegerField(blank=True, null=True)
    table_index = models.IntegerField()
    row_count = models.IntegerField()
    column_count = models.IntegerField()
    table_data_csv = models.TextField(blank=True, null=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=4, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[textextractor].[extraction_table]'


class ExtractionTableCell(models.Model):
    textextractor_extraction_table_cell_id = models.BigAutoField(primary_key=True)
    link_extraction_table_id = models.BigIntegerField()
    row_number = models.IntegerField()
    column_number = models.IntegerField()
    cell_text_plain = models.TextField(blank=True, null=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=4, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[textextractor].[extraction_table_cell]'
