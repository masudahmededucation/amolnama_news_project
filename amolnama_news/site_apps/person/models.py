from django.db import models
from django.utils import timezone


# ---------------------------------------------------------------------------
# Unmanaged models — [contact] schema (SQL Server is source of truth)
# ---------------------------------------------------------------------------


class ContactType(models.Model):
    """Maps to [contact].[contact_type]."""

    contact_type_id = models.IntegerField(primary_key=True)
    contact_type_code = models.CharField(max_length=100)
    contact_type_name_en = models.CharField(max_length=100)
    contact_type_name_bn = models.CharField(max_length=100, blank=True, null=True)
    contact_type_validation_regex = models.CharField(max_length=1000, blank=True, null=True)
    file_icon_path = models.CharField(max_length=1000, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[contact].[contact_type]'
        verbose_name = "Contact Type"
        verbose_name_plural = "Contact Types"

    def __str__(self):
        return self.contact_type_name_en


class EntityType(models.Model):
    """Maps to [contact].[entity_type]."""

    entity_type_id = models.IntegerField(primary_key=True)
    entity_type_code = models.CharField(max_length=200)
    entity_type_name_en = models.CharField(max_length=200)
    entity_type_name_bn = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[contact].[entity_type]'
        verbose_name = "Entity Type"
        verbose_name_plural = "Entity Types"

    def __str__(self):
        return self.entity_type_name_en


class RefSocialMediaPlatform(models.Model):
    """Maps to [contact].[ref_social_media_platform]."""

    platform_id = models.IntegerField(primary_key=True)
    platform_code = models.CharField(max_length=50)
    platform_name_en = models.CharField(max_length=100)
    platform_name_bn = models.CharField(max_length=100, blank=True, null=True)
    base_url = models.CharField(max_length=500, blank=True, null=True)
    file_icon_path = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[contact].[ref_social_media_platform]'
        verbose_name = "Social Media Platform"
        verbose_name_plural = "Social Media Platforms"

    def __str__(self):
        return self.platform_name_en


class SocialMedia(models.Model):
    """Maps to [contact].[social_media]."""

    social_media_id = models.IntegerField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_social_media_platform_id = models.IntegerField()
    url = models.CharField(max_length=1000)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[contact].[social_media]'
        verbose_name = "Social Media"
        verbose_name_plural = "Social Media"

    def __str__(self):
        return f"{self.link_person_id} — {self.url}"


# ---------------------------------------------------------------------------
# Unmanaged models — [career] schema (SQL Server is source of truth)
# ---------------------------------------------------------------------------


class JobCategory(models.Model):
    """Maps to [career].[job_category]."""

    job_category_id = models.IntegerField(primary_key=True)
    job_category_code = models.CharField(max_length=50, blank=True, null=True)
    job_category_name_en = models.CharField(max_length=200)
    job_category_name_bn = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[career].[job_category]'
        verbose_name = "Job Category"
        verbose_name_plural = "Job Categories"

    def __str__(self):
        return self.job_category_name_en


class JobDepartment(models.Model):
    """Maps to [career].[job_department]."""

    job_department_id = models.IntegerField(primary_key=True)
    department_name_en = models.CharField(max_length=200)
    department_name_bn = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[career].[job_department]'
        verbose_name = "Job Department"
        verbose_name_plural = "Job Departments"

    def __str__(self):
        return self.department_name_en


class JobTitle(models.Model):
    """Maps to [career].[job_title]."""

    job_title_id = models.IntegerField(primary_key=True)
    link_job_category_id = models.IntegerField(blank=True, null=True)
    job_title_code_en = models.CharField(max_length=50, blank=True, null=True)
    job_title_code_bn = models.CharField(max_length=50, blank=True, null=True)
    job_title_name_en = models.CharField(max_length=200)
    job_title_name_bn = models.CharField(max_length=200, blank=True, null=True)
    notes = models.CharField(max_length=100, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[career].[job_title]'
        verbose_name = "Job Title"
        verbose_name_plural = "Job Titles"

    def __str__(self):
        return self.job_title_name_en


# ---------------------------------------------------------------------------
# Unmanaged models — [education] schema (SQL Server is source of truth)
# ---------------------------------------------------------------------------


class QualificationType(models.Model):
    """Maps to [education].[qualification_type]."""

    qualification_type_id = models.IntegerField(primary_key=True)
    education_qualification_type_code = models.CharField(max_length=50, blank=True, null=True)
    education_qualification_type_en = models.CharField(max_length=100, blank=True, null=True)
    education_qualification_type_bn = models.CharField(max_length=100, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()

    class Meta:
        managed = False
        db_table = '[education].[qualification_type]'
        verbose_name = "Qualification Type"
        verbose_name_plural = "Qualification Types"

    def __str__(self):
        return self.education_qualification_type_en or f"QualificationType({self.qualification_type_id})"


class Qualification(models.Model):
    """Maps to [education].[qualification]."""

    qualification_id = models.IntegerField(primary_key=True)
    link_qualification_type_id = models.IntegerField(blank=True, null=True)
    education_qualification_title_code_en = models.CharField(max_length=50, blank=True, null=True)
    education_qualification_title_code_bn = models.CharField(max_length=50, blank=True, null=True)
    education_qualification_title_en = models.CharField(max_length=100, blank=True, null=True)
    education_qualification_title_bn = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField()

    class Meta:
        managed = False
        db_table = '[education].[qualification]'
        verbose_name = "Qualification"
        verbose_name_plural = "Qualifications"

    def __str__(self):
        return self.education_qualification_title_en or f"Qualification({self.qualification_id})"


# ---------------------------------------------------------------------------
# Unmanaged models — [person] schema (new tables — SQL Server is source of truth)
# ---------------------------------------------------------------------------


class RefTitle(models.Model):
    """Maps to [person].[ref_title]."""

    title_id = models.IntegerField(primary_key=True)
    title_code = models.CharField(max_length=20)
    title_name_en = models.CharField(max_length=100)
    title_name_bn = models.CharField(max_length=100)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[ref_title]'
        verbose_name = "Title"
        verbose_name_plural = "Titles"

    def __str__(self):
        return self.title_name_en



class RefCitizenshipCategory(models.Model):
    """Maps to [person].[ref_citizenship_category]."""

    citizenship_category_id = models.IntegerField(primary_key=True)
    citizenship_category_title_en = models.CharField(max_length=100)
    citizenship_category_title_bn = models.CharField(max_length=100)
    citizenship_category_description_en = models.CharField(max_length=200, blank=True, null=True)
    citizenship_category_description_bn = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[ref_citizenship_category]'
        verbose_name = "Citizenship Category"
        verbose_name_plural = "Citizenship Categories"

    def __str__(self):
        return self.citizenship_category_title_en


class RefCitizenshipStatus(models.Model):
    """Maps to [person].[ref_citizenship_status]."""

    citizenship_status_id = models.IntegerField(primary_key=True)
    citizenship_status_title_en = models.CharField(max_length=100)
    citizenship_status_title_bn = models.CharField(max_length=100)
    citizenship_status_description_en = models.CharField(max_length=200, blank=True, null=True)
    citizenship_status_description_bn = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[ref_citizenship_status]'
        verbose_name = "Citizenship Status"
        verbose_name_plural = "Citizenship Statuses"

    def __str__(self):
        return self.citizenship_status_title_en


class RefHousingTenure(models.Model):
    """Maps to [person].[ref_housing_tenure]."""

    housing_tenure_id = models.IntegerField(primary_key=True)
    housing_tenure_code = models.CharField(max_length=50)
    housing_tenure_name_en = models.CharField(max_length=100)
    housing_tenure_name_bn = models.CharField(max_length=100)
    housing_tenure_description_en = models.CharField(max_length=500, blank=True, null=True)
    housing_tenure_description_bn = models.CharField(max_length=500, blank=True, null=True)
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[ref_housing_tenure]'
        verbose_name = "Housing Tenure"
        verbose_name_plural = "Housing Tenures"

    def __str__(self):
        return self.housing_tenure_name_en


class RefResidenceStatus(models.Model):
    """Maps to [person].[ref_residence_status]."""

    residence_status_id = models.IntegerField(primary_key=True)
    residence_status_title_en = models.CharField(max_length=100)
    residence_status_title_bn = models.CharField(max_length=100)
    residence_status_description_en = models.CharField(max_length=200, blank=True, null=True)
    residence_status_description_bn = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[ref_residence_status]'
        verbose_name = "Residence Status"
        verbose_name_plural = "Residence Statuses"

    def __str__(self):
        return self.residence_status_title_en


class PersonCitizenship(models.Model):
    """Maps to [person].[person_citizenship]."""

    person_citizenship_id = models.BigAutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_citizenship_id = models.IntegerField()
    valid_from = models.DateField()
    valid_to = models.DateField(blank=True, null=True)
    is_primary = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[person_citizenship]'
        verbose_name = "Person Citizenship"
        verbose_name_plural = "Person Citizenships"

    def __str__(self):
        return f"PersonCitizenship({self.person_citizenship_id})"


class PersonCitizenshipCategory(models.Model):
    """Maps to [person].[person_citizenship_category]."""

    person_citizenship_category_id = models.BigAutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_citizenship_category_id = models.IntegerField()
    valid_from = models.DateField()
    valid_to = models.DateField(blank=True, null=True)
    is_primary = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[person_citizenship_category]'
        verbose_name = "Person Citizenship Category"
        verbose_name_plural = "Person Citizenship Categories"

    def __str__(self):
        return f"PersonCitizenshipCategory({self.person_citizenship_category_id})"


class PersonCitizenshipStatus(models.Model):
    """Maps to [person].[person_citizenship_status]."""

    person_citizenship_status_id = models.BigAutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_citizenship_status_id = models.IntegerField()
    valid_from = models.DateField()
    valid_to = models.DateField(blank=True, null=True)
    is_primary = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[person_citizenship_status]'
        verbose_name = "Person Citizenship Status"
        verbose_name_plural = "Person Citizenship Statuses"

    def __str__(self):
        return f"PersonCitizenshipStatus({self.person_citizenship_status_id})"


class PersonEducation(models.Model):
    """Maps to [person].[person_education]."""

    person_education_id = models.BigAutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_qualification_id = models.IntegerField()
    result_en = models.CharField(max_length=100, blank=True, null=True)
    major_subject_en = models.CharField(max_length=100, blank=True, null=True)
    education_start_date = models.DateField(blank=True, null=True)
    education_end_date = models.DateField(blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_primary_asset = models.BooleanField()
    is_highest_qualification = models.BooleanField()
    is_active = models.BooleanField()

    class Meta:
        managed = False
        db_table = '[person].[person_education]'
        verbose_name = "Person Education"
        verbose_name_plural = "Person Educations"

    def __str__(self):
        return f"PersonEducation({self.person_education_id})"


class PersonHousingTenure(models.Model):
    """Maps to [person].[person_housing_tenure]."""

    person_housing_tenure_id = models.BigAutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_housing_tenure_id = models.IntegerField()
    link_district_id = models.IntegerField(blank=True, null=True)
    valid_from = models.DateField()
    valid_to = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[person_housing_tenure]'
        verbose_name = "Person Housing Tenure"
        verbose_name_plural = "Person Housing Tenures"

    def __str__(self):
        return f"PersonHousingTenure({self.person_housing_tenure_id})"


class PersonJob(models.Model):
    """Maps to [person].[person_job]."""

    person_job_id = models.BigAutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_job_title_id = models.IntegerField()
    link_organisation_id = models.IntegerField()
    link_department_id = models.IntegerField(blank=True, null=True)
    notes = models.CharField(max_length=1000, blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[person_job]'
        verbose_name = "Person Job"
        verbose_name_plural = "Person Jobs"

    def __str__(self):
        return f"PersonJob({self.person_job_id})"


class PersonMarriage(models.Model):
    """Maps to [person].[person_marriage]."""

    person_marriage_id = models.BigAutoField(primary_key=True)
    link_husband_person_id = models.BigIntegerField()
    link_wife_person_id = models.BigIntegerField()
    marriage_valid_from = models.DateField()
    marriage_marriage_valid_to = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[person_marriage]'
        verbose_name = "Person Marriage"
        verbose_name_plural = "Person Marriages"

    def __str__(self):
        return f"PersonMarriage({self.person_marriage_id})"


class PersonResidenceStatus(models.Model):
    """Maps to [person].[person_residence_status]."""

    person_residence_status_id = models.BigAutoField(primary_key=True)
    link_person_id = models.BigIntegerField()
    link_residence_status_id = models.IntegerField()
    valid_from = models.DateField()
    valid_to = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[person].[person_residence_status]'
        verbose_name = "Person Residence Status"
        verbose_name_plural = "Person Residence Statuses"

    def __str__(self):
        return f"PersonResidenceStatus({self.person_residence_status_id})"
