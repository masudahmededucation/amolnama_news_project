from django.db import models


# ========== Reference Tables ==========
# IncidentRiskLevel (ref_incident_risk_level) — DELETED.
# Replaced by ref_status group_code='risk_level' (IDs 243-246: LOW, MEDIUM, HIGH, EXTREME).


class RefStatus(models.Model):
    status_id = models.AutoField(primary_key=True)
    # link_status_id, link_status_code — computed columns, not defined in model
    group_code = models.CharField(max_length=100)
    status_code = models.CharField(max_length=100, blank=True, null=True)
    status_name_en = models.CharField(max_length=200)
    status_name_bn = models.CharField(max_length=200)
    status_icon = models.CharField(max_length=50, blank=True, null=True)
    hex_color_code = models.CharField(max_length=50, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[investigation].[ref_status]'

    def __str__(self):
        return self.status_name_en or self.status_name_bn or ''


# IncidentType (incident_type) — DELETED. Table dropped from DB.
# InfluenceType (influence_type) — DELETED. Table dropped from DB.
# ReliabilityRating (reliability_rating) — DELETED. Table dropped from DB.
# SourceType (source_type) — DELETED. Replaced by ref_status group_code='investigation_intelligence_source' (IDs 229-242).
# IntelligenceSource (intelligence_source) — DELETED. Table dropped from DB.


# ========== Data Tables ==========


class CrimeFormImpactCasualty(models.Model):
    crime_form_impact_casualty_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    casualty_death_count = models.IntegerField()
    casualty_injury_count = models.IntegerField()
    casualty_missing_count = models.IntegerField()
    casualty_arrested_count = models.IntegerField()
    property_has_property_destruction = models.BooleanField()
    property_destruction_description_bn = models.TextField(blank=True, null=True)
    property_estimated_damage_amount_bdt = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    state_is_incident_ongoing = models.BooleanField()
    state_last_verified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[crime_form_impact_casualty]'

    def __str__(self):
        return f"CrimeFormImpactCasualty({self.crime_form_impact_casualty_id})"


class ExtortionFormImpact(models.Model):
    # DB table: [investigation].[extortion_form_impact]
    investigation_extortion_form_impact_id = models.AutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_ref_status_extortion_form_extortion_demand_frequency_id = models.IntegerField(blank=True, null=True)
    # Sector BIT flags (single radio → one True, rest False)
    sector_is_shop_market = models.BooleanField()
    sector_is_transport_vehicle = models.BooleanField()
    sector_is_construction_site = models.BooleanField()
    sector_is_contract_tender = models.BooleanField()
    sector_is_garment_factory = models.BooleanField()
    sector_is_crops_produce = models.BooleanField()
    sector_is_school_college = models.BooleanField()
    sector_is_healthcare_clinic = models.BooleanField()
    sector_is_phone_digital = models.BooleanField()
    sector_is_other = models.BooleanField()
    sector_transport_location_code = models.CharField(max_length=30, blank=True, null=True)
    sector_other_description = models.CharField(max_length=200, blank=True, null=True)
    sector_garment_extortion_type_code = models.CharField(max_length=30, blank=True, null=True)
    # Financial
    demand_amount_demanded_bdt = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    demand_amount_collected_bdt = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    # Perpetrator affiliation BIT flags
    accused_is_political_student_wing = models.BooleanField()
    accused_is_transport_association = models.BooleanField()
    accused_is_business_trade_association = models.BooleanField()
    accused_is_professional_gang = models.BooleanField()
    accused_is_law_enforcement = models.BooleanField()
    accused_is_teen_gang = models.BooleanField()
    accused_is_disguised_association_fee = models.BooleanField()
    accused_is_unknown = models.BooleanField()
    accused_political_party_org_name = models.CharField(max_length=300, blank=True, null=True)
    # Threat method BIT flags
    threat_is_in_person = models.BooleanField()
    threat_is_phone_sms = models.BooleanField()
    threat_is_online_social_media = models.BooleanField()
    threat_is_written_letter = models.BooleanField()
    threat_is_blocking_supply = models.BooleanField()
    threat_is_physical_assault = models.BooleanField()
    threat_is_vandalism_arson = models.BooleanField()
    threat_is_abduction_hostage = models.BooleanField()
    threat_is_false_case_threat = models.BooleanField()
    # Consequence BIT flags
    consequence_is_paid_full = models.BooleanField()
    consequence_is_paid_partial = models.BooleanField()
    consequence_is_business_disrupted = models.BooleanField()
    consequence_is_physically_injured = models.BooleanField()
    consequence_is_abducted_hostage = models.BooleanField()
    consequence_is_shot_critically_injured = models.BooleanField()
    consequence_is_killed = models.BooleanField()
    consequence_is_false_case_filed = models.BooleanField()
    consequence_is_property_vandalized = models.BooleanField()
    consequence_is_none_yet = models.BooleanField()
    consequence_property_damage_description = models.CharField(max_length=2000, blank=True, null=True)
    # Bangladesh context BIT flags
    context_is_law_enforcement_direct_participation = models.BooleanField()
    context_is_systematic_extortion_pattern = models.BooleanField()
    additional_remarks = models.CharField(max_length=2000, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[extortion_form_impact]'

    def __str__(self):
        return f"ExtortionFormImpact({self.investigation_extortion_form_impact_id})"


class CivicFormImpact(models.Model):
    # DB table: [investigation].[civic_form_impact]
    civic_form_impact_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_ref_status_civic_form_sub_issue_type_id = models.IntegerField()
    impact_affected_people_count = models.IntegerField(blank=True, null=True)
    link_ref_status_civic_form_impact_category_id = models.IntegerField()
    link_ref_status_civic_form_time_duration_unit_id = models.IntegerField(blank=True, null=True)
    impact_time_duration_unit_number = models.IntegerField(blank=True, null=True)
    is_complaint_filed_previously = models.BooleanField()
    complaint_previous_details = models.CharField(max_length=2000, blank=True, null=True)
    complaint_budget_project_info = models.CharField(max_length=1000, blank=True, null=True)
    link_ref_status_civic_form_current_issue_status_id = models.IntegerField()
    status_description_bn = models.CharField(max_length=1000, blank=True, null=True)
    status_last_verified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[civic_form_impact]'

    def __str__(self):
        return f"CivicFormImpact({self.civic_form_impact_id})"


class GlobalNewsFormFact(models.Model):
    # DB table: [investigation].[global_news_form_fact]
    # Stores all Global News form-specific data in a single row.
    investigation_global_news_form_fact_id = models.AutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()

    # News Details (Step 3: sub-type + classification + story status)
    link_ref_status_global_news_form_issue_sub_type_id = models.IntegerField(blank=True, null=True)
    news_issue_sub_type_other_category_details = models.CharField(max_length=100, blank=True, null=True)
    link_ref_status_global_news_form_news_significance_id = models.IntegerField(blank=True, null=True)
    is_news_breaking = models.IntegerField(blank=True, null=True)           # INT NULL (not BIT)
    is_news_developing_ongoing_story = models.BooleanField(blank=True, null=True)

    # Geography (Step 4: countries)
    geo_primary_country_or_region = models.CharField(max_length=100)        # NOT NULL
    geo_all_involved_countries_or_regions = models.CharField(max_length=1000, blank=True, null=True)

    # Organizations (Step 4: checkboxes — all BIT NOT NULL DEFAULT 0)
    is_org_un = models.BooleanField()
    is_org_eu = models.BooleanField()
    is_org_nato = models.BooleanField()
    is_org_imf = models.BooleanField()
    is_org_world_bank = models.BooleanField()
    is_org_wto = models.BooleanField()
    is_org_who = models.BooleanField()
    is_org_asean = models.BooleanField()
    is_org_oic = models.BooleanField()
    is_org_saarc = models.BooleanField()
    is_org_g7 = models.BooleanField()
    is_org_g20 = models.BooleanField()
    is_org_brics = models.BooleanField()
    is_org_icc = models.BooleanField()
    is_org_other = models.BooleanField()
    org_other_organization_name = models.CharField(max_length=200, blank=True, null=True)

    # Bangladesh Relevance & Impact (Step 5)
    is_bd_directly_relevant_to_bangladesh = models.BooleanField(blank=True, null=True)
    bd_stake_interest_details = models.CharField(max_length=1000, blank=True, null=True)
    is_bd_expatriate_workers_affected = models.BooleanField()               # NOT NULL DEFAULT 0
    bd_estimated_affected_expatriates_count = models.IntegerField(blank=True, null=True)
    bd_expatriate_impact_description = models.CharField(max_length=1000, blank=True, null=True)
    bd_economic_impact_details = models.CharField(max_length=1000, blank=True, null=True)
    bd_govt_position_statement = models.CharField(max_length=1000, blank=True, null=True)

    # International Response (Step 6)
    intl_body_statement = models.CharField(max_length=1000, blank=True, null=True)
    is_intl_sanctions_special_measures_imposed = models.BooleanField()      # NOT NULL DEFAULT 0
    intl_sanctions_special_measures_description = models.CharField(max_length=500, blank=True, null=True)
    is_intl_agreement_or_resolution_adopted = models.BooleanField()         # NOT NULL DEFAULT 0
    intl_agreement_or_resolution_description = models.CharField(max_length=500, blank=True, null=True)
    link_ref_status_global_news_form_sanctions_imposed_id = models.IntegerField(blank=True, null=True)
    link_ref_status_global_news_form_global_media_coverage_id = models.IntegerField(blank=True, null=True)

    created_at = models.DateTimeField()
    # created_by — not used in form submission

    class Meta:
        managed = False
        db_table = '[investigation].[global_news_form_fact]'

    def __str__(self):
        return f"GlobalNewsFormFact({self.investigation_global_news_form_fact_id})"


# IncidentEvidenceWeapon (incident_evidence_weapon) — DELETED. Table dropped from DB.
# IncidentEvidenceInvolvedActor (incident_evidence_involved_actor) — DELETED. Table dropped from DB.
# IncidentEvidenceImpactWeapon (incident_evidence_impact_weapon) — DELETED. Table dropped from DB.


class ConflictFormActorCountry(models.Model):
    # Renamed from incident_evidence_conflict_country → conflict_form_actor_country
    conflict_form_actor_country_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_ref_status_actor_involvement_type_id = models.IntegerField()
    link_country_id = models.IntegerField()
    actor_alliance_coalition_bn = models.CharField(max_length=255, blank=True, null=True)
    actor_leader_decision_maker_bn = models.CharField(max_length=255, blank=True, null=True)
    actor_official_statement_bn = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[conflict_form_actor_country]'

    def __str__(self):
        return f"ConflictFormActorCountry({self.conflict_form_actor_country_id})"


class ConflictFormImpact(models.Model):
    # Replaces: incident_evidence_global_conflict + incident_evidence_global_conflict_strategic_impact
    # Strategic impacts are now 4 bit columns instead of a junction table
    conflict_form_impact_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_ref_status_conflict_form_conflict_type_id = models.IntegerField(blank=True, null=True)
    link_ref_status_conflict_form_territorial_sovereignty_status_id = models.IntegerField(blank=True, null=True)
    link_ref_status_conflict_form_conflict_intensity_id = models.IntegerField(blank=True, null=True)
    link_ref_status_conflict_form_weapon_id = models.IntegerField(blank=True, null=True)
    link_ref_status_conflict_form_involvement_level_id = models.IntegerField(blank=True, null=True)
    link_ref_status_conflict_form_global_reaction_id = models.IntegerField(blank=True, null=True)
    frontline_territory_name_bn = models.CharField(max_length=255, blank=True, null=True)
    casualty_military_count = models.IntegerField()
    casualty_civilian_count = models.IntegerField()
    casualty_displaced_refugee_count = models.IntegerField()
    casualty_has_war_crime_allegation = models.BooleanField()
    casualty_war_crime_details_bn = models.CharField(max_length=2000, blank=True, null=True)
    global_reaction_details_bn = models.CharField(max_length=1000, blank=True, null=True)
    global_is_impact_currency_economy = models.BooleanField()
    global_is_impact_food_supply = models.BooleanField()
    global_is_impact_oil_energy = models.BooleanField()
    global_is_impact_shipping_lanes = models.BooleanField()
    local_has_bangladesh_impact = models.BooleanField()
    local_impact_description_bn = models.CharField(max_length=2000, blank=True, null=True)
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[conflict_form_impact]'

    def __str__(self):
        return f"ConflictFormImpact({self.conflict_form_impact_id})"


# IncidentEvidenceWomenVictimProfile — DELETED (2026-03-13)
# All columns (link_person_id, link_person_marriage_id) already exist in
# incident_involved_actor_profile. Child tables now FK to actor_profile instead.


# IncidentEvidenceWomenVictimCondition (incident_evidence_women_victim_condition) — DELETED. Table dropped from DB.


# IncidentEvidenceWomenPerpetrator — DELETED (2026-03-13)
# Table [investigation].[incident_evidence_women_perpetrator] dropped.
# Replaced by [investigation].[women_form_perpetrator] (WomenFormPerpetrator model below).


class WomenFormPerpetrator(models.Model):
    """One row per accused perpetrator per news entry.
    Name/father stored in [person].[person] via link_person_id — not on this table."""
    women_form_perpetrator_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_person_id = models.BigIntegerField()
    link_women_form_victim_profile_fact_id = models.BigIntegerField(blank=True, null=True)
    link_ref_status_victim_attacker_relationship_id = models.IntegerField(blank=True, null=True)
    perp_other_relationship_details = models.CharField(max_length=100, blank=True, null=True)
    perp_number_of_perpetrators = models.IntegerField(blank=True, null=True)
    link_ref_status_women_form_attacker_power_position_id = models.IntegerField(blank=True, null=True)
    perp_power_position_details_bn = models.CharField(max_length=2000, blank=True, null=True)
    is_perp_threatened_victim_or_family = models.BooleanField()
    is_perp_used_drugs_or_intoxication = models.BooleanField()
    is_perp_history_previous_violence = models.BooleanField()
    perp_history_previous_details_bn = models.CharField(max_length=4000, blank=True, null=True)
    remarks_about_perpetrator_bn = models.CharField(max_length=2000, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[women_form_perpetrator]'

    def __str__(self):
        return f"WomenFormPerpetrator({self.women_form_perpetrator_id})"


# IncidentEvidenceWomenVictimConditionAttribute — DELETED (2026-03-13)
# Table [investigation].[incident_evidence_women_victim_condition_attribute] dropped.
# Replaced by [investigation].[women_form_victim_profile_fact] (WomenFormVictimProfileFact model below).


class WomenFormVictimProfileFact(models.Model):
    """Flat table storing Step 3 (violence type/context) and Step 5 (condition/injury) attributes.
    One row per victim per news entry. Directly stores person + marriage FKs."""
    women_form_victim_profile_fact_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_person_id = models.BigIntegerField(blank=True, null=True)
    link_person_marriage_id = models.BigIntegerField(blank=True, null=True)
    # Step 3: Violence type
    violence_type_rape = models.BooleanField()
    violence_type_gang_rape = models.BooleanField()
    violence_type_attempted_rape = models.BooleanField()
    violence_type_sexual_assault = models.BooleanField()
    violence_type_domestic_violence = models.BooleanField()
    violence_type_acid_attack = models.BooleanField()
    violence_type_dowry_violence = models.BooleanField()
    violence_type_eve_teasing = models.BooleanField()
    violence_type_child_marriage = models.BooleanField()
    violence_type_forced_marriage = models.BooleanField()
    violence_type_trafficking = models.BooleanField()
    violence_type_cyber_harassment = models.BooleanField()
    violence_type_workplace_harassment = models.BooleanField()
    violence_type_honor_killing = models.BooleanField()
    violence_type_torture_or_cruelty = models.BooleanField()
    violence_type_other = models.BooleanField()
    violence_type_describe_type_of_violence_bn = models.CharField(max_length=500, blank=True, null=True)
    violence_type_incident_location_type = models.CharField(max_length=100, blank=True, null=True)
    violence_type_is_recurring_violence = models.BooleanField()
    violence_type_duration_of_violence = models.CharField(max_length=50, blank=True, null=True)
    # Step 5: Victim condition
    victim_condition_is_pregnant = models.BooleanField()
    victim_condition_months_pregnant = models.IntegerField(blank=True, null=True)
    victim_condition_has_children = models.BooleanField()
    victim_condition_number_of_children = models.IntegerField(blank=True, null=True)
    victim_condition_has_economic_dependency = models.BooleanField()
    victim_condition_has_disability = models.BooleanField()
    victim_condition_disability_type_bn = models.CharField(max_length=100, blank=True, null=True)
    # Step 5: Injury
    injury_type_has_physical_injury = models.BooleanField()
    injury_type_has_sexual_injury = models.BooleanField()
    injury_type_has_psychological_trauma = models.BooleanField()
    injury_type_has_acid_or_burn_injury = models.BooleanField()
    injury_type_has_fracture = models.BooleanField()
    injury_type_has_internal_injury = models.BooleanField()
    injury_type_has_strangulation_injury = models.BooleanField()
    injury_type_injury_severity = models.CharField(max_length=50, blank=True, null=True)
    injury_type_has_ptsd_or_flashbacks = models.BooleanField()
    injury_type_has_depression = models.BooleanField()
    injury_type_has_anxiety = models.BooleanField()
    injury_type_has_sleep_disorder = models.BooleanField()
    injury_type_has_suicidal_ideation = models.BooleanField()
    # Step 5: Medical / Safety / Consent
    msc_victim_current_condition = models.CharField(max_length=100, blank=True, null=True)
    msc_current_safety_status = models.CharField(max_length=100, blank=True, null=True)
    msc_consent_to_share_information = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[women_form_victim_profile_fact]'

    def __str__(self):
        return f"WomenFormVictimProfileFact({self.women_form_victim_profile_fact_id})"


# IncidentEvidenceWomenLegalAction — DELETED (2026-03-13)
# Table [investigation].[incident_evidence_women_legal_action] dropped.
# Replaced by [investigation].[women_form_victim_legal_action] below.


class WomenFormVictimLegalAction(models.Model):
    """Step 7 legal action data — one row per news entry."""
    women_form_victim_legal_action_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_ref_status_law_gd_fir_status_id = models.IntegerField()  # FK → ref_status; NOT NULL
    case_gd_number = models.CharField(max_length=100, blank=True, null=True, db_column='law_gd_fir_case_gd_number')
    reason_for_not_filing_and_plans = models.CharField(max_length=1000, blank=True, null=True, db_column='law_gd_fir_reason_not_filing_and_plans')
    police_refusal_statement = models.CharField(max_length=1000, blank=True, null=True, db_column='law_gd_fir_police_refusal_statement')
    police_station_name = models.CharField(max_length=200, blank=True, null=True, db_column='law_gd_fir_thana_location_display_title_en')
    # Applicable laws (BIT NULL DEFAULT 0)
    is_law_women_children_repression_2000 = models.BooleanField(null=True, blank=True)
    is_law_penal_code_375_376_rape = models.BooleanField(null=True, blank=True)
    is_law_domestic_violence_2010 = models.BooleanField(null=True, blank=True)
    is_law_acid_control_2002 = models.BooleanField(null=True, blank=True)
    is_law_digital_security = models.BooleanField(null=True, blank=True)
    is_law_dowry_prohibition_2018 = models.BooleanField(null=True, blank=True)
    is_law_child_marriage_restraint_2017 = models.BooleanField(null=True, blank=True)
    is_law_human_trafficking_2012 = models.BooleanField(null=True, blank=True)
    # Case status — FK → ref_status
    link_ref_status_law_case_status_id = models.IntegerField(blank=True, null=True)
    # Support services (BIT NULL DEFAULT 0)
    is_support_shelter_accessed = models.BooleanField(null=True, blank=True)
    is_support_legal_aid = models.BooleanField(null=True, blank=True)
    is_support_counseling_provided = models.BooleanField(null=True, blank=True)
    is_support_one_stop_crisis_centre = models.BooleanField(null=True, blank=True)
    # Risk / threat / pressure / retaliation (BIT NULL DEFAULT 0)
    is_risk_threat_family_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_settlement_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_case_withdrawal_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_business_loss_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_witness_victim_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_eviction_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_retaliation_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_death_or_physical_harm_threat = models.BooleanField(null=True, blank=True)
    legal_action_additional_remarks = models.CharField(max_length=1000, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[women_form_victim_legal_action]'

    def __str__(self):
        return f"WomenFormVictimLegalAction({self.women_form_victim_legal_action_id})"


# ---------------------------------------------------------------------------
# Involved actor profile — generic cross-form table linking news entries to
# person records.  One row per person per news entry.
# DB table: [investigation].[incident_involved_actor_profile]
# ---------------------------------------------------------------------------
class IncidentInvolvedActorProfile(models.Model):
    incident_involved_actor_profile_id = models.BigAutoField(primary_key=True)
    link_ref_status_incident_involved_actor_role_id = models.IntegerField(blank=True, null=True)
    incident_involved_actor_role_group_code = models.CharField(max_length=100,
        db_column='incident_involved_actor_role_group_code')  # denormalised role code: VICTIM, ACCUSED, WITNESS, etc.
    link_form_type_id = models.IntegerField(blank=True, null=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_person_id = models.BigIntegerField(blank=True, null=True)
    link_person_marriage_id = models.BigIntegerField(blank=True, null=True)
    link_ref_status_victim_medical_condition_id = models.IntegerField(blank=True, null=True,
        db_column='link_ref_status_victim_medical_condition_id')
    victim_medical_treatment_location_name = models.CharField(max_length=100, blank=True, null=True,
        db_column='victim_medical_treatment_location_name')
    link_ref_status_incident_involved_actor_type_id = models.IntegerField(blank=True, null=True,
        db_column='link_ref_status_incident_involved_actor_type_id')
    incident_involved_actor_type_details = models.CharField(max_length=100, blank=True, null=True)
    actor_organization_name = models.CharField(max_length=255, blank=True, null=True)
    actor_designation = models.CharField(max_length=100, blank=True, null=True)
    actor_patron_name = models.CharField(max_length=255, blank=True, null=True)
    actor_statement = models.CharField(max_length=2000, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[incident_involved_actor_profile]'

    def __str__(self):
        return f"ActorProfile({self.incident_involved_actor_profile_id})"


# ---------------------------------------------------------------------------
# Crime form — weapons & evidence (Step 8 of Crime & Violence form)
# DB table: [investigation].[crime_form_weapon]
# One row per news entry. BIT columns per known weapon type.
# ---------------------------------------------------------------------------
class CrimeFormWeapon(models.Model):
    investigation_crime_form_weapon_id = models.AutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    weapon_is_firearms_used = models.BooleanField()
    weapon_is_explosives_used = models.BooleanField()
    weapon_is_sharp_weapon_used = models.BooleanField()
    weapon_is_sticks_rods_used = models.BooleanField()
    weapon_is_poison_chemical_used = models.BooleanField()
    weapon_other_description = models.CharField(max_length=100, blank=True, null=True)
    evidence_recovered_description = models.CharField(max_length=500, blank=True, null=True)
    evidence_file_path = models.CharField(max_length=500, blank=True, null=True)  # NOT USED — files save to [media].[news_entry_asset] with link_incident_involved_actor_role_id=36 (INVESTIGATOR)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[crime_form_weapon]'

    def __str__(self):
        return f"CrimeFormWeapon({self.investigation_crime_form_weapon_id})"


# ---------------------------------------------------------------------------
# Crime form — legal action & support (Step 9 of Crime & Violence form)
# DB table: [investigation].[crime_form_victim_legal_action]
# One row per news entry. BIT columns per known applicable law / support service /
# risk-threat type.
# ---------------------------------------------------------------------------
class CrimeFormVictimLegalAction(models.Model):
    investigation_crime_form_victim_legal_action_id = models.AutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_ref_status_law_gd_fir_status_id = models.IntegerField()       # FK → [investigation].[ref_status]; group_code=law_gd_fir_status
    case_gd_number = models.CharField(max_length=100, blank=True, null=True, db_column='law_gd_fir_case_gd_number')
    reason_not_filing_and_plans = models.CharField(max_length=1000, blank=True, null=True, db_column='law_gd_fir_reason_not_filing_and_plans')
    police_refusal_statement = models.CharField(max_length=1000, blank=True, null=True, db_column='law_gd_fir_police_refusal_statement')
    location_display_title_en = models.CharField(max_length=200, blank=True, null=True, db_column='law_gd_fir_thana_location_display_title_en')
    # Applicable laws (BIT NULL DEFAULT 0)
    is_law_penal_302_murder = models.BooleanField(null=True, blank=True)
    is_law_penal_307_attempt_murder = models.BooleanField(null=True, blank=True)
    is_law_penal_323_325_hurt = models.BooleanField(null=True, blank=True)
    is_law_penal_392_394_robbery = models.BooleanField(null=True, blank=True)
    is_law_arms_act = models.BooleanField(null=True, blank=True)
    is_law_anti_terrorism_act = models.BooleanField(null=True, blank=True)
    is_law_narcotics_control_act = models.BooleanField(null=True, blank=True)
    is_law_special_powers_act = models.BooleanField(null=True, blank=True)
    # Case status — FK → ref_status
    link_ref_status_law_case_status_id = models.IntegerField(blank=True, null=True)
    # Victim support services (BIT NULL DEFAULT 0)
    is_victim_support_govt_legal_aid = models.BooleanField(null=True, blank=True)
    is_victim_support_victim_support_center = models.BooleanField(null=True, blank=True)
    is_victim_support_ngo_support = models.BooleanField(null=True, blank=True)
    is_victim_support_family_community_support = models.BooleanField(null=True, blank=True)
    # Risk / threat / pressure / retaliation (BIT NULL DEFAULT 0)
    is_risk_threat_family_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_settlement_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_case_withdrawal_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_business_loss_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_witness_victim_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_eviction_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_retaliation_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_death_or_physical_harm_threat = models.BooleanField(null=True, blank=True)
    legal_action_additional_remarks = models.CharField(max_length=1000, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    created_by_user_id = models.IntegerField(blank=True, null=True)
    updated_by_user_id = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[crime_form_victim_legal_action]'

    def __str__(self):
        return f"CrimeFormVictimLegalAction({self.investigation_crime_form_victim_legal_action_id})"


# ---------------------------------------------------------------------------
# Extortion form — victim legal action (GD/FIR, applicable laws, support, pressure)
# DB table: [investigation].[extortion_form_victim_legal_action]
# ---------------------------------------------------------------------------
class ExtortionFormVictimLegalAction(models.Model):
    extortion_form_victim_legal_action_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_ref_status_law_gd_fir_status_id = models.IntegerField()
    gd_fir_case_gd_number = models.CharField(max_length=100, blank=True, null=True, db_column='law_gd_fir_case_gd_number')
    gd_fir_reason_not_filing_and_plans = models.CharField(max_length=1000, blank=True, null=True, db_column='law_gd_fir_reason_not_filing_and_plans')
    gd_fir_police_refusal_statement = models.CharField(max_length=1000, blank=True, null=True, db_column='law_gd_fir_police_refusal_statement')
    gd_fir_location_display_title_en = models.CharField(max_length=200, blank=True, null=True, db_column='law_gd_fir_thana_location_display_title_en')
    link_ref_status_law_case_status_id = models.IntegerField(blank=True, null=True)
    # Applicable laws (BIT NULL DEFAULT 0)
    is_law_penal_code_383_389 = models.BooleanField(null=True, blank=True)
    is_law_anti_terrorism_act = models.BooleanField(null=True, blank=True)
    is_law_prevention_of_corruption_act = models.BooleanField(null=True, blank=True)
    is_law_money_laundering_prevention_act = models.BooleanField(null=True, blank=True)
    # Support services (BIT NULL DEFAULT 0)
    is_support_gov_legal_aid = models.BooleanField(null=True, blank=True)
    is_support_acc_complaint = models.BooleanField(null=True, blank=True)
    is_support_business_association = models.BooleanField(null=True, blank=True)
    is_support_ngo_aid = models.BooleanField(null=True, blank=True)
    # Risk / threat / pressure / retaliation (BIT NULL DEFAULT 0)
    is_risk_threat_family_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_settlement_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_case_withdrawal_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_business_loss_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_witness_victim_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_eviction_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_retaliation_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_death_or_physical_harm_threat = models.BooleanField(null=True, blank=True)
    legal_action_additional_remarks = models.CharField(max_length=1000, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[extortion_form_victim_legal_action]'

    def __str__(self):
        return f"ExtortionFormVictimLegalAction({self.extortion_form_victim_legal_action_id})"


# ---------------------------------------------------------------------------
# July 2024 uprising — martyr/victim fact table
# DB table: [investigation].[july2024_fact_protest]
# ---------------------------------------------------------------------------
class July2024FactProtest(models.Model):
    july2024_fact_protest_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()

    # 1. Incident type and context (Step 3)
    link_ref_status_incident_type_id = models.IntegerField(blank=True, null=True)
    link_ref_status_protest_scale_id = models.IntegerField(blank=True, null=True)
    link_ref_status_internet_status_id = models.IntegerField(blank=True, null=True)
    link_ref_status_curfew_status_id = models.IntegerField(blank=True, null=True)

    # 2. Status and outcome
    link_ref_status_victim_current_status_id = models.IntegerField(blank=True, null=True)

    # 3. Personal story and memory
    victim_story_final_words_or_actions = models.CharField(max_length=4000, blank=True, null=True)
    victim_story_biographical_note = models.CharField(max_length=4000, blank=True, null=True)
    victim_story_involvement_context = models.CharField(max_length=4000, blank=True, null=True)
    victim_story_is_sole_breadwinner = models.BooleanField()
    victim_story_family_impact_note = models.CharField(max_length=4000, blank=True, null=True)
    victim_story_dependents_count = models.IntegerField(blank=True, null=True)

    # 4. Medical and injury details
    link_ref_status_protest_suppression_weapon_id = models.IntegerField(blank=True, null=True)
    link_ref_status_victim_body_injury_site_id = models.IntegerField(blank=True, null=True)
    victim_medical_injury_timestamp_text = models.CharField(max_length=200, blank=True, null=True)
    victim_medical_hospital_name = models.CharField(max_length=500, blank=True, null=True)
    victim_medical_death_timestamp_text = models.CharField(max_length=200, blank=True, null=True)

    # 5. Death and supporting evidence
    victim_evidence_is_autopsy_done = models.BooleanField()
    victim_evidence_is_death_certificate_available = models.BooleanField()
    victim_evidence_is_medical_documents_available = models.BooleanField()

    # 6. Forces involved (BIT columns — DB DEFAULT 0)
    force_involved_is_police = models.BooleanField()
    force_involved_is_rab = models.BooleanField()
    force_involved_is_bgb = models.BooleanField()
    force_involved_is_army = models.BooleanField()
    force_involved_is_db_police = models.BooleanField()
    force_involved_is_bcl = models.BooleanField()
    force_involved_is_jubo_league = models.BooleanField()
    force_involved_is_unknown_plainclothes = models.BooleanField()

    # 7. Command and responsibility
    force_details_unit_or_badge_number = models.CharField(max_length=500, blank=True, null=True)
    force_details_commanding_officer_name = models.CharField(max_length=500, blank=True, null=True)
    force_details_area_oc_or_dc_name = models.CharField(max_length=500, blank=True, null=True)
    force_details_orders_or_directives = models.CharField(max_length=4000, blank=True, null=True)

    # 8. Verification and media evidence
    link_ref_status_verification_status_id = models.IntegerField(blank=True, null=True)
    verification_has_video_evidence = models.BooleanField()
    verification_has_photo_evidence = models.BooleanField()
    verification_has_cctv_footage = models.BooleanField()
    verification_has_eyewitness_testimony = models.BooleanField()
    verification_is_listed_in_official_gazette = models.BooleanField()
    verification_eyewitness_count = models.IntegerField(blank=True, null=True)
    verification_memorial_reference = models.CharField(max_length=500, blank=True, null=True)

    # 9. Martyr home address (Step 4)
    link_home_district_id = models.IntegerField(blank=True, null=True)
    link_home_upazila_id = models.IntegerField(blank=True, null=True)
    link_home_union_parishad_id = models.IntegerField(blank=True, null=True)
    link_home_ward_id = models.IntegerField(blank=True, null=True)
    home_local_area_name = models.CharField(max_length=200, blank=True, null=True)

    # System metadata
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    created_by_user_id = models.IntegerField(blank=True, null=True)
    updated_by_user_id = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[july2024_fact_protest]'

    def __str__(self):
        return f"July2024FactProtest({self.july2024_fact_protest_id})"


class LandGrabbingFormFact(models.Model):
    # DB table: [investigation].[land_grabbing_form_fact]
    investigation_land_grabbing_form_fact_id = models.AutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    # Property type
    link_ref_status_land_grabbing_form_land_type_id = models.IntegerField(blank=True, null=True)
    land_details_other_property_type_description = models.CharField(max_length=1000, blank=True, null=True)
    # Land record details
    record_details_mouza_name = models.CharField(max_length=200, blank=True, null=True)
    record_details_daag_plot_number = models.CharField(max_length=1000, blank=True, null=True)
    record_details_khatian_number = models.CharField(max_length=100, blank=True, null=True)
    record_details_area_amount = models.DecimalField(max_digits=18, decimal_places=2, blank=True, null=True)
    link_ref_status_land_grabbing_form_area_unit_id = models.IntegerField(blank=True, null=True)
    # Document / title status (BIT flags — status_ids 517-521)
    ownership_status_has_khatian_porcha = models.BooleanField()
    ownership_status_has_registered_deed = models.BooleanField()
    ownership_status_is_inherited = models.BooleanField()
    ownership_status_has_court_order = models.BooleanField()
    ownership_status_no_documents = models.BooleanField()
    # Grabbing methods (BIT flags — status_ids 522-529)
    grabbing_method_is_forceful_armed = models.BooleanField()
    grabbing_method_is_forged_documents = models.BooleanField()
    grabbing_method_is_false_lawsuit = models.BooleanField()
    grabbing_method_is_political_influence = models.BooleanField()
    grabbing_method_is_govt_official_nexus = models.BooleanField()
    grabbing_method_is_gradual_encroachment = models.BooleanField()
    grabbing_method_is_forced_eviction = models.BooleanField()
    grabbing_method_is_other = models.BooleanField()
    grabbing_method_other_details = models.CharField(max_length=100, blank=True, null=True)
    # Current status
    link_ref_status_land_grabbing_form_current_status_id = models.IntegerField(blank=True, null=True)
    # Human impact
    human_impact_families_evicted_count = models.IntegerField(blank=True, null=True)
    human_impact_has_violence_occurred = models.BooleanField()
    human_impact_violence_description = models.CharField(max_length=2000, blank=True, null=True)
    # Timestamps
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[land_grabbing_form_fact]'

    def __str__(self):
        return f"LandGrabbingFormFact({self.investigation_land_grabbing_form_fact_id})"


class LandGrabbingFormVictimLegalAction(models.Model):
    # DB table: [investigation].[land_grabbing_form_victim_legal_action]
    land_grabbing_form_victim_legal_action_id = models.AutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    # FIR / GD
    link_ref_status_law_gd_fir_status_id = models.IntegerField()  # NOT NULL in DDL
    legal_action_case_gd_number = models.CharField(max_length=100, blank=True, null=True, db_column='law_gd_fir_case_gd_number')
    legal_action_reason_not_filing_desc = models.CharField(max_length=1000, blank=True, null=True, db_column='law_gd_fir_reason_not_filing_and_plans')
    legal_action_police_refusal_statement = models.CharField(max_length=1000, blank=True, null=True, db_column='law_gd_fir_police_refusal_statement')
    legal_action_thana_name_en = models.CharField(max_length=200, blank=True, null=True, db_column='law_gd_fir_thana_location_display_title_en')
    # Applicable laws (BIT NULL DEFAULT 0)
    is_law_crpc_145 = models.BooleanField(null=True, blank=True)
    is_law_civil_suit = models.BooleanField(null=True, blank=True)
    is_law_injunction = models.BooleanField(null=True, blank=True)
    is_law_penal_code_fraud = models.BooleanField(null=True, blank=True)
    is_law_land_reform_act = models.BooleanField(null=True, blank=True)
    is_law_land_acquisition_act = models.BooleanField(null=True, blank=True)
    # Case status
    link_ref_status_law_case_status_id = models.IntegerField(blank=True, null=True)
    # Support services (BIT NULL DEFAULT 0)
    is_support_service_govt_legal_aid = models.BooleanField(null=True, blank=True)
    is_support_service_land_center = models.BooleanField(null=True, blank=True)
    is_support_service_dc_office = models.BooleanField(null=True, blank=True)
    is_support_service_ngo_support = models.BooleanField(null=True, blank=True)
    # Risk / threat / pressure / retaliation (BIT NULL DEFAULT 0)
    is_risk_threat_family_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_settlement_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_case_withdrawal_pressure = models.BooleanField(null=True, blank=True)
    is_risk_threat_business_loss_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_witness_victim_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_eviction_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_retaliation_threat = models.BooleanField(null=True, blank=True)
    is_risk_threat_death_or_physical_harm_threat = models.BooleanField(null=True, blank=True)
    # Remarks
    legal_action_additional_remarks = models.CharField(max_length=1000, blank=True, null=True)
    # Timestamps
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[land_grabbing_form_victim_legal_action]'

    def __str__(self):
        return f"LandGrabbingFormVictimLegalAction({self.land_grabbing_form_victim_legal_action_id})"


# ========== Price Hike & Syndicate Form ==========

class PriceHikingFormCommodityPrice(models.Model):
    # Note: table name has typo "comodity" (single m) — matches DB exactly
    market_commodity_price_impact_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_commodity_id = models.IntegerField()
    price_govt_fixed_rate = models.DecimalField(max_digits=18, decimal_places=2)
    price_market_rate = models.DecimalField(max_digits=18, decimal_places=2)
    consumer_impact_description_bn = models.CharField(max_length=1000, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[price_hiking_form_comodity_price]'

    def __str__(self):
        return f"PriceHikingFormCommodityPrice({self.market_commodity_price_impact_id})"


class PriceHikingFormCommodityStockSupplyChain(models.Model):
    price_hiking_form_commodity_stock_supply_chain_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_commodity_id = models.IntegerField()
    is_crisis_artificial_created = models.BooleanField()
    stock_storage_description_bn = models.CharField(max_length=500, blank=True, null=True)
    stock_estimated_quantity = models.CharField(max_length=100, blank=True, null=True)
    supply_chain_crisis_description_bn = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[price_hiking_form_commodity_stock_supply_chain]'

    def __str__(self):
        return f"PriceHikingFormCommodityStockSupplyChain({self.price_hiking_form_commodity_stock_supply_chain_id})"
