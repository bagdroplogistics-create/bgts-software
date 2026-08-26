-- ============================================================================
-- BGTS-OS database schema — migration 0009 (Tax Master)
-- Run after 0001_schema.sql .. 0008_bills.sql.
--
-- Standalone master imported wholesale from ATTrans's "View Tax Details"
-- register (15 rows) — a fixed list of LR-Charge / Payment-Detail line types,
-- each with a sign (+ adds to a bill, - deducts) and the set of app modules
-- it applies to. Independent of bills/bill_charges/bill_payments — not wired
-- as their data source yet, just captured here as its own reference master.
-- ============================================================================
set search_path = bgts_os, public;

create table if not exists bgts_os.tax_master (
  id             text primary key,
  sr_no          integer,
  sign           text not null default '+' check (sign in ('+', '-')),
  description    text not null default '',
  account_group  text not null default '',
  modules        text not null default '',
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_tax_master_sr_no on bgts_os.tax_master (sr_no);

drop trigger if exists trg_set_updated_at on bgts_os.tax_master;
create trigger trg_set_updated_at before update on bgts_os.tax_master
  for each row execute function bgts_os.set_updated_at();

alter table bgts_os.tax_master enable row level security;

drop policy if exists authenticated_full_access on bgts_os.tax_master;
create policy authenticated_full_access on bgts_os.tax_master
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on bgts_os.tax_master to authenticated;
