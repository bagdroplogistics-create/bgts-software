-- ============================================================================
-- BGTS-OS database schema — migration 0002 (functions + triggers)
-- Run after 0001_schema.sql, before 0003_rls.sql.
-- ============================================================================
set search_path = bgts_os, public;

-- ----------------------------------------------------------------------------
-- Atomic document numbering (LR-0001, INV-0001, ...). The existing app reads
-- db.seq.lr / .inv / .bk / .lhc / .inq / .mr, increments client-side, and
-- writes it back — safe when there's exactly one browser tab talking to a
-- local AsyncStorage blob, but a real race condition once multiple people can
-- write to the same database at once (two people creating an LR at the same
-- moment could get the same number). This function does the read-increment-
-- write as one atomic statement so numbers are always unique even under
-- concurrent use.
-- Usage from the frontend: select bgts_os.next_counter('lr');
-- ----------------------------------------------------------------------------
create or replace function bgts_os.next_counter(counter_name text)
returns bigint
language plpgsql
security definer
set search_path = bgts_os, public
as $$
declare
  next_val bigint;
begin
  update bgts_os.counters
    set value = value + 1
    where name = counter_name
    returning value into next_val;

  if next_val is null then
    insert into bgts_os.counters (name, value) values (counter_name, 1)
      returning value into next_val;
  end if;

  return next_val;
end;
$$;

-- ----------------------------------------------------------------------------
-- Generic updated_at maintenance — every table with an updated_at column gets
-- this trigger so edits are traceable without every screen having to
-- remember to set it manually.
-- ----------------------------------------------------------------------------
create or replace function bgts_os.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'company_settings', 'branches', 'clients', 'drivers', 'vendors', 'vehicles',
    'contracts', 'inquiries', 'bookings', 'lrs', 'invoices', 'lhcs'
  ]
  loop
    execute format(
      'drop trigger if exists trg_set_updated_at on bgts_os.%I;
       create trigger trg_set_updated_at before update on bgts_os.%I
         for each row execute function bgts_os.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Auto-create an app_users profile row the first time someone signs in via
-- Supabase Auth, so status_history.changed_by has somewhere to join against
-- without a manual setup step per user.
-- ----------------------------------------------------------------------------
create or replace function bgts_os.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = bgts_os, public
as $$
begin
  insert into bgts_os.app_users (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function bgts_os.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- Convenience view: LR with its computed hire balance / trip-expense total,
-- mirroring src/logic.js's lrHireBalance()/lrTripExpTotal() so the frontend
-- can read these instead of re-deriving them from three separate queries.
-- Purely additive — does not replace any table.
-- ----------------------------------------------------------------------------
create or replace view bgts_os.lr_hire_summary as
select
  h.lr_id,
  h.vendor_id,
  h.amount,
  h.advance,
  coalesce(p.paid_total, 0) as paid_total,
  h.amount - h.advance - coalesce(p.paid_total, 0) as balance
from bgts_os.lr_hire h
left join (
  select lr_id, sum(amount) as paid_total
  from bgts_os.lr_hire_payments
  group by lr_id
) p on p.lr_id = h.lr_id;

create or replace view bgts_os.invoice_balances as
select
  i.id as invoice_id,
  i.total,
  coalesce(p.paid_total, 0) as paid_total,
  i.total - coalesce(p.paid_total, 0) as outstanding
from bgts_os.invoices i
left join (
  select invoice_id, sum(amount) as paid_total
  from bgts_os.payments
  group by invoice_id
) p on p.invoice_id = i.id;
