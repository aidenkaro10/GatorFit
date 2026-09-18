# How GatorFit's AI and backend work

## The big picture
GatorFit is a website with three layers:
1. **The app in your browser:** plain HTML, CSS, and JavaScript. It draws the pages, the leaderboard, and the gator.
2. **Our server functions on Vercel:** 2 small serverless functions that hold the secret API keys and talk to AI: one for the photo check, one for the meal tracker.
3. **Supabase:** the database and login system. It stores accounts, points, RSVPs, partner posts, and meals, and enforces the rules.

Plus 2 outside services: **Claude API** (Anthropic's AI) and **USDA FoodData Central** (the US government's nutrition database).

Supabase is not AI. It's the database. The AI is Claude, and USDA is real data we use to check the AI.

## Why the keys live on the server
Anything in the browser can be seen by anyone who opens the site. If the Claude key lived in the browser, someone could copy it and run up our bill. So the browser never talks to Claude directly. It sends the photo or meal to our Vercel function, the function adds the secret key, calls Claude, and sends back only the answer.
The Supabase "anon" key is the one exception. It's designed to be public, because the database's own security rules decide what each user can do (explained below).

---

## AI feature 1: The workout photo check (Claude vision)
File: `api/check-photo.js`

How it works:
1. You snap a photo after your workout on the Log page.
2. The browser shrinks it to 1024px wide (faster and cheaper), then sends it to our `/api/check-photo` function.
3. The function sends the image to Claude (`claude-opus-5`) with one instruction: answer YES if it shows a workout (gym, running, yoga, cold plunge, post-workout selfie) or NO if it's anything else (food, a meme, a screenshot, a blank image). Reply with one word.
4. YES: "✅ Looks like a workout." NO: "Hmm, that doesn't look like a workout. Try another photo," and you can't log until you pick a real one.

Why we built it this way:
- **Only one word back:** fast and cheap, and there's nothing to misread.
- **Low effort setting:** it's a simple yes/no, so we tell Claude not to overthink it. Faster answers.
- **It fails open:** if Claude is slow (15 second limit), down, or refuses, the photo passes as "honor system." A broken AI call should never stop a student from logging a real workout, and it can't kill the live demo.
- **Photos are never saved.** The photo is checked and thrown away. It's never stored in the database.

## AI feature 2: The meal tracker (Claude + USDA)
File: `api/estimate-macros.js`

The problem: logging food is where people quit. Food databases make you search for one exact item at a time, and college students eat Pub Subs, dining hall plates, and home cooking. AI alone understands any meal but guesses the numbers. A database alone has real numbers but can't understand real meals. So we use both, each for what it's good at.

How it works, step by step:
1. You type what you ate ("chipotle bowl double chicken, extra rice") or snap a photo of your plate.
2. **Claude understands the meal.** Our function sends it to Claude (`claude-opus-5`), which breaks it into separate ingredients. For each one it gives:
   - a name
   - a realistic portion in grams
   - its own macro estimate (protein, carbs, fat)
   - a plain search term the USDA database will recognize, like "chicken breast, grilled" or "white rice, cooked"
   Home-cooked meals get split into ingredients too: "2 eggs scrambled with cheese" becomes eggs, cheese, and butter.
3. **Claude answers in a strict format (structured JSON output).** We give Claude an exact schema, and its answer has to match it. So the app always gets clean data it can use, never a paragraph it has to guess at.
4. **USDA checks the numbers.** For every ingredient, our function searches USDA FoodData Central, all at the same time so it stays fast. USDA gives nutrition per 100 grams, so we scale it to the portion: per-100g value × grams ÷ 100. Example: chicken with 25.7g protein per 100g, at a 180g portion, is 46g protein.
5. **We pick the best USDA match.** USDA returns its top 3 matches. We pick the one closest to what Claude described, so "grilled chicken" doesn't accidentally use "grilled chicken with sauce."
6. **Every item is labeled with its source.** "✓ USDA" means the numbers came from the government database, and hovering shows the exact USDA food. "AI est." means USDA didn't have a good match, like a specific restaurant item, so we kept Claude's estimate. The card shows "4 of 4 items verified with USDA FoodData Central."
7. The totals are added up from the final numbers, and one tap adds the meal to today. Hit 90% of your protein, carbs, AND fat goals and you earn your daily macro point.

Real results from testing:
- "chipotle bowl double chicken, white rice, black beans, cheese": 4 of 4 items USDA verified, 66g protein, about 7 seconds.
- "2 scrambled eggs with cheese and 2 slices of toast with butter": 5 of 5 verified, including the butter in the pan.

