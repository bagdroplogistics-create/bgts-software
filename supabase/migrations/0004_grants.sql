-- ============================================================================
-- BGTS-OS database schema — migration 0004 (schema/table grants)
-- Run after 0001, 0002, 0003.
-- ============================================================================
-- Fixes "permission denied for schema bgts_os". Row Level Security policies
-- (0003_rls.sql) control which ROWS a role can see/change, but Postgres also
-- requires separate GRANT privileges before a role can touch a schema or
-- table at all. Supabase auto-configures these grants for the "public"
-- schema, but bgts_os is a custom schema created by 0001 — it starts with no
-- grants for anyone, which is why every request from the app (signed in as
-- "authenticated") was rejected before reaching the RLS policies at all.
-- ============================================================================
set search_path = bgts_os, public;

grant usage on schema bgts_os to authenticated;
grant select, insert, update, delete on all tables in schema bgts_os to authenticated;
grant execute on all functions in schema bgts_os to authenticated;

-- Make sure this keeps applying to anything created later too (harmless if
-- nothing new is ever added, but future-proofs the fix).
alter default privileges in schema bgts_os grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema bgts_os grant execute on functions to authenticated;

-- Views (lr_hire_summary, invoice_balances) are covered by the table grant
-- above since Postgres treats them as relations too, but being explicit
-- costs nothing and avoids relying on that implicitly.
grant select on bgts_os.lr_hire_summary, bgts_os.invoice_balances to authenticated;
