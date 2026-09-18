# GatorFit UI Spec (every UI agent reads this first)

Goal: make GatorFit look like a polished, professional app (think Strava, Whoop, Linear) while keeping Peak Pulse's branding. Same features, same behavior, better look. This is a restyle, not a rebuild.

## Sources
- Trophy UI (gamification components, MIT): raw source at https://ui.trophy.so/r/<name>.json (files[].content holds the React + Tailwind code). Names: leaderboard-podium, leaderboard-rankings, leaderboard-card, streak-badge, streak-card, streak-calendar, points-badge, points-boost, points-awards, achievement-unlocked, achievement-badge. Fetch with `curl -s`.
- shadcn/ui (the design system Trophy is built on) for cards, buttons, inputs, tabs, badges, empty states.
- Lucide icons, inline SVG only, through PP.ui.icon(name).
Our app is plain HTML/CSS/JS, no React, no Tailwind. PORT the look: read their Tailwind classes and translate them into our CSS using the tokens below. Never add React, Tailwind, or a build step.

## Brand (never change)
- Logo: the Peak Pulse image already in the sidebar and auth screen.
- Font: "Assistant" only (weights 400, 600, 700, 800). No other fonts, ever.
- Orange #FF6A00 = the brand accent and "you" highlight. Black #121212 = primary buttons, sidebar, text.
- App name: GatorFit. The gator 🐊 stays (the chomp animation, the chase line, the story card).

## Design tokens (defined once in styles.css :root, used everywhere)
Colors
- --bg: #fafafa (page) | --surface: #ffffff (cards) | --surface-2: #f4f4f5 (subtle fills)
- --border: #e7e7e9 | --border-strong: #d4d4d8
- --text: #121212 | --text-2: #52525b (secondary) | --text-3: #8a8a93 (muted)
- --brand: #ff6a00 | --brand-600: #e65f00 (hover) | --brand-soft: #fff3ea (tinted bg) | --brand-ring: rgba(255,106,0,.25)
- --ink: #121212 (primary button) | --ink-hover: #2a2a2a
- --success: #16a34a / --success-soft: #ecfdf3 | --danger: #dc2626 / --danger-soft: #fef2f2 | --gold #f5b301, --silver #a1a1aa, --bronze #c2773a
Type scale (px): 12, 13, 14 (body), 16, 20, 24, 32, 40. Headings 700 or 800, letter-spacing -0.02em on 24+. Body 400/600, no extra letter spacing. Numbers use font-variant-numeric: tabular-nums.
Spacing: 4px grid only: 4, 8, 12, 16, 20, 24, 32, 40, 48.
Radius: --radius-sm 8px (inputs, buttons, chips), --radius 12px (cards), --radius-lg 16px (modals), --radius-full 999px (avatars, pills).
Shadows: --shadow-sm: 0 1px 2px rgba(18,18,18,.06) | --shadow: 0 1px 3px rgba(18,18,18,.08), 0 4px 12px rgba(18,18,18,.04) | --shadow-lg: 0 12px 40px rgba(18,18,18,.12).
Motion: 150ms ease for hover/focus, 250ms for panels. Respect prefers-reduced-motion (except the gator, which is the product).
Focus: every interactive element gets a visible focus ring: 0 0 0 3px var(--brand-ring).

## Shared components (class names, built by the design-system agent in styles.css)
- .card (surface, 1px border, radius, shadow-sm, padding 20) / .card-header / .card-title (16, 700) / .card-sub (13, text-3)
- .btn + .btn-primary (ink bg, white) / .btn-brand (brand bg, white) / .btn-secondary (surface, border) / .btn-ghost / .btn-sm / .btn-block. Height 40 (sm 32). Icon + label gap 8.
- .input, .select, .textarea: height 40, border, radius-sm, focus ring.
- .check (custom checkbox row with a 20px box, brand when checked)
- .seg (segmented tabs: surface-2 track, white active pill with shadow-sm)
- .chip (filter pill, radius-sm; .on = ink bg, white)
- .badge (small label, 12px, 600) with variants .badge-brand, .badge-ink, .badge-success, .badge-muted
- .avatar (initials circle, 36px; .avatar-sm 28, .avatar-lg 48; .me = brand bg white text) and .avatar-stack
- .stat (big tabular number + small label)
- .empty (icon in a soft circle + title + text + optional button)
- .skeleton (shimmer placeholder)
- .page-header (greeting line text-3 14, title 32/800, right side slot for the chase pill)
- .chase-pill (the "🐊 5 pts until you pass X" pill: brand-soft bg, brand text for the number)
- Toast: ink bg, white text, radius-sm, shadow-lg, icon on the left.

## Rules
- Use tokens, never raw hex, in page code and page css (brand hex allowed only in canvas drawing code).
- Replace emoji UI icons with Lucide icons (nav, buttons, section headers). Keep emoji in copy where they're personality (🐊, 🔥 in streak text, 🥇🥈🥉 may become styled rank badges).
- Keep every data-action name, element id, and PP.* function a page relies on. Behavior must not change.
- Don't touch: points math, db.js, the gator animation logic and timings, share.js canvas drawing, api/.
- No em dashes in UI text.

