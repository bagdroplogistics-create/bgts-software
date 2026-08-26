-- ============================================================================
-- BGTS-OS database schema — migration 0012 (LHC / Lorry Hire Contract trips)
-- Run after 0001_schema.sql .. 0011_accounts.sql.
--
-- NEW, independent module mirroring ATTrans's own "ADD NEW LHC" form
-- (screenshot dated 2026-08-26). Deliberately separate from the pre-existing
-- `lhcs` table (0001_schema.sql) used by the older, simpler LHCScreen.js,
-- which is not wired into the app's sidebar navigation. Kept apart so this
-- richer form doesn't reshape or risk breaking that existing table/screen.
-- ============================================================================
set search_path = bgts_os, public;

create table if not exists bgts_os.lhc_trips (
  id                   text primary key,
  lhc_no               text not null default '',
  date                 date,
  truck_no             text not null default '',
  from_place           text not null default '',
  to_place             text not null default '',
  agent                text not null default '',
  lorry_type           text not null default '',
  chasis_no            text not null default '',
  engine_no            text not null default '',
  permit_no            text not null default '',
  insurance_co         text not null default '',
  branch               text not null default '',
  policy_no            text not null default '',
  permit_from          date,
  permit_upto          date,
  insurance_upto       date,
  driver_name          text not null default '',
  driver_address       text not null default '',
  driver_lic_no        text not null default '',
  driver_lic_date      date,
  driver_issued_from   text not null default '',
  driver_mobile        text not null default '',
  owner_name           text not null default '',
  owner_address        text not null default '',
  owner_pan            text not null default '',
  owner_mobile         text not null default '',
  lorry_hire           numeric not null default 0,
  advance              numeric not null default 0,
  pay_to               text not null default '',
  total_addition       numeric not null default 0,
  total_deduction      numeric not null default 0,
  total_expense        numeric not null default 0,
  net_amount           numeric not null default 0,
  balance_amount       numeric not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_lhc_trips_date on bgts_os.lhc_trips (date);
create index if not exists idx_lhc_trips_lhc_no on bgts_os.lhc_trips (lhc_no);

create table if not exists bgts_os.lhc_trip_lines (
  id            text primary key default gen_random_uuid()::text,
  lhc_trip_id   text not null references bgts_os.lhc_trips(id) on delete cascade,
  sort_order    integer not null default 0,
  lr_id         text references bgts_os.lrs(id) on delete set null,
  lr_no         text not null default '',
  date          date,
  content       text not null default '',
  pkgs          numeric,
  weight        numeric
);
create index if not exists idx_lhc_trip_lines_trip on bgts_os.lhc_trip_lines (lhc_trip_id);

create table if not exists bgts_os.lhc_trip_payments (
  id            text primary key default gen_random_uuid()::text,
  lhc_trip_id   text not null references bgts_os.lhc_trips(id) on delete cascade,
  kind          text not null check (kind in ('addition', 'deduction')),
  sort_order    integer not null default 0,
  type          text not null default '',
  amount        numeric not null default 0
);
create index if not exists idx_lhc_trip_payments_trip on bgts_os.lhc_trip_payments (lhc_trip_id);

create table if not exists bgts_os.lhc_trip_expenses (
  id            text primary key default gen_random_uuid()::text,
  lhc_trip_id   text not null references bgts_os.lhc_trips(id) on delete cascade,
  sort_order    integer not null default 0,
  account       text not null default '',
  amount        numeric not null default 0
);
create index if not exists idx_lhc_trip_expenses_trip on bgts_os.lhc_trip_expenses (lhc_trip_id);

drop trigger if exists trg_set_updated_at on bgts_os.lhc_trips;
create trigger trg_set_updated_at before update on bgts_os.lhc_trips
  for each row execute function bgts_os.set_updated_at();

alter table bgts_os.lhc_trips enable row level security;
alter table bgts_os.lhc_trip_lines enable row level security;
alter table bgts_os.lhc_trip_payments enable row level security;
alter table bgts_os.lhc_trip_expenses enable row level security;

drop policy if exists authenticated_full_access on bgts_os.lhc_trips;
create policy authenticated_full_access on bgts_os.lhc_trips for all to authenticated using (true) with check (true);
drop policy if exists authenticated_full_access on bgts_os.lhc_trip_lines;
create policy authenticated_full_access on bgts_os.lhc_trip_lines for all to authenticated using (true) with check (true);
drop policy if exists authenticated_full_access on bgts_os.lhc_trip_payments;
create policy authenticated_full_access on bgts_os.lhc_trip_payments for all to authenticated using (true) with check (true);
drop policy if exists authenticated_full_access on bgts_os.lhc_trip_expenses;
create policy authenticated_full_access on bgts_os.lhc_trip_expenses for all to authenticated using (true) with check (true);

grant select, insert, update, delete on bgts_os.lhc_trips to authenticated;
grant select, insert, update, delete on bgts_os.lhc_trip_lines to authenticated;
grant select, insert, update, delete on bgts_os.lhc_trip_payments to authenticated;
grant select, insert, update, delete on bgts_os.lhc_trip_expenses to authenticated;
