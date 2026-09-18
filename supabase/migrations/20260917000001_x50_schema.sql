-- EnglishX50 schema, extracted verbatim from the shared Locrativ project
-- (hiqhbxxlbonlyemxuvad) on 2026-09-17 so it can live in its own project.
-- Tables, functions, triggers, RLS policies, grants and storage buckets.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.x50_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  title text NOT NULL,
  video_url text,
  pdf_url text,
  speaking_task text,
  is_locked boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  speaking_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_url text,
  CONSTRAINT x50_challenges_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.x50_challenge_progress (
  user_id uuid NOT NULL,
  challenge_number integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT x50_challenge_progress_pkey PRIMARY KEY (user_id, challenge_number)
);

CREATE TABLE IF NOT EXISTS public.x50_challenge_unlocks (
  user_id uuid NOT NULL,
  challenge_number integer NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT x50_challenge_unlocks_pkey PRIMARY KEY (user_id, challenge_number)
);

CREATE TABLE IF NOT EXISTS public.x50_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by text,
  CONSTRAINT x50_codes_pkey PRIMARY KEY (id),
  CONSTRAINT x50_codes_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.x50_cooldown_skips (
  user_id uuid NOT NULL,
  challenge_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT x50_cooldown_skips_pkey PRIMARY KEY (user_id, challenge_number)
);

CREATE TABLE IF NOT EXISTS public.x50_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  phone text,
  country_code text,
  job text,
  nationality text,
  university text,
  youtube_subscribed text,
  referral text,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT x50_leads_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS x50_leads_phone_idx ON public.x50_leads USING btree (regexp_replace(COALESCE(phone, ''::text), '\D'::text, ''::text, 'g'::text));

CREATE TABLE IF NOT EXISTS public.x50_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  student text,
  challenge_id uuid,
  challenge_number integer,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT x50_notes_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS x50_notes_user_challenge ON public.x50_notes USING btree (user_id, challenge_id);

