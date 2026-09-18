# Peak Pulse Database (Supabase)

## Files
- `schema.sql`: all tables, rules, leaderboard views, and security. Run first.
- `seed.sql`: 70 fake students, points, 4 events, RSVPs, 5 partner posts. Run second.

## Set it up
1. Go to supabase.com and sign in.
2. Click New project. Name it `peak-pulse`. Pick a database password and save it somewhere.
3. Wait about 2 minutes for it to finish.
4. In the left sidebar, click SQL Editor.
5. Click New query.
6. Open `schema.sql`, copy all of it, paste it in, click Run.
7. Click New query again.
8. Open `seed.sql`, copy all of it, paste it in, click Run.

## Check it worked
In a new query, run:
```sql
select house, active_count, avg_points, on_board from greek_leaderboard order by avg_points desc;
```
You should see 6 houses. 5 say `true` for on_board. Chi Omega says `false` with 4 members.

## What the database enforces by itself
Even if the app has a bug, the database blocks:
- Workouts worth anything other than 3, 6, or 9 points (no stacked 27s)
- A 3rd workout in one day
- A 2nd macros, journal, or meditation point in one day
- Logging points for someone else, or deleting points
- Double RSVPs and double joins
- Joining your own partner post, or being your own workout partner
- Seeing anyone else's meals

## Tables
| Table | What it holds |
|---|---|
| profiles | Every student (real and demo) |
| point_logs | Every point earned. The leaderboard adds these up |
| peak_pulse_events | Events on the RSVP page (add new ones in Table Editor) |
| rsvps | Who's going to what |
| partner_sessions | Find a Partner posts |
| session_joins | Who joined which post |
| meal_entries | Food logged (private) |

Views the app reads: `month_leaderboard`, `greek_leaderboard`, `past_partners`.

## New month
Run `seed.sql` again on the 1st so the demo students have points for the new month.

## Delete the demo data before launch
```sql
delete from profiles where is_demo;
```
