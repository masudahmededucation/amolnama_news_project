-- Add 4 missing columns to extortion_form_impact
-- Step 7 (Incident Details) fields that exist in UI but have no DB columns

USE [news_magazine];
GO

ALTER TABLE [investigation].[extortion_form_impact] ADD
    [consequence_property_damage_description] NVARCHAR(2000)  NULL,
    [sector_transport_location_code]          VARCHAR(30)      NULL,
    [sector_garment_extortion_type_code]      VARCHAR(30)      NULL,
    [accused_political_party_org_name]        NVARCHAR(300)    NULL;
GO
