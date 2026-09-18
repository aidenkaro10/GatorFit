# Shared Contract: Peak Pulse (Supabase + Vercel build)

Every agent reads this file FIRST. It is the source of truth. If your prompt and this file disagree, this file wins.

## What we're building
The existing MVP in `app/` (plain HTML, CSS, and JavaScript, no framework, no bundler) upgraded so data lives in Supabase and the site deploys to Vercel. Same look, same features, same gator. We are upgrading, not rewriting.

Project root: `/Users/Annabelle/Documents/projects/promptathon/`
Database schema (already written and tested, do not change): `supabase/schema.sql`
Demo data: `supabase/seed.sql`
Original MVP logic to port from: `app/app.js` (single file) and `app/data.js`

## File layout (after the Foundation agent runs)
```
app/
  index.html            loads everything below, in this order
  config.js             GENERATED, never committed: window.PP_CONFIG = { supabaseUrl, supabaseAnonKey }
  styles.css            shared styles (existing file, keep all current classes)
  css/rsvp.css          owned by RSVP agent
  css/leaderboard.css   owned by Leaderboard agent
  css/partner.css       owned by Partner agent
  css/log.css           owned by Log agent
  js/points.js          PP.points: pure rules, no network
  js/mock-data.js       fake data for DEMO MODE (from the old data.js)
  js/db.js              PP.db: every data call. Supabase mode or DEMO MODE
  js/ui.js              PP.ui: shared helpers and components
  js/pages/rsvp.js          owned by RSVP agent
  js/pages/leaderboard.js   owned by Leaderboard agent
  js/pages/partner.js       owned by Partner agent
  js/pages/log.js           owned by Log agent
  js/app.js             boot, auth, onboarding, sidebar, routing, event wiring
api/check-photo.js      Vercel serverless function: Claude checks a workout photo
scripts/make-config.mjs writes app/config.js from env vars
package.json            root, for the api function dependency
vercel.json             build + output settings
.env.example            names of every env var, no values
.gitignore              includes .env and app/config.js
```
All JavaScript in `app/` is plain browser script (no import/export, no build step). Everything hangs off one global: `window.PP`.

## Two data modes
- **Supabase mode**: `PP_CONFIG.supabaseUrl` and `supabaseAnonKey` are set. Real accounts, real shared data.
- **DEMO MODE**: config missing or empty. `PP.db` uses an in-browser fake backend (localStorage) seeded from `js/mock-data.js`. Shows a small "DEMO MODE" pill in the sidebar. It enforces the SAME rules as the database (point values, daily caps, no duplicates) so pages behave identically in both modes.
Pages never know which mode is on. They only call `PP.db`.

## PP.points (exact names)
- `RULES` = { workoutBase: 3, maxWorkoutsPerDay: 2, macrosPoint: 1, journalPoint: 1, meditationPoint: 1, macroHitPercent: 0.9, greekMinActive: 10, multipliers: { peak_pulse: 3, new_partner: 3, uf_event: 2, other: 1 } }
- `todayKey()` local "YYYY-MM-DD" built from getFullYear/getMonth/getDate. Never toISOString.
- `monthKey()` local "YYYY-MM"
- `workoutMultiplier({ peakPulse, ufEvent, newPartner })` returns { multiplier, reason }. Single highest, never multiplied together. Tie order for reason: peak_pulse, new_partner, uf_event, other. Nothing checked: { 1, "other" }.
- `workoutPoints(opts)` = RULES.workoutBase * multiplier
- `rankRows(rows, myId)` sorts [{ profile_id, display_name, greek_house, points }] high to low. On a tie, the row whose profile_id === myId goes BELOW. Returns new array with isMe added.
- `passedUsers(rows, fromPts, toPts, myId)` rows (not me) with fromPts <= points < toPts, lowest points first.
- `macrosHit(totals, goals)` with both shaped { p, c, f } in grams. True when protein, carbs, fat are EACH >= 90% of goal.

## PP.db (exact names, all async, all throw Error with a short friendly message on failure)
Auth and profile
- `mode` : "supabase" or "demo"
- `getSession()` -> { userId, email } or null
- `signUp(email, password)`, `signIn(email, password)`, `signOut()`
- `onAuthChange(callback)`
- `getMyProfile()` -> { id, email, display_name, greek_house, goal_protein_g, goal_carbs_g, goal_fat_g } or null
- `createProfile({ display_name, greek_house })` -> profile
- `updateGoals({ goal_protein_g, goal_carbs_g, goal_fat_g })` -> profile

