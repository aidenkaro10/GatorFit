-- ============================================================
-- PEAK PULSE DATABASE (Supabase / Postgres)
-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run.
-- Then run seed.sql for the demo data.
--
-- What's in here:
--   1. Tables (profiles, point_logs, events, rsvps, partner sessions, joins, meals)
--   2. Rules the database enforces itself (point values, daily caps, no duplicates)
--   3. Leaderboard views (individual + Greek Life)
--   4. Security (Row Level Security): everyone can see the leaderboard,
--      but you can only change your own stuff
-- ============================================================

-- Gainesville time zone. Used for "today" and "this month".
-- Change this in one place if you ever launch somewhere else.
create or replace function app_timezone() returns text
language sql immutable as $$ select 'America/New_York' $$;

-- "2026-09" style month key for right now, in Gainesville time
create or replace function current_month_key() returns text
language sql stable as $$
  select to_char(now() at time zone app_timezone(), 'YYYY-MM')
$$;


-- ============================================================
-- 1. TABLES
-- ============================================================

-- ---------- Profiles ----------
-- One per person. Real users link to a Supabase login (user_id).
-- Demo users have no login (user_id is empty) and is_demo = true.
create table if not exists profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid unique references auth.users (id) on delete cascade,
  email          text not null unique,
  display_name   text not null check (char_length(trim(display_name)) between 1 and 40),
  -- Any of UF's 63 chapters (the app's dropdown holds the official list), or '' for none
  greek_house    text not null default '' check (char_length(greek_house) <= 60),
  goal_protein_g int not null default 150 check (goal_protein_g > 0),
  goal_carbs_g   int not null default 250 check (goal_carbs_g > 0),
  goal_fat_g     int not null default 70  check (goal_fat_g > 0),
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  -- A real user must have a login. A demo user must not.
  check ((is_demo and user_id is null) or (not is_demo and user_id is not null))
);

-- ---------- Point logs ----------
-- Every point anyone earns is one row here. The leaderboard adds these up.
create table if not exists point_logs (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles (id) on delete cascade,
  kind                text not null check (kind in ('workout', 'macros', 'journal', 'meditation', 'seed')),
  log_date            date not null,                         -- the user's local date
  -- "2026-09" style month, filled in automatically from log_date
  month               text generated always as (
                        extract(year from log_date)::int::text || '-' ||
                        lpad(extract(month from log_date)::int::text, 2, '0')) stored,
  points              int  not null check (points >= 0),
  multiplier          int  not null default 1 check (multiplier in (1, 2, 3)),
  multiplier_reason   text not null default 'none' check (multiplier_reason in
                        ('peak_pulse', 'new_partner', 'uf_event', 'other', 'none')),
  event_types         text[] not null default '{}' check (event_types <@ array['peak_pulse', 'uf_event', 'other']),
  partner_profile_id  uuid references profiles (id) on delete set null,
  created_at          timestamptz not null default now(),

  -- Point values must match the rules. The app can't sneak in 27 points.
  check (
    (kind = 'workout'  and points = 3 * multiplier)
    or (kind in ('macros', 'journal', 'meditation') and points = 1 and multiplier = 1)
    or (kind = 'seed')
  ),
  -- You can't be your own workout partner
  check (partner_profile_id is null or partner_profile_id <> profile_id),
  -- Only workouts have partners and event types
  check (kind = 'workout' or (partner_profile_id is null and event_types = '{}'))
);

-- If an older version of this file already ran, swap the 6-house rule for the new one
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%Sigma Chi%' loop
    execute format('alter table profiles drop constraint %I', c);
  end loop;
end $$;

-- Once per day: macros, journal, meditation (the database blocks a second one)
create unique index if not exists one_per_day_wellness
  on point_logs (profile_id, kind, log_date)
  where kind in ('macros', 'journal', 'meditation');

create index if not exists point_logs_month_idx on point_logs (month, profile_id);

-- ---------- Peak Pulse events ----------
create table if not exists peak_pulse_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  starts_at   timestamptz not null,
  location    text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------- RSVPs ----------
create table if not exists rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references peak_pulse_events (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)            -- no double RSVPs, even on double clicks
);

-- ---------- Find a Partner posts ----------
create table if not exists partner_sessions (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references profiles (id) on delete cascade,
  type       text not null check (type in ('gym', 'run')),
  focus      text not null default '' check (focus in ('', 'arms', 'legs', 'cardio')),
  starts_at  timestamptz not null,
  location   text not null check (char_length(trim(location)) between 1 and 60),
  created_at timestamptz not null default now(),
  -- Runs have no focus. Gym sessions must have one.
  check ((type = 'run' and focus = '') or (type = 'gym' and focus <> ''))
);

-- ---------- Joining a partner post ----------
create table if not exists session_joins (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references partner_sessions (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, profile_id)          -- no double joins
);

-- ---------- Meals ----------
create table if not exists meal_entries (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  log_date   date not null,
  food_name  text not null,
  protein_g  int not null check (protein_g >= 0),
  carbs_g    int not null check (carbs_g >= 0),
  fat_g      int not null check (fat_g >= 0),
  created_at timestamptz not null default now()
);
create index if not exists meal_entries_day_idx on meal_entries (profile_id, log_date);


-- ============================================================
-- 2. RULES THE DATABASE ENFORCES
-- ============================================================

