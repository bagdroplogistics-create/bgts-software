-- ============================================================================
-- BGTS-OS database schema — migration 0006
-- Run after 0001_schema.sql, 0002_functions.sql, 0003_rls.sql, 0004_grants.sql,
-- 0005_truck_master.sql.
--
-- Adds:
--   1. bgts_os.clients.credit_limit           (credit control)
--   2. bgts_os.vehicles.*                     (vehicle detail: identity, EMI/
--      finance, odometer — document expiries continue to use the existing
--      bgts_os.renewals table, not new columns here, so there is only one
--      expiry-tracking module)
--   3. bgts_os.expenses.*                     (service/maintenance record
--      detail: odometer at service, service type, vendor, parts, next due)
--   4. bgts_os.lenders                        (new table — Debt Service
--      Calendar / Lender Register)
--   5. bgts_os.fixed_exp                      (new table — Monthly Fixed
--      Expenses)
--   6. bgts_os.audit_log                      (new table — append-only audit
--      trail, e.g. credit-limit overrides)
-- ============================================================================
set search_path = bgts_os, public;

-- 1. clients.credit_limit ----------------------------------------------------
alter table bgts_os.clients
  add column if not exists credit_limit numeric not null default 0;

-- 2. vehicles.* ---------------------------------------------------------------
alter table bgts_os.vehicles
  add column if not exists model              text,
  add column if not exists status             text not null default 'Active',
  add column if not exists capacity_tons      numeric,
  add column if not exists fuel_type          text,
  add column if not exists year_of_mfg        numeric,
  add column if not exists chassis_no         text,
  add column if not exists engine_no          text,
  add column if not exists rc_no              text,
  add column if not exists odometer_km        numeric,
  add column if not exists purchase_date      date,
  add column if not exists purchase_price     numeric,
  add column if not exists financier          text,
  add column if not exists loan_amount        numeric,
  add column if not exists emi_amount         numeric,
  add column if not exists emi_start_date     date,
  add column if not exists emi_tenure_months  numeric;

-- 3. expenses.* (service/maintenance detail) ----------------------------------
alter table bgts_os.expenses
  add column if not exists odometer_at_service    numeric,
  add column if not exists service_type           text,
  add column if not exists vendor                 text,
  add column if not exists parts_replaced          text,
  add column if not exists next_service_due_km    numeric,
  add column if not exists next_service_due_date  date,
  add column if not exists warranty_until          date;

-- 4. lenders --------------------------------------------------------------
create table if not exists bgts_os.lenders (
  id                  text primary key,
  name                text not null default '',
  type                text not null default 'Bank',
  sanctioned_amount   numeric,
  outstanding_amount  numeric,
  interest_rate       numeric,
  emi_amount          numeric,
  next_due_date       date,
  tenure_months       numeric,
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
drop trigger if exists trg_set_updated_at on bgts_os.lenders;
create trigger trg_set_updated_at before update on bgts_os.lenders
  for each row execute function bgts_os.set_updated_at();

-- 5. fixed_exp --------------------------------------------------------------
create table if not exists bgts_os.fixed_exp (
  id                 text primary key,
  head               text not null default '',
  category           text not null default 'Salary',
  amount             numeric,
  linked_vehicle_id  text references bgts_os.vehicles (id) on delete set null,
  frequency          text not null default 'Monthly',
  active             boolean not null default true,
  notes              text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_fixed_exp_vehicle on bgts_os.fixed_exp (linked_vehicle_id);
drop trigger if exists trg_set_updated_at on bgts_os.fixed_exp;
create trigger trg_set_updated_at before update on bgts_os.fixed_exp
  for each row execute function bgts_os.set_updated_at();

-- 6. audit_log — append-only, no updated_at/no update trigger needed --------
create table if not exists bgts_os.audit_log (
  id          text primary key,
  ts          timestamptz not null default now(),
  action      text not null default '',
  details     text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_log_ts on bgts_os.audit_log (ts desc);

-- RLS ------------------------------------------------------------------------
alter table bgts_os.lenders enable row level security;
alter table bgts_os.fixed_exp enable row level security;
alter table bgts_os.audit_log enable row level security;

drop policy if exists authenticated_full_access on bgts_os.lenders;
create policy authenticated_full_access on bgts_os.lenders
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_full_access on bgts_os.fixed_exp;
create policy authenticated_full_access on bgts_os.fixed_exp
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_full_access on bgts_os.audit_log;
create policy authenticated_full_access on bgts_os.audit_log
  for all to authenticated using (true) with check (true);

-- Grants -----------------------------------------------------------------
grant select, insert, update, delete on bgts_os.lenders to authenticated;
grant select, insert, update, delete on bgts_os.fixed_exp to authenticated;
grant select, insert, update, delete on bgts_os.audit_log to authenticated;