Leaderboard
- `getMonthLeaderboard()` -> [{ profile_id, display_name, greek_house, points }] for everyone (reads view month_leaderboard)
- `getGreekBoard()` -> [{ house, active_count, avg_points, on_board }] (reads view greek_leaderboard)
- `getMyMonthPoints()` -> number

Events and RSVPs
- `listUpcomingEvents()` -> [{ id, title, starts_at, location, description }] future only, soonest first
- `listRsvps(eventIds)` -> [{ event_id, profile_id, display_name }]
- `addRsvp(eventId)`, `removeRsvp(eventId)`

Find a Partner
- `listUpcomingSessions()` -> [{ id, host_id, host_name, type, focus, starts_at, location }] future only, soonest first
- `listJoins(sessionIds)` -> [{ session_id, profile_id, display_name }]
- `postSession({ type, focus, starts_at, location })`
- `joinSession(sessionId)`, `leaveSession(sessionId)`
- `getPastPartnerIds()` -> Set of profile ids I've logged a workout with
- `listProfiles()` -> [{ id, display_name, greek_house }] everyone except me, A to Z

Points
- `getTodayLogs()` -> my point_logs for todayKey(): [{ kind, points, multiplier, multiplier_reason }]
- `addPointLog({ kind, points, multiplier, multiplier_reason, event_types, partner_profile_id })` -> saved row. Sets profile_id and log_date = todayKey() itself. Throws "Max 2 workouts a day" or "Already got today's point" when the database blocks it.

Meals
- `listTodayMeals()` -> [{ id, food_name, protein_g, carbs_g, fat_g }]
- `addMeal({ food_name, protein_g, carbs_g, fat_g })`, `removeMeal(id)`

Photo
- `checkWorkoutPhoto(file)` -> { ok: boolean, checked: boolean }. Calls POST /api/check-photo. On any error or after 15 seconds: { ok: true, checked: false }. In DEMO MODE: wait 900ms, { ok: true, checked: false }.

## PP.ui (exact names)
- `esc(s)`, `initials(name)`, `fmtWhen(iso)`, `sleep(ms)`, `toast(msg)`, `shrinkImage(file, maxW)`
- `greetingHTML(title, nextUp)` where nextUp = { name, gap } or null (null means "👑 You're #1. Stay hungry.")
- `avatarHTML(name, { me })`
- `setLoading(root)` shows grey placeholder cards

## Page modules (exact shape)
Each page file sets one object:
```
PP.pages.rsvp = {
  async render(root, ctx) { ... },        // draw into root (a <main> element)
  async onAction(action, el, ctx) { ... }, // clicks on [data-action] inside the page
  async onChange(el, ctx) { ... }          // change events inside the page (optional)
};
```
`ctx` = { me (profile), go(tab, params), refreshSidebar(), params }
- `go("leaderboard", { from, to })` switches tab and passes params. This is the gator handoff.
- Every data-action name inside a page starts with the page name: `rsvp-toggle`, `lb-tab`, `partner-join`, `log-workout`, etc. app.js routes clicks by that prefix. This prevents clashes between pages.
- Pages call `ctx.refreshSidebar()` after anything that changes points.

## Design
Keep `app/styles.css` look: sidebar left, black background with orange-yellow glow, glass cards, brand gradient `linear-gradient(135deg, #ffd23f, #ff8a00)` with #111 text on primary buttons and the current user's row. Light and dark mode through the CSS variables already in styles.css. Never hard-code colors in page code. Use the variables.

## Voice
Casual, short, like a UF student. Emoji fine. No em dashes. Never: "Congratulations", "successfully", "leverage", "seamless", "comprehensive", "delve".

## Ownership
- Foundation: everything except the 4 page files and 4 page css files
- RSVP: app/js/pages/rsvp.js, app/css/rsvp.css
- Leaderboard: app/js/pages/leaderboard.js, app/css/leaderboard.css
- Partner: app/js/pages/partner.js, app/css/partner.css
- Log: app/js/pages/log.js, app/css/log.css
- Integrator: anything
Need a change in a file you don't own? Don't make it. Put it under "Requests for the integrator" in your report.
