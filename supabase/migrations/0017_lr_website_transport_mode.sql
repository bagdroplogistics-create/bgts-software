-- ============================================================================
-- BGTS-OS database schema — migration 0017 (LR print fields: company
-- website, transport mode)
-- Run after 0001_schema.sql .. 0016_lr_pan_prepared_by.sql.
--
-- Part of the LR PDF rebuild to match the reference "GC NO." printed format
-- field-for-field: adds Company Website (shown in the LR header, "Web :")
-- and a per-LR Transport Mode (shown in the Invoice/Value/E-way/Mode row,
-- e.g. "ROAD" — defaults to ROAD since this is the only mode BGTS uses
-- today; flagged as a new field, not backfilled from any prior data since
-- none existed).
-- ============================================================================
set search_path = bgts_os, public;

alter table bgts_os.company_settings
  add column if not exists website text not null default '';

alter table bgts_os.lrs
  add column if not exists transport_mode text not null default 'ROAD';
