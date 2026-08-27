-- ============================================================================
-- BGTS-OS database schema — migration 0016 (LR print fields: PAN No,
-- Prepared By, and the branch address already used for booking-office
-- display on the printed LR)
-- Run after 0001_schema.sql .. 0015_lhc_payments.sql.
--
-- Requested: bring across LR detail fields present on the older/reference
-- printed LR format (white-background "GC NO." style) that the app's own
-- redesigned LR PDF (lrHtml() in logic.js) was missing:
--   - Company / Branch PAN No — shown in the LR header next to GSTIN.
--   - Prepared By — a new free-text field on the LR itself, shown next to
--     Employee / Truck Driver No.
-- The booking branch's full address (already stored in branches.addr) is
-- now also printed under the Booking Branch cell — no schema change needed
-- for that one, just a logic.js/lrHtml() change.
-- ============================================================================
set search_path = bgts_os, public;

alter table bgts_os.company_settings
  add column if not exists pan_no text not null default '';

alter table bgts_os.branches
  add column if not exists pan_no text not null default '';

alter table bgts_os.lrs
  add column if not exists prepared_by text not null default '';
