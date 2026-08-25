-- ============================================================================
-- BGTS-OS database schema — migration 0008 (Bill / Invoice module)
-- Run after 0001_schema.sql .. 0007_vendor_directory.sql.
--
-- New, independent module — does NOT alter bgts_os.lrs or any LR / Consignment
-- Notes table. A Bill bundles one or more of the company's own LRs (bill_lines
-- .lr_id is a nullable, read-only reference into bgts_os.lrs — deleting an LR
-- just clears the reference, it never cascades into or blocks the Bill), a
-- fixed LR Charges block (bill_charges, 1:1, mirrors the lr_charges pattern),
-- and a free-form Payment Detail grid of additions/deductions (bill_payments,
-- one table for both, discriminated by `kind` — mirrors the lr_parties role
-- pattern). Vendor is a reference into bgts_os.vendor_directory (the
-- ATTrans-imported register from migration 0007), not bgts_os.vendors, since
-- this Bill screen reproduces that same ATTrans module.
-- ============================================================================
set search_path = bgts_os, public;

create table if not exists bgts_os.bills (
  id               text primary key,
  invoice_no       text not null default '',
  vendor_id        text references bgts_os.vendor_directory (id) on delete set null,
  date             date not null default current_date,
  po_no            text not null default '',
  po_date          date,
  sgst_pct         numeric not null default 0,
  cgst_pct         numeric not null default 0,
  igst_pct         numeric not null default 0,
  round_off        numeric not null default 0,
  advance_receive  numeric not null default 0,
  bank             text not null default '',
  remark           text not null default '',
  subject          text not null default '',
  -- computed snapshot (recomputed client-side on every edit; persisted so
  -- list/report views don't need to re-derive it) — mirrors lrs.sub_total/gross
  total_amount     numeric not null default 0,
  total_addition   numeric not null default 0,
  total_deduction  numeric not null default 0,
  gross_amount     numeric not null default 0,
  sgst_amt         numeric not null default 0,
  cgst_amt         numeric not null default 0,
  igst_amt         numeric not null default 0,
  net_amount       numeric not null default 0,
  balance_amount   numeric not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_bills_vendor on bgts_os.bills (vendor_id);
create index if not exists idx_bills_date on bgts_os.bills (date desc);

-- Bill's LR / consignment line rows — dynamic "+" rows in the UI, always
-- rewritten as a whole array on save (replace-all, like lr_goods). No id in
-- the app's model — surrogate key.
create table if not exists bgts_os.bill_lines (
  id             text primary key default gen_random_uuid()::text,
  bill_id        text not null references bgts_os.bills (id) on delete cascade,
  sort_order     integer not null default 0,
  lr_id          text references bgts_os.lrs (id) on delete set null,
  status         text not null default '',
  lr_no          text not null default '',
  date           date,
  from_place     text not null default '',
  to_place       text not null default '',
  weight         numeric,
  pcs            numeric,
  rate           numeric,
  amount         numeric not null default 0,
  other_charges  numeric not null default 0,
  remark         text not null default ''
);
create index if not exists idx_bill_lines_bill on bgts_os.bill_lines (bill_id, sort_order);
create index if not exists idx_bill_lines_lr on bgts_os.bill_lines (lr_id);

-- LR Charges block — one row per bill (1:1), individual columns per charge
-- type (existing ATTrans options + the two new ones), same shape as
-- lr_charges: nothing flattened into a single opaque total.
create table if not exists bgts_os.bill_charges (
  bill_id        text primary key references bgts_os.bills (id) on delete cascade,
  hamali         numeric not null default 0,
  loading        numeric not null default 0,
  unloading      numeric not null default 0,
  rto_challan    numeric not null default 0,
  varai          numeric not null default 0,
  lr_charges     numeric not null default 0,
  detention      numeric not null default 0,
  other_add      numeric not null default 0,
  dock_charges   numeric not null default 0,
  extra_delivery numeric not null default 0
);

-- Payment Detail grid — additions and deductions share one table
-- (discriminated by `kind`), replace-all like lr_parties. No id in the app's
-- model — surrogate key.
create table if not exists bgts_os.bill_payments (
  id          text primary key default gen_random_uuid()::text,
  bill_id     text not null references bgts_os.bills (id) on delete cascade,
  kind        text not null check (kind in ('addition', 'deduction')),
  sort_order  integer not null default 0,
  type        text not null default '',
  amount      numeric not null default 0
);
create index if not exists idx_bill_payments_bill on bgts_os.bill_payments (bill_id);

drop trigger if exists trg_set_updated_at on bgts_os.bills;
create trigger trg_set_updated_at before update on bgts_os.bills
  for each row execute function bgts_os.set_updated_at();

alter table bgts_os.bills enable row level security;
alter table bgts_os.bill_lines enable row level security;
alter table bgts_os.bill_charges enable row level security;
alter table bgts_os.bill_payments enable row level security;

drop policy if exists authenticated_full_access on bgts_os.bills;
create policy authenticated_full_access on bgts_os.bills
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_full_access on bgts_os.bill_lines;
create policy authenticated_full_access on bgts_os.bill_lines
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_full_access on bgts_os.bill_charges;
create policy authenticated_full_access on bgts_os.bill_charges
  for all to authenticated using (true) with check (true);

drop policy if exists authenticated_full_access on bgts_os.bill_payments;
create policy authenticated_full_access on bgts_os.bill_payments
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on bgts_os.bills to authenticated;
grant select, insert, update, delete on bgts_os.bill_lines to authenticated;
grant select, insert, update, delete on bgts_os.bill_charges to authenticated;
grant select, insert, update, delete on bgts_os.bill_payments to authenticated;