CREATE TABLE IF NOT EXISTS public.x50_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT x50_reviews_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.x50_settings (
  key text NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT x50_settings_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.x50_speaking_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scenario text NOT NULL,
  level text NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  speaking_seconds numeric(7,1) NOT NULL DEFAULT 0,
  goal_seconds integer NOT NULL DEFAULT 300,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  vocab_json jsonb,
  CONSTRAINT x50_speaking_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT x50_speaking_conversations_goal_seconds_check CHECK (((goal_seconds > 0) AND (goal_seconds <= 300))),
  CONSTRAINT x50_speaking_conversations_speaking_cap_check CHECK (((speaking_seconds >= (0)::numeric) AND (speaking_seconds <= (goal_seconds)::numeric))),
  CONSTRAINT x50_speaking_conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text])))
);
CREATE INDEX IF NOT EXISTS x50_speaking_conversations_user_started_idx ON public.x50_speaking_conversations USING btree (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.x50_speaking_turns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scenario text NOT NULL,
  level text NOT NULL,
  transcript text NOT NULL,
  reply text NOT NULL,
  feedback jsonb,
  speaking_seconds numeric(6,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  conversation_id uuid,
  audio_path text,
  CONSTRAINT x50_speaking_turns_pkey PRIMARY KEY (id),
  CONSTRAINT x50_speaking_turns_speaking_cap_check CHECK (((speaking_seconds >= (0)::numeric) AND (speaking_seconds <= (300)::numeric))),
  CONSTRAINT x50_speaking_turns_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.x50_speaking_conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS x50_speaking_turns_user_created_idx ON public.x50_speaking_turns USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS x50_speaking_turns_conversation_idx ON public.x50_speaking_turns USING btree (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.x50_students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text,
  phone text,
  job text,
  university text,
  code text,
  code_redeemed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  emma_intro_seen_at timestamptz,
  emma_gift_claimed_at timestamptz,
  CONSTRAINT x50_students_pkey PRIMARY KEY (id),
  CONSTRAINT x50_students_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS x50_students_user_id_key ON public.x50_students USING btree (user_id);

CREATE TABLE IF NOT EXISTS public.x50_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  challenge_id text,
  challenge_number integer,
  student text,
  question text,
  transcript text,
  score integer,
  on_topic boolean,
  complete_sentence_count integer,
  passed boolean,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  mistakes_json jsonb DEFAULT '[]'::jsonb,
  vocabulary_json jsonb DEFAULT '[]'::jsonb,
  strengths_json jsonb DEFAULT '[]'::jsonb,
  weaknesses_json jsonb DEFAULT '[]'::jsonb,
  corrected_sentences_json jsonb DEFAULT '[]'::jsonb,
  audio_key text,
  user_id uuid,
  CONSTRAINT x50_submissions_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS x50_submissions_user_id_idx ON public.x50_submissions USING btree (user_id);

CREATE TABLE IF NOT EXISTS public.x50_trials (
  user_id uuid NOT NULL,
  task_id text NOT NULL,
  used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  bonus integer NOT NULL DEFAULT 0,
  CONSTRAINT x50_trials_pkey PRIMARY KEY (user_id, task_id)
);

CREATE TABLE IF NOT EXISTS public.x50_video_progress (
  user_id uuid NOT NULL,
  video_id text NOT NULL,
  challenge_id uuid,
  challenge_number integer,
  position_seconds numeric NOT NULL DEFAULT 0,
  max_reached_seconds numeric NOT NULL DEFAULT 0,
  duration_seconds numeric,
  watched_percent integer NOT NULL DEFAULT 0,
  watched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT x50_video_progress_pkey PRIMARY KEY (user_id, video_id),
  CONSTRAINT x50_video_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS x50_video_progress_challenge_idx ON public.x50_video_progress USING btree (user_id, challenge_id);

CREATE TABLE IF NOT EXISTS public.x50_video_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student text,
  video_id text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  watched_percent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  CONSTRAINT x50_video_views_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS x50_video_views_user_id_idx ON public.x50_video_views USING btree (user_id, video_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.x50_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_challenge_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_cooldown_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_speaking_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_speaking_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x50_video_views ENABLE ROW LEVEL SECURITY;

DO $pol$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'x50%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $pol$;

CREATE POLICY x50_cp_update ON public.x50_challenge_progress FOR UPDATE TO public USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY x50_cp_insert ON public.x50_challenge_progress FOR INSERT TO public WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY x50_cp_select ON public.x50_challenge_progress FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_cu_insert ON public.x50_challenge_unlocks FOR INSERT TO public WITH CHECK ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_cu_select ON public.x50_challenge_unlocks FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_cu_delete ON public.x50_challenge_unlocks FOR DELETE TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_challenges_all ON public.x50_challenges FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "admin writes - challenges" ON public.x50_challenges FOR ALL TO authenticated USING (((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'siramrhadid@gmail.com'::text)) WITH CHECK (((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_challenges_update ON public.x50_challenges FOR UPDATE TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)) WITH CHECK ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_challenges_select ON public.x50_challenges FOR SELECT TO public USING (true);
CREATE POLICY x50_challenges_insert ON public.x50_challenges FOR INSERT TO public WITH CHECK ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_challenges_delete ON public.x50_challenges FOR DELETE TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_codes_admin_all ON public.x50_codes FOR ALL TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)) WITH CHECK ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY "admin writes - codes" ON public.x50_codes FOR ALL TO authenticated USING (((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'siramrhadid@gmail.com'::text)) WITH CHECK (((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_cs_delete ON public.x50_cooldown_skips FOR DELETE TO public USING (true);
CREATE POLICY x50_cs_select ON public.x50_cooldown_skips FOR SELECT TO public USING (true);
CREATE POLICY x50_cs_insert ON public.x50_cooldown_skips FOR INSERT TO public WITH CHECK (true);
CREATE POLICY x50_leads_insert ON public.x50_leads FOR INSERT TO public WITH CHECK (true);
CREATE POLICY x50_leads_admin_select ON public.x50_leads FOR SELECT TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_leads_admin_update ON public.x50_leads FOR UPDATE TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)) WITH CHECK ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_leads_admin_delete ON public.x50_leads FOR DELETE TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_notes_update_own ON public.x50_notes FOR UPDATE TO public USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY x50_notes_insert_own ON public.x50_notes FOR INSERT TO public WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY x50_notes_select_own ON public.x50_notes FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_reviews_all ON public.x50_reviews FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY x50_reviews_insert ON public.x50_reviews FOR INSERT TO public WITH CHECK ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_reviews_select ON public.x50_reviews FOR SELECT TO public USING (true);
CREATE POLICY "admin writes - reviews" ON public.x50_reviews FOR ALL TO authenticated USING (((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'siramrhadid@gmail.com'::text)) WITH CHECK (((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_reviews_delete ON public.x50_reviews FOR DELETE TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_settings_admin_all ON public.x50_settings FOR ALL TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)) WITH CHECK ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_speaking_conversations_select ON public.x50_speaking_conversations FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_speaking_turns_select ON public.x50_speaking_turns FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY "users can update own row" ON public.x50_students FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "admin reads - students" ON public.x50_students FOR SELECT TO authenticated USING ((((( SELECT auth.jwt() AS jwt) ->> 'email'::text) = 'siramrhadid@gmail.com'::text) OR (( SELECT auth.uid() AS uid) = user_id)));
CREATE POLICY "users can insert own row" ON public.x50_students FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "users can read own row" ON public.x50_students FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY x50_students_select_own ON public.x50_students FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_submissions_delete_admin ON public.x50_submissions FOR DELETE TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_submissions_update_admin ON public.x50_submissions FOR UPDATE TO public USING ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)) WITH CHECK ((lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text));
CREATE POLICY x50_submissions_select ON public.x50_submissions FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_submissions_insert ON public.x50_submissions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "anon can insert submissions" ON public.x50_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY x50_trials_select_own ON public.x50_trials FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_video_progress_insert ON public.x50_video_progress FOR INSERT TO public WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY x50_video_progress_select ON public.x50_video_progress FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_video_progress_update ON public.x50_video_progress FOR UPDATE TO public USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY x50_video_views_select ON public.x50_video_views FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_video_views_all ON public.x50_video_views FOR ALL TO public USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Table grants (as on the source project)
-- ---------------------------------------------------------------------------
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_challenge_progress TO service_role, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_challenge_unlocks TO service_role, authenticated, anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_challenges TO service_role, authenticated, anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_codes TO service_role, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_cooldown_skips TO service_role, authenticated, anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_leads TO service_role, authenticated, anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_notes TO service_role, authenticated, anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_reviews TO service_role, authenticated, anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_settings TO service_role, authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_speaking_conversations TO service_role;
GRANT SELECT ON public.x50_speaking_conversations TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_speaking_turns TO service_role;
GRANT SELECT ON public.x50_speaking_turns TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_students TO service_role;
GRANT SELECT ON public.x50_students TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_submissions TO service_role, authenticated, anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_trials TO service_role;
GRANT SELECT ON public.x50_trials TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_video_progress TO service_role, authenticated, anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.x50_video_views TO service_role, authenticated, anon;
-- The x50_students policies allow own-row INSERT/UPDATE but the source project
-- only granted SELECT to authenticated; the app writes through SECURITY DEFINER
-- functions. Kept identical.

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.x50_challenge_video_uids(videos jsonb, video_url text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when videos is not null
     and jsonb_typeof(videos) = 'array'
     and exists (
       select 1 from jsonb_array_elements(videos) e
       where trim(coalesce(e ->> 'uid', '')) <> ''
     )
    then (
      select array_agg(trim(e ->> 'uid'))
      from jsonb_array_elements(videos) e
      where trim(coalesce(e ->> 'uid', '')) <> ''
    )
    when trim(coalesce(video_url, '')) <> '' then array[trim(video_url)]
    else array[]::text[]
  end
$function$;

CREATE OR REPLACE FUNCTION public.x50_check_code(p_code text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (
      select case when c.used_at is null then 'valid' else 'used' end
      from public.x50_codes c
      where upper(c.code) = upper(trim(p_code))
      limit 1
    ),
    'invalid'
  )
$function$;

CREATE OR REPLACE FUNCTION public.x50_redeem_code(p_code text, p_name text, p_job text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_code  public.x50_codes%rowtype;
  v_now   timestamptz := now();
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  select * into v_code
  from public.x50_codes
  where upper(code) = upper(trim(p_code))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_code.used_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;

  update public.x50_codes
  set used_at = v_now,
      used_by = trim(p_name) || ' - ' || trim(p_job)
  where id = v_code.id;

  update public.x50_students
  set name = trim(p_name),
      job  = trim(p_job),
      phone = trim(p_phone),
      code = v_code.code,
      code_redeemed_at = v_now
  where user_id = v_uid;

  if not found then
    insert into public.x50_students (user_id, phone, name, job, code, code_redeemed_at)
    values (v_uid, trim(p_phone), trim(p_name), trim(p_job), v_code.code, v_now);
  end if;

  -- Mark the matching lead as paid (most recent unpaid one with this phone).
  if v_phone is not null then
    update public.x50_leads
    set paid = true, paid_at = v_now
    where id = (
      select id from public.x50_leads
      where not paid
        and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
      order by created_at desc
      limit 1
    );
  end if;

  return jsonb_build_object('ok', true, 'redeemed_at', v_now);
end;
$function$;

CREATE OR REPLACE FUNCTION public.x50_adjust_subscription(p_user uuid, p_delta_days integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_delta integer := coalesce(p_delta_days, 0);
  v_redeemed timestamptz;
  v_code text;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'siramrhadid@gmail.com' then
    raise exception 'not authorized';
  end if;
  if v_delta = 0 then
    raise exception 'delta must be non-zero';
  end if;
  if abs(v_delta) > 3650 then
    raise exception 'delta out of range';
  end if;

  select code_redeemed_at, code into v_redeemed, v_code
  from public.x50_students where user_id = p_user;

  if not found then
    raise exception 'student not found';
  end if;

  if v_redeemed is null then
    if v_delta < 0 then
      raise exception 'student has no subscription to shorten';
    end if;
    v_redeemed := now() - make_interval(days => 100 - v_delta);
  else
    v_redeemed := v_redeemed + make_interval(days => v_delta);
  end if;

  update public.x50_students
  set code_redeemed_at = v_redeemed,
      code = coalesce(code, 'ADMIN')
  where user_id = p_user;

  return 100 - floor(extract(epoch from (now() - v_redeemed)) / 86400)::integer;
end;
$function$;

CREATE OR REPLACE FUNCTION public.x50_claim_emma_intro()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  update public.x50_students
  set emma_intro_seen_at = now()
  where user_id = v_uid
    and emma_intro_seen_at is null;

  return jsonb_build_object('ok', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.x50_consume_trial(p_user uuid, p_task text, p_max integer DEFAULT 2)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_used integer;
begin
  insert into public.x50_trials as t (user_id, task_id, used)
  values (p_user, p_task, 1)
  on conflict (user_id, task_id) do update
    set used = t.used + 1, updated_at = now()
    where t.used < p_max + coalesce(t.bonus, 0)
  returning t.used into v_used;

  if v_used is null then
    return -1;
  end if;
  return v_used;
end;
$function$;

CREATE OR REPLACE FUNCTION public.x50_grant_trials(p_user uuid, p_task text, p_bonus integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bonus integer := greatest(coalesce(p_bonus, 0), 0);
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'siramrhadid@gmail.com' then
    raise exception 'not authorized';
  end if;

  insert into public.x50_trials as t (user_id, task_id, used, bonus)
  values (p_user, p_task, 0, v_bonus)
  on conflict (user_id, task_id) do update
    set bonus = v_bonus, updated_at = now();

  return v_bonus;
end;
$function$;

CREATE OR REPLACE FUNCTION public.x50_maybe_grant_emma_gift(p_user uuid, p_min_seconds numeric DEFAULT 60, p_required integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_already timestamptz;
  v_count integer;
begin
  select emma_gift_claimed_at into v_already from public.x50_students where user_id = p_user;
  if v_already is not null then
    return jsonb_build_object('granted', false, 'alreadyClaimed', true);
  end if;

  select count(*) into v_count
  from public.x50_speaking_conversations
  where user_id = p_user
    and status = 'completed'
    and speaking_seconds >= p_min_seconds;

  if v_count < p_required then
    return jsonb_build_object('granted', false, 'alreadyClaimed', false, 'count', v_count);
  end if;

  update public.x50_students
  set emma_gift_claimed_at = now(),
      code_redeemed_at = case
        when code_redeemed_at is not null then code_redeemed_at - interval '20 days'
        else code_redeemed_at
      end
  where user_id = p_user
    and emma_gift_claimed_at is null;

  return jsonb_build_object('granted', true, 'alreadyClaimed', false, 'count', v_count);
end;
$function$;

CREATE OR REPLACE FUNCTION public.x50_record_challenge_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  uids text[];
  missing integer;
begin
  if new.watched_at is null then
    return new;
  end if;
  for c in select id, number, videos, video_url from public.x50_challenges loop
    uids := public.x50_challenge_video_uids(c.videos, c.video_url);
    if uids is null or coalesce(array_length(uids, 1), 0) = 0 then
      continue;
    end if;
    if not (new.video_id = any (uids)) then
      continue;
    end if;
    select count(*) into missing
    from unnest(uids) as u(video_id)
    where not exists (
      select 1 from public.x50_video_progress p
      where p.user_id = new.user_id
        and p.video_id = u.video_id
        and p.watched_at is not null
    );
    if missing = 0 then
      insert into public.x50_challenge_progress (user_id, challenge_number, completed_at)
      values (new.user_id, c.number, now())
      on conflict (user_id, challenge_number) do nothing;
    end if;
  end loop;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.x50_video_progress_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  new.watched_percent := least(100, greatest(0, coalesce(new.watched_percent, 0)));
  if tg_op = 'UPDATE' then
    new.watched_percent := greatest(new.watched_percent, old.watched_percent);
    new.max_reached_seconds := greatest(coalesce(new.max_reached_seconds, 0), old.max_reached_seconds);
    new.duration_seconds := coalesce(new.duration_seconds, old.duration_seconds);
    new.challenge_id := coalesce(new.challenge_id, old.challenge_id);
    new.challenge_number := coalesce(new.challenge_number, old.challenge_number);
    new.watched_at := coalesce(old.watched_at, new.watched_at);
    new.created_at := old.created_at;
  end if;
  if new.watched_at is null and new.watched_percent >= 90 then
    new.watched_at := now();
  end if;
  return new;
end;
$function$;

-- Function grants (as on the source project)
REVOKE EXECUTE ON FUNCTION public.x50_adjust_subscription(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.x50_check_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.x50_claim_emma_intro() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.x50_consume_trial(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.x50_grant_trials(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.x50_maybe_grant_emma_gift(uuid, numeric, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.x50_redeem_code(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.x50_adjust_subscription(uuid, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.x50_challenge_video_uids(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.x50_check_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.x50_claim_emma_intro() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.x50_consume_trial(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.x50_grant_trials(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.x50_maybe_grant_emma_gift(uuid, numeric, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.x50_record_challenge_completion() TO service_role;
GRANT EXECUTE ON FUNCTION public.x50_redeem_code(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.x50_video_progress_guard() TO service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS x50_video_progress_guard ON public.x50_video_progress;
CREATE TRIGGER x50_video_progress_guard BEFORE INSERT OR UPDATE ON public.x50_video_progress FOR EACH ROW EXECUTE FUNCTION public.x50_video_progress_guard();
DROP TRIGGER IF EXISTS x50_record_challenge_completion ON public.x50_video_progress;
CREATE TRIGGER x50_record_challenge_completion AFTER INSERT OR UPDATE OF watched_at ON public.x50_video_progress FOR EACH ROW EXECUTE FUNCTION public.x50_record_challenge_completion();

-- ---------------------------------------------------------------------------
-- Storage buckets and object policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('x50-files', 'x50-files', true),
  ('x50-reviews', 'x50-reviews', true),
  ('x50-speaking-audio', 'x50-speaking-audio', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS x50_files_obj_select ON storage.objects;
DROP POLICY IF EXISTS x50_files_obj_insert ON storage.objects;
DROP POLICY IF EXISTS x50_files_obj_delete ON storage.objects;
DROP POLICY IF EXISTS x50_reviews_obj_select ON storage.objects;
DROP POLICY IF EXISTS x50_reviews_obj_insert ON storage.objects;
DROP POLICY IF EXISTS x50_reviews_obj_delete ON storage.objects;
DROP POLICY IF EXISTS x50_speaking_audio_obj_select ON storage.objects;
CREATE POLICY x50_files_obj_select ON storage.objects FOR SELECT TO public USING ((bucket_id = 'x50-files'::text));
CREATE POLICY x50_files_obj_insert ON storage.objects FOR INSERT TO public WITH CHECK (((bucket_id = 'x50-files'::text) AND (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_files_obj_delete ON storage.objects FOR DELETE TO public USING (((bucket_id = 'x50-files'::text) AND (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_reviews_obj_select ON storage.objects FOR SELECT TO public USING ((bucket_id = 'x50-reviews'::text));
CREATE POLICY x50_reviews_obj_insert ON storage.objects FOR INSERT TO public WITH CHECK (((bucket_id = 'x50-reviews'::text) AND (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_reviews_obj_delete ON storage.objects FOR DELETE TO public USING (((bucket_id = 'x50-reviews'::text) AND (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
CREATE POLICY x50_speaking_audio_obj_select ON storage.objects FOR SELECT TO public USING (((bucket_id = 'x50-speaking-audio'::text) AND (lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)) = 'siramrhadid@gmail.com'::text)));
