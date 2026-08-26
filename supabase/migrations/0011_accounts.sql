-- ============================================================================
-- BGTS-OS database schema — migration 0011 (Account / Chart of Accounts)
-- Run after 0001_schema.sql .. 0010_account_groups.sql.
--
-- Standalone master imported wholesale from ATTrans's "View Account Details"
-- register (266 rows, screenshots dated 2026-08-26) — the actual ledger
-- account list (customers, banks, charge heads), each tagged with a GROUP
-- name. group_name is free text, NOT a foreign key to account_groups: several
-- accounts use groups ("SUNDRY DEBTORS", "SUNDRY CREDITORS") that don't exist
-- as rows in the 6-row account_groups register — see the note in logic.js's
-- LEGACY_ACCOUNTS. Kept unlinked and flagged rather than forcing a guess.
-- ============================================================================
set search_path = bgts_os, public;

create table if not exists bgts_os.accounts (
  id             text primary key,
  sr_no          integer,
  code           text not null default '',
  description    text not null default '',
  group_name     text not null default '',
  opening_dr     numeric not null default 0,
  opening_cr     numeric not null default 0,
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_accounts_sr_no on bgts_os.accounts (sr_no);
create unique index if not exists idx_accounts_code on bgts_os.accounts (code) where code <> '';
create index if not exists idx_accounts_group_name on bgts_os.accounts (group_name);

drop trigger if exists trg_set_updated_at on bgts_os.accounts;
create trigger trg_set_updated_at before update on bgts_os.accounts
  for each row execute function bgts_os.set_updated_at();

alter table bgts_os.accounts enable row level security;

drop policy if exists authenticated_full_access on bgts_os.accounts;
create policy authenticated_full_access on bgts_os.accounts
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on bgts_os.accounts to authenticated;
