-- ============================================================================
-- BGTS-OS database schema — migration 0005 (Truck Master)
-- Run after 0001_schema.sql, 0002_functions.sql, 0003_rls.sql, 0004_grants.sql.
--
-- Adds a standalone truck directory (code, truck no, owner name, contact no,
-- whether a PAN card is on file, whether an RC No is on file, created by) —
-- separate from bgts_os.vehicles (BGTS's own owned fleet). This is a lookup
-- master of every truck the company has ever dealt with (owned or market/
-- hired), used to auto-fetch truck details by truck number on the LR form.
-- ============================================================================
set search_path = bgts_os, public;

create table if not exists bgts_os.truck_master (
  id           text primary key,
  code         text not null default '',
  truck_no     text not null default '',
  owner_name   text not null default '',
  contact_no   text not null default '',
  pan_card     boolean not null default false,
  rc_no        boolean not null default false,
  created_by   text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_set_updated_at on bgts_os.truck_master;
create trigger trg_set_updated_at before update on bgts_os.truck_master
  for each row execute function bgts_os.set_updated_at();

alter table bgts_os.truck_master enable row level security;

drop policy if exists authenticated_full_access on bgts_os.truck_master;
create policy authenticated_full_access on bgts_os.truck_master
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on bgts_os.truck_master to authenticated;
