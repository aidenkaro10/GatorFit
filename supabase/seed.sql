-- ============================================================
-- PEAK PULSE DEMO DATA
-- Run AFTER schema.sql. Safe to run more than once (it never makes duplicates).
-- Run it again at the start of a new month so the demo board isn't empty.
--
-- Makes: 70 fake students, their points this month, 8 weeks of REAL Peak Pulse runs,
-- RSVPs, and 5 Find a Partner posts. All fake. Delete with the block at the bottom.
-- ============================================================

-- ---------- 70 fake students ----------
-- Houses: 12 Sigma Chi, 11 Kappa Delta, 10 Pi Kappa Alpha, 12 Delta Gamma,
-- 10 Beta Theta Pi, 4 Chi Omega (too small for the board), 11 with no house.
with first_names as (
  select array['Jake','Maya','Chris','Sofia','Tyler','Ava','Marcus','Emma','Jordan','Olivia',
               'Ethan','Isabella','Noah','Mia','Liam','Chloe','Ryan','Zoe','Dylan','Grace',
               'Caleb','Lily','Owen','Hannah','Mason','Ella','Logan','Sara','Lucas','Nina',
               'Aiden','Priya','Diego','Jada','Ben'] as a
), last_names as (
  select array['Carter','Nguyen','Brooks','Rivera','Patel','Kim','Johnson','Lopez','Reed','Martin',
               'Hayes','Diaz','Bennett','Cole','Shah','Ward','Price','Fox','Gray','Stone'] as a
)
insert into profiles (email, display_name, greek_house, is_demo)
select
  'demo' || i || '@peakpulse.demo',
  f.a[(i % 35) + 1] || ' ' || l.a[((i + (i / 35) * 7) % 20) + 1],
  case
    when i < 12 then 'Sigma Chi'
    when i < 23 then 'Kappa Delta'
    when i < 33 then 'Pi Kappa Alpha'
    when i < 45 then 'Delta Gamma'
    when i < 55 then 'Beta Theta Pi'
    when i < 59 then 'Chi Omega'
    else ''
  end,
  true
from generate_series(0, 69) as i, first_names f, last_names l
on conflict (email) do nothing;

-- ---------- Their points this month ----------
-- Everyone gets 10 to 110 points (same numbers every run).
-- The last 4 (no house) get exactly 2, 4, 5, 7, so a new user's first
-- 9 point workout passes EXACTLY 4 people and the gator fires every time.
insert into point_logs (profile_id, kind, log_date, points, multiplier, multiplier_reason)
select
  p.id,
  'seed',
  (now() at time zone app_timezone())::date,
  case n
    when 66 then 2
    when 67 then 4
    when 68 then 5
    when 69 then 7
    else (abs(hashtext('peakpulse-demo-' || n)) % 101) + 10
  end,
  1,
  'none'
from profiles p
cross join lateral (select substring(p.email from 'demo(\d+)@')::int as n) x
where p.is_demo
  and not exists (
    select 1 from point_logs l
    where l.profile_id = p.id and l.kind = 'seed' and l.month = current_month_key()
  );

-- ---------- REAL Peak Pulse events ----------
-- From peakpulseclub.com/pages/locations (Gainesville):
--   Thursday 6pm at Depot Park, Saturday 8am at Afternoon Coffee.
-- Adds every one of those runs for the next 8 weeks.
delete from peak_pulse_events where title in (
  'Sunrise Run + Cold Plunge + Yoga', 'Lake Alice 5K + Plunge',
  'Sunset Yoga + Cold Plunge', 'Saturday Long Run');

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

-- ---------- About 14 RSVPs per event ----------
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

-- ---------- 5 Find a Partner posts in the next 3 days ----------
with today as (select (now() at time zone app_timezone())::date as d),
posts (host_email, type, focus, day_offset, start_time, location) as (values
  ('demo3@peakpulse.demo',  'gym', 'legs',   1, time '17:00', 'Southwest Rec'),
  ('demo14@peakpulse.demo', 'run', '',       1, time '07:00', 'Lake Alice'),
  ('demo27@peakpulse.demo', 'gym', 'arms',   2, time '15:30', 'Student Rec Center'),
  ('demo41@peakpulse.demo', 'gym', 'cardio', 2, time '19:00', 'Southwest Rec'),
  ('demo8@peakpulse.demo',  'run', '',       3, time '18:00', 'Depot Park')
)
insert into partner_sessions (host_id, type, focus, starts_at, location)
select p.id, s.type, s.focus,
       ((t.d + s.day_offset) + s.start_time) at time zone app_timezone(),
       s.location
from posts s
join profiles p on p.email = s.host_email
cross join today t
where not exists (
  select 1 from partner_sessions x
  where x.host_id = p.id and x.location = s.location and x.type = s.type
);


-- ============================================================
-- TO DELETE ALL DEMO DATA LATER (for launch), run just this line:
--   delete from profiles where is_demo;
-- Their points, RSVPs, and posts are deleted with them automatically.
-- Events stay. Delete those in the dashboard if you want.
-- ============================================================
