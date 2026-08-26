-- ============================================================================
-- BGTS-OS database schema — migration 0014 (lhc_trips.image_uri)
-- Run after 0001_schema.sql .. 0013_lhc_trips_created_by.sql.
--
-- Adds the "IMAGE / Choose File" attachment field to the LHC module, same
-- pattern as lrs.pod_file_uri (see 0001_schema.sql): stores a local device
-- URI string, not a durable upload — this app has no Supabase Storage
-- bucket wired up yet. On the web build this is a browser blob: URL that
-- only survives the current tab/session.
-- ============================================================================
set search_path = bgts_os, public;

alter table bgts_os.lhc_trips
  add column if not exists image_uri text not null default '';
