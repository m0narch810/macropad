-- Beta lockdown: cut off direct anon/authenticated access to macro_series.
--
-- Run this ONCE against the live Supabase project (SQL editor or migrate.mjs).
-- After this, the only way to read the table is server-side with the
-- service_role key. The public anon key shipped in the browser bundle grants
-- nothing on this table, so nobody can pull the raw data (values, notes,
-- source column, history) by extracting the key and calling the REST API
-- directly.
--
-- Verify afterwards from the browser console on the live site with the anon
-- key: a select against macro_series should return an empty array / permission
-- error, and the app itself should keep working (it reads via service_role).

alter table macro_series enable row level security;

drop policy if exists "public read" on macro_series;

revoke all on macro_series from anon, authenticated;
