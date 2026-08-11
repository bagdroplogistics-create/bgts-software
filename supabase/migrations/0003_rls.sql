-- ============================================================================
-- BGTS-OS database schema — migration 0003 (Row Level Security)
-- Run after 0001_schema.sql and 0002_functions.sql.
-- ============================================================================
-- Security model for this rollout: the app has no roles/permissions of its
-- own today (confirmed during the audit — no users table, no login), and you
-- chose "add basic Supabase email/password login" as the minimum needed for
-- RLS to mean anything. That gives us exactly one tier: signed-in vs not.
--
-- So the policy here is: any authenticated Supabase user (anyone who has
-- logged into this app with an email/password you created for them) can
-- read and write every table below — this is a single shared company
-- account model, matching how the app already behaves today (one shared
-- AsyncStorage blob, no per-record ownership). The public "anon" role gets
-- NOTHING — no table is readable or writable without logging in first.
--
-- If you later want real per-role permissions (e.g. a driver login that can
-- only see their own trips), that's a schema + policy change on top of this,
-- not a rewrite — app_users.role already exists as the hook for it.
-- ============================================================================
set search_path = bgts_os, public;

do $$
declare
  t text;
begin
  foreach t in array array[
    'company_settings', 'counters', 'branches', 'clients', 'drivers', 'vendors',
    'vehicles', 'routes', 'contracts', 'contract_rates', 'inquiries', 'bookings',
    'lrs', 'lr_parties', 'lr_goods', 'lr_charges', 'lr_expense_lines', 'lr_hire',
    'lr_hire_payments', 'expenses', 'lr_trip_expenses', 'renewals', 'invoices',
    'invoice_bookings', 'payments', 'bank_txns', 'lhcs', 'lhc_payments',
    'advances', 'acct_expenses', 'billing_backup_bills', 'billing_backup_lines',
    'status_history'
  ]
  loop
    execute format('alter table bgts_os.%I enable row level security;', t);

    -- Wipe any pre-existing policy of the same name so this migration is
    -- safely re-runnable.
    execute format('drop policy if exists authenticated_full_access on bgts_os.%I;', t);

    execute format(
      'create policy authenticated_full_access on bgts_os.%I
         for all
         to authenticated
         using (true)
         with check (true);',
      t
    );
  end loop;
end $$;

-- app_users gets its own, slightly different policy: everyone signed in can
-- see the list (so e.g. status_history can show "changed by so-and-so"), but
-- you can only edit your own profile row. Row creation happens automatically
-- via the trg_handle_new_auth_user trigger (SECURITY DEFINER, bypasses RLS),
-- so there's no insert policy for normal users.
alter table bgts_os.app_users enable row level security;

drop policy if exists app_users_select_all on bgts_os.app_users;
create policy app_users_select_all on bgts_os.app_users
  for select to authenticated using (true);

drop policy if exists app_users_update_own on bgts_os.app_users;
create policy app_users_update_own on bgts_os.app_users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Views don't have RLS of their own — they inherit from the underlying
-- tables' policies as long as they're created with the default (non
-- SECURITY DEFINER) mode, which both views in 0002_functions.sql are. No
-- extra grants needed here.
-- ----------------------------------------------------------------------------

-- Sanity check you can run after applying this file: this should return one
-- row per table above with rowsecurity = true.
-- select relname, relrowsecurity from pg_class
--   join pg_namespace on pg_namespace.oid = pg_class.relnamespace
--   where nspname = 'bgts_os' and relkind = 'r' order by relname;