Why we built it this way:
- **AI for understanding, database for accuracy:** each tool does what it's best at, and every number shows where it came from. If a judge asks "how do you know that's right?", the answer is on screen.
- **Never breaks:** each USDA lookup has a 4 second limit. If one fails, that item keeps Claude's estimate. If USDA is completely down, you still get Claude's full answer. If Claude is unreachable, the app shows a clearly labeled "offline guess."
- **Never rewards eating less:** the point is for hitting your goals, not cutting calories. Rewarding low calories on a college campus pushes people toward disordered eating.
- A bug we found and fixed: USDA's search randomly rejected about half the requests when the search was sent in the web address. We switched to sending it as data (a POST request), tested it 10 out of 10, and verification went from about 1 of 4 items to 4 of 4.

## Safety settings on every Claude call
- **Model:** `claude-opus-5`, Anthropic's current flagship model.
- **Server-side fallback:** if Claude declines a request, Anthropic's API automatically retries it on another model, so users don't hit dead ends.
- **Timeouts everywhere:** the browser gives up after 15 to 20 seconds and falls back gracefully.
- **Never a crash:** if anything goes wrong, the function sends back a friendly message instead of an error page.

---

## Supabase: accounts, data, and rules (not AI)
Supabase is a hosted Postgres database with built-in login.

What's in it:
- **7 tables:** profiles, point_logs (every point ever earned), peak_pulse_events, rsvps, partner_sessions, session_joins, meal_entries.
- **3 views that do the math:**
  - `month_leaderboard`: adds up everyone's points for the current month
  - `greek_leaderboard`: averages each house's ACTIVE members, and only puts a house on the board with 10+ active members
  - `past_partners`: who you've already worked out with, for the "new partner = 3x" rule

Why the rules live in the database, not just the app: anyone can mess with code running in their own browser. So the database enforces the rules itself.
- A workout can only be worth 3, 6, or 9 points. A fake 27-point workout gets rejected.
- A 3rd workout in one day is blocked, even from two tabs at the same moment.
- A 2nd macros, journal, or meditation point in the same day is blocked.
- You can only add points for yourself, and nobody can delete points.
- No double RSVPs, no joining your own post, no being your own workout partner.
- **Row Level Security:** everyone can see the leaderboard, events, and partner posts, but you can only create or change your own rows, and your meals are private to you. That's why the public anon key is safe to have in the browser.
- We tested all of this with automated checks against a real Postgres database before connecting it.

Login: email and password, any email (so judges can use their own), with email confirmation turned off so sign-up is instant.

## Vercel: hosting
- The website files are served from Vercel's global network.
- The 2 AI functions run as serverless functions: they only run when someone uses them, and they're the only place the Claude and USDA keys exist.
- The keys are stored in Vercel's Environment Variables, never in the code.

## Demo mode (the safety net)
If the app can't reach Supabase, it switches to demo mode: a copy of the database that runs inside the browser, with 70 demo students and the SAME rules (same point values, same daily caps, same error messages). If the Wi-Fi dies on stage, the demo keeps working. The demo data is also set up so a new user's first Peak Pulse workout (9 points) passes exactly 4 people, so the gator always fires.

## Data that never leaves your device
- **Workout photos:** checked by Claude, then thrown away. Never stored.
- **Selfies for the story card:** used to draw the image in your browser. Never uploaded.
- **Journal photos:** saved only in your own browser. The database only knows "journaled today, +1 point."

---

## AI in how we BUILT it (Claude Code)
Beyond the AI inside the app, we built the app with AI: Claude Code (Anthropic's coding agent) running a team of AI agents.
- A **Foundation** agent built the database layer, rules, design system, and login first.
- Then **4 agents built the 4 pages at the same time** (RSVP, Leaderboard + gator, Find a Partner, Log).
- An **Integrator/QA** agent connected everything, fixed the seams, and ran the full demo twice with zero errors.
- More agents added the AI meal tracker, USDA verification, the story share card, and streaks, all in parallel.
- Every agent read one shared "contract" file with the exact names of every table, function, and rule, so parallel agents never broke each other. Each file had one owner.
- Every prompt followed Role, Task, Context, Format, Constraints, plus research-backed techniques: wrong vs right examples, step-by-step planning, self-critique, and verification where agents had to actually run every test before reporting it passed.

## One-liners for slides
- "Claude understands what you ate. USDA verifies the numbers."
- "AI checks your workout photo in one word. If AI fails, you still get your points."
- "The database enforces the rules, so nobody can cheat by editing the app."
- "Built by a team of 7+ AI agents working in parallel, coordinated by one shared contract."
