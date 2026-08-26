-- ============================================================================
-- BGTS-OS database schema — migration 0013 (lhc_trips.created_by)
-- Run after 0001_schema.sql .. 0012_lhc_trips.sql.
--
-- Adds the CREATED BY column seen in ATTrans's "VIEW LHC DETAILS" register,
-- discovered when importing that register's 32 historical rows — the
-- original 0012_lhc_trips.sql migration didn't yet have this column.
-- ============================================================================
set search_path = bgts_os, public;

alter table bgts_os.lhc_trips
  add column if not exists created_by text not null default '';
