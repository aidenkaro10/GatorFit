# GatorFit

A social wellness app for UF, built around [Peak Pulse](https://www.peakpulseclub.com), the Gainesville run club.
Every workout, meal, journal, and meditation earns points on a monthly leaderboard. Compete as yourself and as your fraternity or sorority. When you pass someone, a gator chomps their row.

Built for the UF Promptathon.

## Features
- **Leaderboard:** individual and Greek Life boards (house average of active members, 10 member minimum), monthly reset, and the chomping gator when you pass people.
- **Points:** workout 3 pts (max 2 a day). Peak Pulse event 3x, new workout partner 3x, UF event 2x. Multipliers don't stack. Macros, journal, meditation 1 pt each per day.
- **RSVP:** the real Peak Pulse Gainesville runs, with who's going.
- **Find a Partner:** post a gym session or run, filter by activity and time, 3x points for training with someone new.
- **Log:** workout photo checked by Claude, AI meal tracker (Claude splits the meal into ingredients, USDA FoodData Central verifies the macros), paper journal with local-only photos, a phone-locking meditation timer.
- **Streaks** and **share to your Instagram story** with a branded graphic.

## Tech
- Plain HTML, CSS, and JavaScript (no framework) in `app/`
- Supabase (Postgres + auth + row level security) in `supabase/`
- Vercel hosting + serverless functions in `api/` (Claude API and USDA)
- Offline demo mode that follows the same rules as the database

See [HOW_THE_AI_WORKS.md](HOW_THE_AI_WORKS.md) for the full system design.

## Built with AI agents
The app was built with Claude Code running a team of AI agents in parallel. All the prompts are in [`prompts/`](prompts/), including the shared contract every agent followed.

## Run it locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill in the keys.
3. `npm run config`
4. `python3 -m http.server 8744 --directory app` then open http://localhost:8744
   (AI features need the serverless functions: use `npx vercel dev` for those.)

## Database
Run `supabase/schema.sql`, then `supabase/seed.sql` in the Supabase SQL editor. Existing databases from the first version: run `supabase/update-1.sql`.

Peak Pulse name and logo belong to Peak Pulse. This is a student project made for their community.