-- Max 2 workouts per day. Checked on every new workout.
-- The advisory lock stops two browser tabs from both sneaking in a 3rd at the same instant.
create or replace function enforce_workout_cap() returns trigger
language plpgsql as $$
begin
  if new.kind = 'workout' then
    perform pg_advisory_xact_lock(hashtext(new.profile_id::text || new.log_date::text));
    if (select count(*) from point_logs
        where profile_id = new.profile_id
          and kind = 'workout'
          and log_date = new.log_date) >= 2 then
      raise exception 'Max 2 workouts a day' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists workout_cap on point_logs;
create trigger workout_cap before insert on point_logs
  for each row execute function enforce_workout_cap();

-- You can't join your own partner post
create or replace function block_self_join() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from partner_sessions
             where id = new.session_id and host_id = new.profile_id) then
    raise exception 'You can''t join your own session' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists no_self_join on session_joins;
create trigger no_self_join before insert on session_joins
  for each row execute function block_self_join();


-- ============================================================
-- 3. LEADERBOARD VIEWS
-- The app reads these instead of adding points up itself.
-- ============================================================

-- This month's points for every profile (0 if they haven't logged anything)
create or replace view month_leaderboard
with (security_invoker = true) as
select
  p.id           as profile_id,
  p.display_name,
  p.greek_house,
  p.is_demo,
  coalesce(sum(l.points), 0)::int as points
from profiles p
left join point_logs l
  on l.profile_id = p.id
 and l.month = current_month_key()
group by p.id;

-- Greek Life board: average of ACTIVE members (more than 0 points this month).
-- on_board is false until a house has 10+ active members.
create or replace view greek_leaderboard
with (security_invoker = true) as
select
  greek_house                         as house,
  count(*)::int                       as active_count,
  round(avg(points)::numeric, 1)      as avg_points,
  count(*) >= 10                      as on_board
from month_leaderboard
where greek_house <> '' and points > 0
group by greek_house;

-- People each user has already worked out with (for the "new partner = 3x" rule)
create or replace view past_partners
with (security_invoker = true) as
select distinct profile_id, partner_profile_id
from point_logs
where kind = 'workout' and partner_profile_id is not null;


-- ============================================================
-- 4. SECURITY (Row Level Security)
-- Signed-in users can SEE everything social (leaderboard, events, posts).
-- They can only CREATE, CHANGE, or DELETE their own rows.
-- Meals stay private.
-- ============================================================

-- Finds the profile that belongs to whoever is signed in
create or replace function my_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid()
$$;

alter table profiles          enable row level security;
alter table point_logs        enable row level security;
alter table peak_pulse_events enable row level security;
alter table rsvps             enable row level security;
alter table partner_sessions  enable row level security;
alter table session_joins     enable row level security;
alter table meal_entries      enable row level security;

-- Profiles: everyone signed in can see names and houses. You make and edit only yours.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated using (true);
drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles for insert to authenticated
  with check (user_id = auth.uid() and is_demo = false);
drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_demo = false);

-- Point logs: everyone can see them (that's the leaderboard). You add only your own.
-- Nobody can edit or delete points from the app. No update/delete policy on purpose.
drop policy if exists points_read on point_logs;
create policy points_read on point_logs for select to authenticated using (true);
drop policy if exists points_insert_own on point_logs;
create policy points_insert_own on point_logs for insert to authenticated
  with check (profile_id = my_profile_id() and kind <> 'seed');

-- Events: read only from the app. Add events in the Supabase dashboard.
drop policy if exists events_read on peak_pulse_events;
create policy events_read on peak_pulse_events for select to authenticated using (true);

-- RSVPs: everyone sees who's going. You add and remove only your own.
drop policy if exists rsvps_read on rsvps;
create policy rsvps_read on rsvps for select to authenticated using (true);
drop policy if exists rsvps_insert_own on rsvps;
create policy rsvps_insert_own on rsvps for insert to authenticated
  with check (profile_id = my_profile_id());
drop policy if exists rsvps_delete_own on rsvps;
create policy rsvps_delete_own on rsvps for delete to authenticated
  using (profile_id = my_profile_id());

-- Partner posts: everyone sees them. You post and delete only your own.
drop policy if exists sessions_read on partner_sessions;
create policy sessions_read on partner_sessions for select to authenticated using (true);
drop policy if exists sessions_insert_own on partner_sessions;
create policy sessions_insert_own on partner_sessions for insert to authenticated
  with check (host_id = my_profile_id());
drop policy if exists sessions_delete_own on partner_sessions;
create policy sessions_delete_own on partner_sessions for delete to authenticated
  using (host_id = my_profile_id());

-- Joins: everyone sees who joined. You join and leave only as yourself.
drop policy if exists joins_read on session_joins;
create policy joins_read on session_joins for select to authenticated using (true);
drop policy if exists joins_insert_own on session_joins;
create policy joins_insert_own on session_joins for insert to authenticated
  with check (profile_id = my_profile_id());
drop policy if exists joins_delete_own on session_joins;
create policy joins_delete_own on session_joins for delete to authenticated
  using (profile_id = my_profile_id());

-- Meals: private. Only you can see, add, or remove yours.
drop policy if exists meals_own on meal_entries;
create policy meals_own on meal_entries for all to authenticated
  using (profile_id = my_profile_id()) with check (profile_id = my_profile_id());

-- Views need read access too
grant select on month_leaderboard, greek_leaderboard, past_partners to authenticated;


-- ============================================================
-- 5. LIVE UPDATES
-- Leaderboard and RSVPs update on everyone's screen without a refresh.
-- ============================================================
-- Safe to run twice: skips tables that are already added.
do $$
declare t text;
begin
  foreach t in array array['point_logs', 'rsvps', 'session_joins', 'partner_sessions'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
