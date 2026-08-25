-- ============================================================================
-- BGTS-OS database schema — migration 0007 (Vendor Directory)
-- Run after 0001_schema.sql .. 0006_credit_lenders_fixedexp_audit.sql.
--
-- Adds a standalone vendor/agent directory imported wholesale from the
-- company's ATTrans "View Vendor Details" register (235 rows) — separate
-- from bgts_os.vendors (the operational vendor list already wired into
-- Bookings/LHC/hired-vehicle assignment). This is a reference lookup list
-- carrying ATTrans's own Vendor Code, PAN, GST, Type (Vendor/Agent) and
-- Created By columns, which don't exist on bgts_os.vendors.
-- ============================================================================
set search_path = bgts_os, public;

create table if not exists bgts_os.vendor_directory (
  id           text primary key,
  sr_no        integer,
  vendor_code  text not null default '',
  name         text not null default '',
  contact_no   text not null default '',
  pan_card     text not null default '',
  gst          text not null default '',
  type         text not null default 'VENDOR',
  created_by   text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_vendor_directory_sr_no on bgts_os.vendor_directory (sr_no);
create index if not exists idx_vendor_directory_name on bgts_os.vendor_directory (lower(name));

drop trigger if exists trg_set_updated_at on bgts_os.vendor_directory;
create trigger trg_set_updated_at before update on bgts_os.vendor_directory
  for each row execute function bgts_os.set_updated_at();

alter table bgts_os.vendor_directory enable row level security;

drop policy if exists authenticated_full_access on bgts_os.vendor_directory;
create policy authenticated_full_access on bgts_os.vendor_directory
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on bgts_os.vendor_directory to authenticated;
