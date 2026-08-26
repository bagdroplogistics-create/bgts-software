-- ============================================================================
-- BGTS-OS database schema — migration 0010 (Account Group)
-- Run after 0001_schema.sql .. 0009_tax_master.sql.
--
-- Standalone master imported wholesale from ATTrans's "View Account Group
-- Details" register (6 rows: ASSETS, BANK, CASH, EXPENSES, INCOME,
-- LIABILITIES) — the chart-of-accounts group hierarchy ATTrans's own
-- "Add New Account Group" form's PARENT dropdown draws from. Self-referencing
-- via parent_id (nullable, references this same table) since a group can be
-- nested under another group. Independent of tax_master's free-text
-- "account_group" column — not wired together, kept as its own reference
-- master matching the literal scope of what was asked.
-- ============================================================================
set search_path = bgts_os, public;

create table if not exists bgts_os.account_groups (
  id             text primary key,
  sr_no          integer,
  name           text not null default '',
  parent_id      text references bgts_os.account_groups(id) on delete set null,
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'IN-ACTIVE')),
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_account_groups_sr_no on bgts_os.account_groups (sr_no);
create index if not exists idx_account_groups_parent_id on bgts_os.account_groups (parent_id);

drop trigger if exists trg_set_updated_at on bgts_os.account_groups;
create trigger trg_set_updated_at before update on bgts_os.account_groups
  for each row execute function bgts_os.set_updated_at();

alter table bgts_os.account_groups enable row level security;

drop policy if exists authenticated_full_access on bgts_os.account_groups;
create policy authenticated_full_access on bgts_os.account_groups
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on bgts_os.account_groups to authenticated;
