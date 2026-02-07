from django.db import models
from django.db import connection


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
    location_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    location_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
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
    location_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    location_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
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
    location_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    location_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
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
    upazila_type = models.CharField(max_length=100, blank=True, null=True)
    upazila_code = models.CharField(max_length=100, blank=True, null=True)
    upazila_iso_number = models.CharField(max_length=20, blank=True, null=True)
    upazila_iso_code = models.CharField(max_length=20, blank=True, null=True)
    location_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    location_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
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
    union_parishad_code = models.CharField(max_length=200, blank=True, null=True)
    location_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    location_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
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
    
class GeoSource(models.Model):
    geo_source_id = models.AutoField(primary_key=True)
    country_name_en = models.CharField(max_length=100, blank=True, null=True)
    region_name_en = models.CharField(max_length=100, blank=True, null=True)
    city_name_en = models.CharField(max_length=100, blank=True, null=True)
    network_isp_name = models.CharField(max_length=200, blank=True, null=True)
    network_type = models.CharField(max_length=50, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
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