## Component cheat sheet (built, in app/styles.css + app/js/ui.js; copy these exactly)
Icons: `PP.ui.icon(name, size = 18)` returns an inline Lucide `<svg class="icon">` string (currentColor). Names: calendar, trophy, users, plus-circle, flame, log-out, check, x, camera, image, map-pin, clock, dumbbell, footprints, utensils, book-open, brain, sparkles, share-2, download, copy, crown, chevron-right, chevron-down, search, filter, zap, target, award, trending-up, user, info, alert-triangle, loader. Unknown name returns "". Don't use sparkles as an "AI" label (see UI_FINISHED_PRODUCT.md).

Page header
- `PP.ui.greetingHTML("Leaderboard", nextUp)` gives `<div class="page-header greeting"><div><div class="hello">Good evening, Dana</div><div class="big page-header-title">Leaderboard</div></div><div class="chase-pill">🐊 <span><b>5 pts</b> until you pass Priya</span></div></div>`
- `.chase-pill`: `<div class="chase-pill">🐊 <span><b>5 pts</b> until you pass Priya</span></div>`

Cards
- `.card`: `<div class="card">...</div>`
- `.card-header` / `.card-title` / `.card-sub`: `<div class="card-header"><div><h3 class="card-title">Today</h3><p class="card-sub">Resets at midnight</p></div><button class="btn btn-sm">Edit</button></div>`

Buttons (height 40, .btn-sm 32; icon + label gap 8; press scale .98)
- `.btn.btn-primary` (ink): `<button class="btn btn-primary">${PP.ui.icon("plus-circle")}Log workout</button>`
- `.btn.btn-brand` (orange, one per area max): `<button class="btn btn-brand">Going</button>`
- `.btn.btn-secondary`: `<button class="btn btn-secondary">Cancel</button>`
- `.btn.btn-ghost`: `<button class="btn btn-ghost">${PP.ui.icon("x")}Close</button>`
- `.btn-sm`: `<button class="btn btn-secondary btn-sm">Join</button>` (old `.btn-small` = same)
- `.btn-block` (full width): `<button class="btn btn-primary btn-block">Save</button>`. NOTE: `.btn-primary` is no longer full width by itself. Add `.btn-block` where you want that.

Inputs (plain `input`, `select`, `textarea` get this look too)
- `<input class="input" placeholder="Where?" />`
- `<select class="select"><option>Run</option></select>`
- `<textarea class="textarea"></textarea>`
- `.check`: `<label class="check"><input type="checkbox" id="x" /> With a partner</label>`

Tabs, chips, badges
- `.seg`: `<div class="seg"><button class="active" data-action="lb-tab">Individuals</button><button data-action="lb-tab">Greek life</button></div>`
- `.chip` (+ `.on`): `<button class="chip on" data-action="partner-filter">All</button>`
- `.badge`: `<span class="badge">Run</span>` + variants `<span class="badge badge-brand">3x</span>` `<span class="badge badge-ink">Host</span>` `<span class="badge badge-success">Done</span>` `<span class="badge badge-muted">Full</span>` (old `.tag` = badge-brand, old `.done-pill` = badge-success)

People and numbers
- `.avatar`: `PP.ui.avatarHTML(name, { me, size: "sm" | "lg" })` gives `<div class="avatar avatar-sm me">DD</div>` (36 default, sm 28, lg 48, `.me` = orange)
- `.avatar-stack`: `<div class="avatar-stack">${faces}</div>`
- `.stat`: `<div class="stat"><div class="stat-value">42</div><div class="stat-label">Points</div></div>`
- `.points-badge`: `<div class="points-badge"><span class="points-icon">${PP.ui.icon("zap")}</span><b>9</b><span>pts</span></div>`
- `.streak-badge` (+ `.off` when 0): `<div class="streak-badge">${PP.ui.icon("flame")}<div class="streak-text"><span>4-day streak</span><span class="streak-hint">Log today to keep it</span></div></div>`
- `.bar`: `<div class="bar"><div style="width:60%"></div></div>` (`.bar.full` = green)

States
- `.empty`: `<div class="empty"><div class="empty-icon">${PP.ui.icon("calendar", 24)}</div><div class="empty-title">No runs yet</div><div class="empty-text">Post one and people can join.</div><button class="btn btn-primary">Post a session</button></div>`
- `.skeleton`: `<div class="skeleton"></div><div class="skeleton short"></div>` (or call `PP.ui.setLoading(root)`)
- Spinner: `<span class="icon-spin">${PP.ui.icon("loader")}</span>`
- Toast: `PP.ui.toast("Saved")` (check icon; messages like "Couldn't..." / "Max..." get the warning icon automatically)

Tokens: `--bg --surface --surface-2 --border --border-strong --text --text-2 --text-3 --brand --brand-600 --brand-soft --brand-ring --ink --ink-hover --on-ink --success(-soft) --danger(-soft) --gold --silver --bronze --radius-sm --radius --radius-lg --radius-full --shadow-sm --shadow --shadow-lg --ring --fast --panel`. Old names (`--card --card-2 --line --muted --accent-text --orange --red --green`) still work but map to the new ones; use the new names. `--grad` is gone (no gradients).
