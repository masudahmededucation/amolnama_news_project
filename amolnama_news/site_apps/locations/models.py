from django.db import connection, models


class Division(models.Model):
    """বিভাগ - Administrative divisions"""
    division_id = models.IntegerField(primary_key=True)
    link_country_id = models.IntegerField(blank=True, null=True)
    division_name_en = models.CharField(max_length=200, blank=True, null=True)
    old_division_name_en = models.CharField(max_length=200, blank=True, null=True)
    division_name_bn = models.CharField(max_length=200, blank=True, null=True)
    division_code = models.CharField(max_length=20, blank=True, null=True)
    division_iso_number = models.IntegerField(blank=True, null=True)
    division_iso_code = models.CharField(max_length=20, blank=True, null=True)
    division_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    division_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    total_population = models.IntegerField(blank=True, null=True)
    website = models.CharField(max_length=200, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False  # CRITICAL: Django will NOT modify this table
        db_table = '[location].[division]'

    def __str__(self):
        return self.division_name_en or f"Division {self.division_id}"


class District(models.Model):
    """জেলা - Districts within divisions"""
    district_id = models.IntegerField(primary_key=True)
    link_division_id = models.IntegerField(blank=True, null=True)
    division_name_en = models.CharField(max_length=100, blank=True, null=True)
    district_name_en = models.CharField(max_length=100, blank=True, null=True)
    old_district_name_en = models.CharField(max_length=100, blank=True, null=True)
    district_name_bn = models.CharField(max_length=100, blank=True, null=True)
    district_code = models.CharField(max_length=20, blank=True, null=True)
    district_iso_number = models.CharField(max_length=20, blank=True, null=True)
    district_iso_code = models.CharField(max_length=20, blank=True, null=True)
    district_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    district_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    total_population = models.IntegerField(blank=True, null=True)
    website = models.CharField(max_length=200, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False  # CRITICAL: Django will NOT modify this table
        db_table = '[location].[district]'

    def __str__(self):
        return self.district_name_en or f"District {self.district_id}"

    @property
    def division(self):
        """Get related division"""
        if self.link_division_id:
            return Division.objects.filter(division_id=self.link_division_id).first()
        return None


class Constituency(models.Model):
    """নির্বাচনী এলাকা - Parliamentary constituencies"""
    constituency_id = models.IntegerField(primary_key=True)
    link_division_id = models.IntegerField(blank=True, null=True)
    link_district_id = models.IntegerField(blank=True, null=True)
    division_name_en = models.CharField(max_length=100, blank=True, null=True)
    district_name_en = models.CharField(max_length=100, blank=True, null=True)
    seat_number_en = models.CharField(max_length=100, blank=True, null=True)
    seat_number_bn = models.CharField(max_length=100, blank=True, null=True)
    constituency_name_en = models.CharField(max_length=100, blank=True, null=True)
    constituency_name_bn = models.CharField(max_length=100, blank=True, null=True)
    constituency_area_list_en = models.CharField(max_length=200, blank=True, null=True)
    constituency_area_list_bn = models.CharField(max_length=200, blank=True, null=True)
    constituency_code = models.CharField(max_length=100, blank=True, null=True)
    constituency_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    constituency_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    total_population = models.IntegerField(blank=True, null=True)
    total_eligible_voter = models.IntegerField(blank=True, null=True)
    website = models.CharField(max_length=200, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False  # CRITICAL: Django will NOT modify this table
        db_table = '[location].[constituency]'

    def __str__(self):
        return self.constituency_name_en or f"Constituency {self.constituency_id}"

    @property
    def division(self):
        """Get related division"""
        if self.link_division_id:
            return Division.objects.filter(division_id=self.link_division_id).first()
        return None

    @property
    def district(self):
        """Get related district"""
        if self.link_district_id:
            return District.objects.filter(district_id=self.link_district_id).first()
        return None


class Upazila(models.Model):
    """উপজেলা - Sub-districts"""
    upazila_id = models.IntegerField(primary_key=True)
    link_district_id = models.IntegerField(blank=True, null=True)
    district_name_en = models.CharField(max_length=100, blank=True, null=True)
    upazila_name_en = models.CharField(max_length=100, blank=True, null=True)
    old_upazila_name_en = models.CharField(max_length=100, blank=True, null=True)
    upazila_name_bn = models.CharField(max_length=100, blank=True, null=True)
    link_location_type_id = models.IntegerField(blank=True, null=True)
    location_type = models.CharField(max_length=100, blank=True, null=True)
    upazila_code = models.CharField(max_length=100, blank=True, null=True)
    upazila_iso_number = models.CharField(max_length=20, blank=True, null=True)
    upazila_iso_code = models.CharField(max_length=20, blank=True, null=True)
    upazila_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    upazila_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    total_population = models.IntegerField(blank=True, null=True)
    website = models.CharField(max_length=200, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False  # CRITICAL: Django will NOT modify this table
        db_table = '[location].[upazila]'

    def __str__(self):
        return self.upazila_name_en or f"Upazila {self.upazila_id}"

    @property
    def district(self):
        """Get related district"""
        if self.link_district_id:
            return District.objects.filter(district_id=self.link_district_id).first()
        return None


class UnionParishad(models.Model):
    """ইউনিয়ন পরিষদ - Local government units"""
    union_parishad_id = models.IntegerField(primary_key=True)
    link_upazila_id = models.IntegerField(blank=True, null=True)
    union_parishad_name_en = models.CharField(max_length=200, blank=True, null=True)
    union_parishad_name_bn = models.CharField(max_length=200, blank=True, null=True)
    link_location_type_id = models.IntegerField(blank=True, null=True)
    location_type = models.CharField(max_length=100, blank=True, null=True)
    union_parishad_code = models.CharField(max_length=200, blank=True, null=True)
    union_parishad_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    union_parishad_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    total_population = models.IntegerField(blank=True, null=True)
    website = models.CharField(max_length=200, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False  # CRITICAL: Django will NOT modify this table
        db_table = '[location].[union_parishad]'

    def __str__(self):
        return self.union_parishad_name_en or f"Union Parishad {self.union_parishad_id}"

    @property
    def upazila(self):
        """Get related upazila"""
        if self.link_upazila_id:
            return Upazila.objects.filter(upazila_id=self.link_upazila_id).first()
        return None


class MetropolitanThana(models.Model):
    """মহানগর থানা - Metropolitan police stations within city corporation areas"""
    metropolitan_thana_id = models.IntegerField(primary_key=True)
    link_district_id = models.IntegerField(blank=True, null=True)
    link_location_type_id = models.IntegerField(blank=True, null=True)
    location_type = models.CharField(max_length=100, blank=True, null=True)
    district_name_en = models.CharField(max_length=100, blank=True, null=True)
    metropolitan_thana_name_en = models.CharField(max_length=100, blank=True, null=True)
    old_metropolitan_thana_name_en = models.CharField(max_length=100, blank=True, null=True)
    metropolitan_thana_name_bn = models.CharField(max_length=100, blank=True, null=True)
    metropolitan_thana_code = models.CharField(max_length=100, blank=True, null=True)
    metropolitan_thana_iso_number = models.CharField(max_length=20, blank=True, null=True)
    metropolitan_thana_iso_code = models.CharField(max_length=20, blank=True, null=True)
    metropolitan_thana_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    metropolitan_thana_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    total_population = models.IntegerField(blank=True, null=True)
    website = models.CharField(max_length=200, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[location].[metropolitan_thana]'

    def __str__(self):
        return self.metropolitan_thana_name_en or f"Metropolitan Thana {self.metropolitan_thana_id}"


class MetropolitanThanaWard(models.Model):
    """মহানগর থানা ↔ সিটি কর্পোরেশন ওয়ার্ড junction"""
    metropolitan_thana_ward_id = models.IntegerField(primary_key=True)
    metropolitan_thana_id = models.IntegerField()
    city_corporation_ward_id = models.IntegerField()
    is_primary_thana = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[location].[metropolitan_thana_ward]'

    def __str__(self):
        return f"ThanaWard({self.metropolitan_thana_id}->{self.city_corporation_ward_id})"


class CityCorporation(models.Model):
    """সিটি কর্পোরেশন - City corporations"""
    city_corporation_id = models.IntegerField(primary_key=True)
    link_district_id = models.IntegerField()
    link_location_type_id = models.IntegerField(blank=True, null=True)
    city_corporation_code_en = models.CharField(max_length=50, blank=True, null=True)
    city_corporation_name_en = models.CharField(max_length=100)
    city_corporation_name_bn = models.CharField(max_length=200)
    city_corporation_bbs_code = models.CharField(max_length=10, blank=True, null=True)
    city_corporation_geo_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    city_corporation_geo_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    location_type = models.CharField(max_length=100, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_population = models.IntegerField(blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    website = models.CharField(max_length=300, blank=True, null=True)
    notes = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[location].[city_corporation]'

    def __str__(self):
        return self.city_corporation_name_en or f"City Corporation {self.city_corporation_id}"


class CityCorporationWard(models.Model):
    """সিটি কর্পোরেশন ওয়ার্ড"""
    city_corporation_ward_id = models.IntegerField(primary_key=True)
    link_district_id = models.IntegerField(blank=True, null=True)
    link_city_corporation_id = models.IntegerField()
    link_location_type_id = models.IntegerField(blank=True, null=True)
    city_corporation_ward_number = models.IntegerField()
    city_corporation_ward_name_en = models.CharField(max_length=100, blank=True, null=True)
    city_corporation_ward_name_bn = models.CharField(max_length=200, blank=True, null=True)
    city_corporation_ward_bbs_code = models.CharField(max_length=10, blank=True, null=True)
    city_corporation_ward_geo_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    city_corporation_ward_geo_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    city_corporation_ward_area_square_km = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    location_type = models.CharField(max_length=50, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_population = models.BigIntegerField(blank=True, null=True)
    website = models.CharField(max_length=300, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[location].[city_corporation_ward]'

    def __str__(self):
        return self.city_corporation_ward_name_en or f"City Corp Ward {self.city_corporation_ward_number}"


class Municipality(models.Model):
    """পৌরসভা - Municipalities under upazilas"""
    municipality_id = models.IntegerField(primary_key=True)
    link_upazila_id = models.IntegerField(blank=True, null=True)
    link_district_id = models.IntegerField(blank=True, null=True)
    link_location_type_id = models.IntegerField(blank=True, null=True)
    location_type = models.CharField(max_length=50, blank=True, null=True)
    municipality_name_en = models.CharField(max_length=100)
    municipality_name_bn = models.CharField(max_length=200)
    municipality_bbs_code = models.CharField(max_length=10, blank=True, null=True)
    municipality_class = models.CharField(max_length=5, blank=True, null=True)
    municipality_geo_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    municipality_geo_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_population = models.BigIntegerField(blank=True, null=True)
    website = models.CharField(max_length=300, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[location].[municipality]'

    def __str__(self):
        return self.municipality_name_en or f"Municipality {self.municipality_id}"


class MunicipalityWard(models.Model):
    """পৌরসভা ওয়ার্ড"""
    municipality_ward_id = models.IntegerField(primary_key=True)
    link_municipality_id = models.IntegerField()
    link_district_id = models.IntegerField(blank=True, null=True)
    link_upazila_id = models.IntegerField(blank=True, null=True)
    link_location_type_id = models.IntegerField(blank=True, null=True)
    municipality_ward_number = models.IntegerField()
    municipality_ward_name_en = models.CharField(max_length=100, blank=True, null=True)
    municipality_ward_name_bn = models.CharField(max_length=200, blank=True, null=True)
    municipality_ward_bbs_code = models.CharField(max_length=10, blank=True, null=True)
    municipality_ward_geo_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    municipality_ward_geo_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    location_type = models.CharField(max_length=50, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_population = models.BigIntegerField(blank=True, null=True)
    website = models.CharField(max_length=300, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[location].[municipality_ward]'

    def __str__(self):
        return self.municipality_ward_name_en or f"Municipality Ward {self.municipality_ward_number}"


class UnionParishadWard(models.Model):
    """ইউনিয়ন পরিষদ ওয়ার্ড"""
    union_parishad_ward_id = models.IntegerField(primary_key=True)
    link_union_parishad_id = models.IntegerField()
    link_district_id = models.IntegerField(blank=True, null=True)
    link_upazila_id = models.IntegerField(blank=True, null=True)
    link_location_type_id = models.IntegerField(blank=True, null=True)
    location_type = models.CharField(max_length=50, blank=True, null=True)
    union_parishad_ward_number = models.IntegerField()
    union_parishad_ward_name_en = models.CharField(max_length=100, blank=True, null=True)
    union_parishad_ward_name_bn = models.CharField(max_length=200, blank=True, null=True)
    union_parishad_ward_bbs_code = models.CharField(max_length=10, blank=True, null=True)
    union_parishad_ward_geo_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    union_parishad_ward_geo_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_population = models.BigIntegerField(blank=True, null=True)
    website = models.CharField(max_length=300, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[location].[union_parishad_ward]'

    def __str__(self):
        return self.union_parishad_ward_name_en or f"UP Ward {self.union_parishad_ward_number}"


class UnionParishadVillage(models.Model):
    """ইউনিয়ন পরিষদ গ্রাম"""
    union_parishad_village_id = models.IntegerField(primary_key=True)
    link_union_parishad_id = models.IntegerField()
    link_district_id = models.IntegerField(blank=True, null=True)
    link_upazila_id = models.IntegerField(blank=True, null=True)
    link_location_type_id = models.IntegerField(blank=True, null=True)
    location_type = models.CharField(max_length=50, blank=True, null=True)
    union_parishad_village_name_en = models.CharField(max_length=100, blank=True, null=True)
    union_parishad_village_name_bn = models.CharField(max_length=200, blank=True, null=True)
    union_parishad_village_bbs_code = models.CharField(max_length=10, blank=True, null=True)
    union_parishad_village_geo_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    union_parishad_village_geo_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    area_square_kilometer = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_population = models.BigIntegerField(blank=True, null=True)
    website = models.CharField(max_length=300, blank=True, null=True)
    established_at = models.DateField(blank=True, null=True)
    notes = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[location].[union_parishad_village]'

    def __str__(self):
        return self.union_parishad_village_name_en or f"Village {self.union_parishad_village_id}"


class UnifiedLocationSearch(models.Model):
    """Read-only model mapped to [location].[app_vw_unified_location_search] view.
    Underlying data lives in [location].[unified_location_search] table.
    Used for Tom Select location search across all administrative levels."""
    unified_location_search_id = models.IntegerField(primary_key=True)
    link_location_id = models.IntegerField()
    link_location_table = models.CharField(max_length=200)
    link_location_type_id = models.IntegerField(blank=True, null=True)
    location_type = models.CharField(max_length=50, blank=True, null=True)
    unified_location_search_name_en = models.CharField(max_length=100, blank=True, null=True)
    unified_location_search_name_bn = models.CharField(max_length=100, blank=True, null=True)
    unified_location_display_title_en = models.CharField(max_length=500)
    unified_location_display_title_bn = models.CharField(max_length=500)
    unified_location_relationship_path = models.CharField(max_length=200)
    notes = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[location].[app_vw_unified_location_search]'

    def __str__(self):
        return self.unified_location_display_title_en or f"Location {self.unified_location_search_id}"


class Address(models.Model):
    """Maps to [location].[address]. Managed by SQL Server."""
    address_id = models.AutoField(primary_key=True)
    link_address_type_id = models.IntegerField(default=1)
    link_country_id = models.IntegerField(default=18)
    address_line_one = models.CharField(max_length=255)
    address_line_two = models.CharField(max_length=255, blank=True, null=True)
    local_area_name = models.CharField(max_length=100, blank=True, null=True)
    city_town = models.CharField(max_length=100)
    region_province_state_division = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    link_union_parishad_id = models.IntegerField(blank=True, null=True)
    link_ward_id = models.IntegerField(blank=True, null=True)
    link_village_id = models.IntegerField(blank=True, null=True)
    address_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    address_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    notes = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_by = models.IntegerField(blank=True, null=True)
    updated_by = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[location].[address]'

    def __str__(self):
        parts = filter(None, [self.address_line_one, self.address_line_two])
        return ", ".join(parts) or f"Address({self.address_id})"


class GeoSource(models.Model):
    geo_source_id = models.AutoField(primary_key=True)
    country_name_en = models.CharField(max_length=100, blank=True, null=True)
    region_name_en = models.CharField(max_length=100, blank=True, null=True)
    city_name_en = models.CharField(max_length=100, blank=True, null=True)
    network_isp_name = models.CharField(max_length=200, blank=True, null=True)
    network_type = models.CharField(max_length=50, blank=True, null=True)
    geo_source_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    geo_source_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[location].[geo_source]'
        
        

def get_or_create_geo_source(
    country_name_en,
    region_name_en,
    city_name_en,
    network_isp_name,
    network_type,
    latitude=None,
    longitude=None
):
    print("Geo proc params:", country_name_en, region_name_en, city_name_en, network_isp_name, network_type, latitude, longitude)
    with connection.cursor() as cursor:
        cursor.execute("""
            DECLARE @geo_source_id INT;
            EXEC [location].[app_usp_GetOrCreateGeoSource]
                @country_name_en=%s,
                @region_name_en=%s,
                @city_name_en=%s,
                @network_isp_name=%s,
                @network_type=%s,
                @latitude=%s,
                @longitude=%s,
                @geo_source_id=@geo_source_id OUTPUT;
            SELECT @geo_source_id;
        """, [
            country_name_en,
            region_name_en,
            city_name_en,
            network_isp_name,
            network_type,
            latitude,
            longitude
        ])
        row = cursor.fetchone()
        return row[0] if row else None