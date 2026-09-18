-- ============================================================
-- GATORFIT DATABASE UPDATE #1
-- For a database that already ran the FIRST schema.sql and seed.sql.
-- Run this whole file once: SQL Editor > New query > paste > Run.
-- Safe to run more than once.
--
-- What it changes:
--   1. Lets people pick ANY of UF's 63 fraternities and sororities
--      (the first version only allowed 6).
--   2. Swaps the 4 made-up events for the REAL Peak Pulse Gainesville runs
--      (Thursday 6pm at Depot Park, Saturday 8am at Afternoon Coffee),
--      for the next 8 weeks, with demo students already going.
-- ============================================================

-- ---------- 1. Allow all 63 UF chapters ----------
-- Remove the old rule that only allowed 6 houses
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%Sigma Chi%' loop
    execute format('alter table profiles drop constraint %I', c);
  end loop;
end $$;

-- New rule: any house name up to 60 characters ('' means no house).
-- The app's dropdown holds the official list of all 63 chapters.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_greek_house_length') then
    alter table profiles add constraint profiles_greek_house_length check (char_length(greek_house) <= 60);
  end if;
end $$;

-- ---------- 2. Real Peak Pulse events ----------
-- Delete the 4 made-up events (their RSVPs are deleted with them)
delete from peak_pulse_events where title in (
  'Sunrise Run + Cold Plunge + Yoga', 'Lake Alice 5K + Plunge',
  'Sunset Yoga + Cold Plunge', 'Saturday Long Run');

-- Add every Thursday and Saturday run for the next 8 weeks (Gainesville time)
with days as (
  select d::date as d
  from generate_series((now() at time zone app_timezone())::date,
                       (now() at time zone app_timezone())::date + 56, interval '1 day') as d
),
runs as (
  select 'Thursday Run Club' as title, d + time '18:00' as local_start, 'Depot Park' as location,
         'The weekly Peak Pulse run. All faces, all paces. Instagram: @peakpulsegville' as description
  from days where extract(dow from d) = 4
  union all
  select 'Saturday Morning Run', d + time '08:00', 'Afternoon Coffee',
         'Weekend run from Afternoon Coffee, then hang after. Instagram: @peakpulsegville'
  from days where extract(dow from d) = 6
)
insert into peak_pulse_events (title, starts_at, location, description)
select r.title, r.local_start at time zone app_timezone(), r.location, r.description
from runs r
where not exists (
  select 1 from peak_pulse_events x
  where x.title = r.title and x.starts_at = r.local_start at time zone app_timezone()
);

-- About 14 demo students going to each run
with demo as (
  select p.id, substring(p.email from 'demo(\d+)@')::int as n
  from profiles p where p.is_demo
),
ev as (
  select id, row_number() over (order by starts_at) - 1 as k
  from peak_pulse_events
)
insert into rsvps (event_id, profile_id)
select ev.id, demo.id
from ev join demo on (demo.n * 7 + ev.k) % 5 = 0
on conflict (event_id, profile_id) do nothing;

-- ---------- Check it worked ----------
-- You should see the real runs (Thursday Run Club / Saturday Morning Run) with about 14 going each.
select e.title, to_char(e.starts_at at time zone app_timezone(), 'Dy Mon DD, HH12:MI AM') as starts,
       e.location, count(r.id) as going
from peak_pulse_events e
left join rsvps r on r.event_id = e.id
group by e.id
order by e.starts_at
limit 6;
