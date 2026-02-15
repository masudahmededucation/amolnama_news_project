from django.db import models


# ========== Reference Tables ==========

class RefElectionType(models.Model):
    election_type_id = models.IntegerField(primary_key=True)
    election_type_code = models.CharField(max_length=50)
    election_type_name_en = models.CharField(max_length=100)
    election_type_name_bn = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[election].[ref_election_type]'

    def __str__(self):
        return self.election_type_name_en


class RefElectionStatus(models.Model):
    election_status_id = models.IntegerField(primary_key=True)
    election_status_code = models.CharField(max_length=200, blank=True, null=True)
    election_status_name_en = models.CharField(max_length=200, blank=True, null=True)
    election_status_name_bn = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[election].[ref_election_status]'

    def __str__(self):
        return self.election_status_name_en or self.election_status_code or ''


class RefElection(models.Model):
    election_id = models.IntegerField(primary_key=True)
    link_election_type_id = models.IntegerField(blank=True, null=True)
    link_election_status_id = models.IntegerField()
    election_name_en = models.CharField(max_length=100)
    election_name_bn = models.CharField(max_length=100, blank=True, null=True)
    election_date = models.DateField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[election].[ref_election]'

    def __str__(self):
        return self.election_name_en

    @property
    def election_type(self):
        if self.link_election_type_id:
            return RefElectionType.objects.filter(
                election_type_id=self.link_election_type_id,
            ).first()
        return None

    @property
    def election_status(self):
        return RefElectionStatus.objects.filter(
            election_status_id=self.link_election_status_id,
        ).first()


class RefVoteMethod(models.Model):
    vote_method_id = models.IntegerField(primary_key=True)
    vote_method_code = models.CharField(max_length=50, blank=True, null=True)
    vote_method_name_en = models.CharField(max_length=100, blank=True, null=True)
    vote_method_name_bn = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[election].[ref_vote_method]'

    def __str__(self):
        return self.vote_method_name_en or self.vote_method_code or ''


# ========== Transaction Tables ==========

class DigitalBallotRegistryBook(models.Model):
    digital_ballot_registry_book_id = models.BigAutoField(primary_key=True)
    link_election_evaluation_id = models.IntegerField()
    link_user_profile_id = models.IntegerField()
    hash_identity_anchor_binary = models.BinaryField()
    hash_device_hardware_fingerprint_binary = models.BinaryField(blank=True, null=True)
    hash_biometric_face_vector_binary = models.BinaryField(blank=True, null=True)
    mobile_sim_slot_number = models.IntegerField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[election].[digital_ballot_registry_book]'

    def __str__(self):
        return f"RegistryBook({self.digital_ballot_registry_book_id})"


class DigitalBallot(models.Model):
    digital_ballot_id = models.BigAutoField(primary_key=True)
    link_digital_ballot_registry_book_id = models.BigIntegerField()
    link_election_id = models.IntegerField()
    link_election_evaluation_id = models.IntegerField()
    ballot_voter_audit_receipt_code = models.CharField(max_length=50)
    ballot_cast_timestamp = models.DateTimeField(blank=True, null=True)
    geofencing_ip_address = models.CharField(max_length=45, blank=True, null=True)
    geofencing_network_ping = models.IntegerField(blank=True, null=True)
    geofencing_isp_name = models.CharField(max_length=255, blank=True, null=True)
    botdetection_vote_duration_ms = models.IntegerField(blank=True, null=True)
    botdetection_interaction_count = models.IntegerField(blank=True, null=True)
    botdetection_question_avg = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[election].[digital_ballot]'

    def __str__(self):
        return f"Ballot {self.digital_ballot_id}"

    @property
    def election(self):
        return RefElection.objects.filter(
            election_id=self.link_election_id,
        ).first()


class DigitalBallotVoteEntry(models.Model):
    digital_ballot_vote_entry_id = models.BigAutoField(primary_key=True)
    link_digital_ballot_id = models.BigIntegerField()
    link_constituency_id = models.IntegerField(blank=True, null=True)
    link_union_parishad_id = models.IntegerField(blank=True, null=True)
    link_party_id = models.IntegerField(blank=True, null=True)
    link_candidate_id = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[election].[digital_ballot_vote_entry]'

    def __str__(self):
        return f"Vote Entry {self.digital_ballot_vote_entry_id}"

    @property
    def ballot(self):
        return DigitalBallot.objects.filter(
            digital_ballot_id=self.link_digital_ballot_id,
        ).first()


class CandidateNomination(models.Model):
    candidate_nomination_id = models.IntegerField(primary_key=True)
    link_election_id = models.IntegerField(blank=True, null=True)
    link_person_id = models.BigIntegerField(blank=True, null=True)
    link_constituency_id = models.IntegerField(blank=True, null=True)
    link_party_id = models.IntegerField(blank=True, null=True)
    link_asset_id = models.BigIntegerField(blank=True, null=True)
    link_candidate_nomination_status_id = models.IntegerField(blank=True, null=True)
    candidate_symbol_name_en = models.CharField(max_length=100, blank=True, null=True)
    candidate_symbol_name_bn = models.CharField(max_length=100, blank=True, null=True)
    candidate_summary = models.CharField(max_length=200, blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    created_by = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[election].[candidate_nomination]'

    def __str__(self):
        return f"CandidateNomination({self.candidate_nomination_id})"


# ========== View Models ==========

class AppGetCurrentElection(models.Model):
    election_evaluation_id = models.IntegerField(primary_key=True)
    link_election_id = models.IntegerField()
    link_evaluation_id = models.IntegerField()
    evaluation_name_en = models.CharField(max_length=200)
    evaluation_name_bn = models.CharField(max_length=200)

    class Meta:
        managed = False
        db_table = '[election].[vw_app_get_current_election]'

    def __str__(self):
        return self.evaluation_name_en


class AppGetPastResults(models.Model):
    """Election vote past results — pre-aggregated by SQL Server window functions.
    Read-only view; all queries use .values() / .filter().
    """
    election_evaluation_id = models.IntegerField(primary_key=True)
    link_election_id = models.IntegerField()
    evaluation_name_bn = models.CharField(max_length=200)

    party_id = models.IntegerField()
    party_name_bn = models.CharField(max_length=200)
    party_symbol_name_bn = models.CharField(max_length=100, blank=True, null=True)

    constituency_id = models.IntegerField()
    constituency_name_bn = models.CharField(max_length=200)
    seat_number_bn = models.CharField(max_length=50, blank=True, null=True)

    division_id = models.IntegerField()
    division_name_bn = models.CharField(max_length=100)
    district_id = models.IntegerField()
    district_name_bn = models.CharField(max_length=100)

    file_path = models.CharField(max_length=500, blank=True, null=True)
    file_name = models.CharField(max_length=255, blank=True, null=True)

    national_party_vote = models.IntegerField()
    division_party_vote = models.IntegerField()
    district_party_vote = models.IntegerField()
    seat_party_vote = models.IntegerField()
    up_party_vote = models.IntegerField()

    class Meta:
        managed = False
        db_table = '[election].[vw_app_get_past_results]'
        verbose_name = 'Past Election Result'
        verbose_name_plural = 'Past Election Results'
