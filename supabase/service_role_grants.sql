-- EnglishX50 — restore the service_role grants on the public schema.
--
-- The Edge Functions (speak-turn, EnglishX50feedback, transcribe, audio…)
-- read x50_students & co. with the service role, which bypasses RLS but
-- still needs ordinary table privileges. Those grants were missing on the
-- x50_* tables and from the schema's default privileges, so every /speak
-- request failed its entitlement check with 503 entitlement_unavailable
-- ("تعذّر التحقق من اشتراكك"). Idempotent — safe to re-run.
--
-- Applied to the live project on 2026-09-04 as migration
-- `restore_service_role_grants`.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tables created later by the dashboard / SQL editor (role postgres) get
-- the same grants automatically.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select, update on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
