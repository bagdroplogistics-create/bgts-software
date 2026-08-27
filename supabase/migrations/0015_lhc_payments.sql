-- ============================================================================
-- BGTS-OS database schema — migration 0015 (LHC Balance Payment ledger)
-- Run after 0001_schema.sql .. 0014_lhc_trips_image.sql.
--
-- NEW module mirroring ATTrans's own "VIEW LHC BALANCE PAYMENT DETAILS" /
-- "ADD NEW LHC BALANCE PAYMENT" screens (screenshots dated 2026-08-27). Each
-- row is one payment made against one LHC trip (bgts_os.lhc_trips). This is
-- a flat, standalone table (no child tables) — one payment per row.
--
-- NAMING: this table is bgts_os.lhc_balance_payments, NOT lhc_payments.
-- bgts_os.lhc_payments already exists (0001_schema.sql, line ~533) as the
-- child-payments table of the older, unwired LHCScreen.js / bgts_os.lhcs
-- (columns: lhc_id, date, amount, mode, ref — no lhc_trip_id at all). An
-- earlier version of this migration reused the name "lhc_payments" and hit
-- ERROR 42703 ("column lhc_trip_id does not exist") because CREATE TABLE IF
-- NOT EXISTS silently no-opped against that pre-existing, differently-
-- shaped table, and the CREATE INDEX on lhc_trip_id then failed. That old
-- table is untouched by this migration.
--
-- Paid / Pending formula used by the app (see logic.js's lhcPaidTotal /
-- lhcPendingAmount): PAID(trip) = sum(lhc_balance_payments.amount where
-- lhc_trip_id = trip.id); PENDING(trip) = trip.lorry_hire − PAID(trip). This
-- is a transparent running-ledger design, not a reverse-engineered replica
-- of ATTrans's own internal Paid/Pending calculation — the source register
-- has data (see logic.js's LEGACY_LHC_PAYMENTS doc comment) that doesn't let
-- that internal logic be reconstructed reliably.
-- ============================================================================
set search_path = bgts_os, public;

create table if not exists bgts_os.lhc_balance_payments (
  id             text primary key,
  voucher_no     text not null default '',
  sr_no          integer,
  lhc_trip_id    text not null references bgts_os.lhc_trips(id) on delete cascade,
  lhc_no         text not null default '',
  date           date,
  owner_name     text not null default '',
  agent_name     text not null default '',
  pay_to         text not null default '',
  amount         numeric not null default 0,
  other_add      numeric,
  other_less     numeric,
  payment_type   text not null default '',
  mode           text not null default '',
  cash_amount    numeric,
  bank_amount    numeric,
  name           text not null default '',
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_lhc_balance_payments_trip on bgts_os.lhc_balance_payments (lhc_trip_id);
create index if not exists idx_lhc_balance_payments_lhc_no on bgts_os.lhc_balance_payments (lhc_no);
create index if not exists idx_lhc_balance_payments_sr_no on bgts_os.lhc_balance_payments (sr_no);

drop trigger if exists trg_set_updated_at on bgts_os.lhc_balance_payments;
create trigger trg_set_updated_at before update on bgts_os.lhc_balance_payments
  for each row execute function bgts_os.set_updated_at();

alter table bgts_os.lhc_balance_payments enable row level security;

drop policy if exists authenticated_full_access on bgts_os.lhc_balance_payments;
create policy authenticated_full_access on bgts_os.lhc_balance_payments
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on bgts_os.lhc_balance_payments to authenticated;
