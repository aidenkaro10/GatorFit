Copy everything below this line and paste it into Claude.

---

You're helping me build the presentation for our UF promptathon project. Below is the full context: every feature, every rule, the tech we used, how we built it, and why we made each decision. Read all of it before you answer. Then help me make a slide deck and a demo script. If anything below is unclear, ask me before guessing. Don't invent features that aren't listed here.

Writing rules for anything you write for us: casual, direct, short sentences, sounds like a college student talking. No em dashes. Never use the words "delve", "leverage", "furthermore", "comprehensive", "seamless", "in today's world", or "it's worth noting". If it sounds like a LinkedIn post, rewrite it.

# THE APP: GatorFit (a UF wellness app built around Peak Pulse)

The app is called GatorFit. It uses Peak Pulse's branding because it's built for their community. Call it GatorFit in the pitch.

## One-line pitch
GatorFit is a social wellness app for UF, built around Peak Pulse (the big Gainesville run club), where every workout, meal, and meditation earns points on a monthly leaderboard, you compete as yourself AND as your frat or sorority, and a chomping gator eats the people you pass.

## Who Peak Pulse is
Peak Pulse is a run club that's blowing up at UF and in the news. Their events are a run, then a cold plunge, then yoga. Their tagline is "Where movement meets momentum" and they say "all faces and all paces." Gainesville schedule (from their official site, peakpulseclub.com/pages/locations): Thursday 6pm at Depot Park, Saturday 8am at Afternoon Coffee. Instagram: @peakpulsegville. They also run in Tallahassee, Boca, Orlando, and the Florida Keys.

# ALL FUNCTIONALITY (most specific first)

## 1. Sign in and profile
- Email + password sign in. Any email works (judges can use their own). Password must be 6+ characters.
- One button, "Let's go": it tries to sign you in, and if the account doesn't exist, it makes one automatically. Wrong password shows "Wrong email or password."
- Pressing Enter submits. Double clicks are blocked so you can't make two accounts.
- After signing up you pick your name (max 40 characters) and your fraternity or sorority from a dropdown grouped by council, or "No fraternity or sorority."
- The dropdown has all 63 UF chapters, pulled from the official council sites:
  - Interfraternity Council (26): Alpha Epsilon Pi, Alpha Gamma Rho, Alpha Tau Omega, Beta Theta Pi, Chi Phi, Delta Chi, Delta Sigma Phi, Delta Tau Delta, Delta Upsilon, Kappa Alpha Order, Kappa Sigma, Lambda Chi Alpha, Phi Gamma Delta, Phi Kappa Tau, Pi Kappa Alpha, Pi Kappa Phi, Pi Lambda Phi, Sigma Alpha Epsilon, Sigma Alpha Mu, Sigma Chi, Sigma Nu, Sigma Phi Epsilon, Tau Epsilon Phi, Tau Kappa Epsilon, Theta Chi, Zeta Beta Tau
  - Panhellenic (18): Alpha Chi Omega, Alpha Delta Pi, Alpha Epsilon Phi, Alpha Omicron Pi, Alpha Phi, Chi Omega, Delta Delta Delta, Delta Gamma, Delta Phi Epsilon, Delta Zeta, Gamma Phi Beta, Kappa Alpha Theta, Kappa Delta, Kappa Kappa Gamma, Phi Mu, Pi Beta Phi, Sigma Kappa, Zeta Tau Alpha
  - Multicultural Greek Council (10): Alpha Kappa Delta Phi, Beta Chi Theta, Delta Phi Omega, Gamma Eta, Kappa Phi Lambda, Lambda Theta Alpha, Pi Delta Psi, Sigma Lambda Beta, Sigma Sigma Rho, Theta Nu Xi
  - National Pan-Hellenic Council (9): Alpha Kappa Alpha, Alpha Phi Alpha, Delta Sigma Theta, Iota Phi Theta, Kappa Alpha Psi, Omega Psi Phi, Phi Beta Sigma, Sigma Gamma Rho, Zeta Phi Beta
- Sign out button in the sidebar.

## 2. The points system (the core of everything)
Base points:
- Workout: 3 points. Max 2 workouts per day.
- Hitting your daily macros: 1 point (once a day).
- Journaling: 1 point (once a day).
- Meditating: 1 point (once a day).

Workout multipliers:
- Peak Pulse event: 3x (9 points). The run, cold plunge, and yoga all count as ONE workout.
- Working out with someone you've never worked out with before: 3x (9 points).
- UF event (UF run club, intramurals): 2x (6 points).
- Anything else: 1x (3 points).
- Multipliers do NOT stack. You get the single biggest one. A Peak Pulse event with a new partner is still 9, not 27.
- Best possible day: 21 points (two 9-point workouts + macros + journal + meditation).

Why no stacking: stacking lets one person hit 27+ points in a single workout and run away with the board. Capping keeps it competitive for everyone.

## 3. Leaderboard (two tabs)
- Individuals tab: everyone ranked by points this month. Top 3 get 🥇🥈🥉. Your row is highlighted in Peak Pulse orange and the page scrolls to it.
- Greek Life tab: every house ranked by the AVERAGE points of its active members (active = more than 0 points this month). A house needs at least 10 active members to show up. Houses below that are listed as "Not on the board yet (need 10 active members): Chi Omega (4/10)."
- Why average and not total: big houses would win just by being big. Average means a 40-person house and a 150-person house compete fairly, and every member matters.
- Why the 10-member minimum: stops 3 people from gaming the board.
- Resets on the 1st of every month, with a "days left this month" counter. Why: a new student in October can still win. Nobody's stuck staring at a lead they can't catch.
- Every page shows a "chase" line at the top: "🐊 3 pts until you pass Priya Cole." Always tells you who's next to eat.

## 4. THE GATOR (the signature moment)
- After you log a workout, you're sent to the leaderboard. If your new points passed anyone, a 🐊 runs across each person's row you passed, grows on the bite, and a red "CHOMP!" pops up. Their row shakes, flashes red, and fades. Then your row jumps above them with a bounce. Toast: "🐊 You ate 4 people! +9 pts."
- It chomps up to 5 people in a row, closest first.
- It only fires when you actually pass someone. Not every time, on purpose. That's a variable reward, the same psychology that makes slot machines and loot boxes addictive, used here to get people to work out.
- It never replays when you come back to the tab.
- Demo detail: the demo data is set up so a brand new user's first Peak Pulse workout (9 points) passes EXACTLY 4 people every time, so the gator is guaranteed to fire on stage.

## 4b. Share to your Instagram story
- When you move up past someone, a popup asks "🐊 You moved up to #12! Post it?" with "Add a pic of yourself" and "Not now". A black "📸 Share to your story" button also stays under the greeting.
- It makes a story-sized graphic (1080x1920) in Peak Pulse's style: the real Peak Pulse logo on top, your photo in a tilted white polaroid frame labeled with your house and points, an orange sun-shaped sticker with your rank ("#12 ON THE BOARD"), and the headline "Just chomped my way to #12 on the leaderboard 🐊", then "Join me on GatorFit" and "GatorFit x @peakpulsegville · Where movement meets momentum".
- "🤳 Use a selfie instead" swaps your workout photo for a selfie. Photos stay in memory only, never uploaded.
- A ready caption with a "Copy caption" button: "Just chomped my way to #12 on the Peak Pulse leaderboard 🐊 Join me on GatorFit @peakpulsegville". The invite on every story is how GatorFit spreads.
- Uses the Web Share API: on a phone, "Share to story" opens the share sheet with the image ready, and you tap Instagram, then Story. On a laptop, it downloads the image.
- The roadmap for a phone app: Instagram's "Sharing to Stories" (the same thing Strava and Spotify use) opens straight into your story with the graphic loaded. It needs a native app and a Meta app ID, so that's the next step after the web version.
- Why: every story is free advertising for Peak Pulse and the app. That's the growth loop.
- Honest note if judges ask: no website can post straight to Instagram. Instagram doesn't allow it. The share menu is how every website does it.

## 4c. Streaks
- Your sidebar card shows "🔥 4-day streak": days in a row you logged anything (workout, meal, journal, or meditation).
- If you haven't logged yet today, it adds "log today to keep it". A toast pops up when your streak grows.
- The streak doesn't break in the morning before you've had a chance to log. It only resets if you miss a whole day.
- Why: gives people a reason to open the app every day, not just on workout days.

## 5. RSVP tab (Peak Pulse events)
- Shows the real upcoming Peak Pulse Gainesville runs from their official schedule: Thursday Run Club (6pm, Depot Park) and Saturday Morning Run (8am, Afternoon Coffee), next 2 weeks.
- Each event card: "PEAK PULSE · 3X POINTS" tag, title, date and time, place, description, overlapping faces of who's going (yours first if you're going), "{n} going", and a "See who's going" list.
- "I'm going" / "Going ✓" button. Updates instantly, can't double-RSVP, undoes itself if the save fails. Toast: "You're going! 🔥"
- Events starting within 2 hours get a "Starting soon" tag.

## 6. Find a Partner tab
- Post a session: Gym or Run. Gym sessions pick what you're hitting: Arms, Legs, or Cardio. Pick a date and time (pre-filled with the next hour) and a location (60 characters max).
- Everyone sees the feed of upcoming sessions, soonest first.
- Filters to find people fast, one tap each: What (All, Gym, Arms, Legs, Cardio, Run), When (Any day, Today, Tomorrow, This week), Time (Any time, Morning, Afternoon, Evening), and "New people only (3x)". Shows how many sessions match, with a "Clear filters" link.
- If nothing matches: "Nobody's going then. Post it yourself 💪" with a "Post this session" button that fills in the form with the activity and time you filtered for. You just add where. A dead end turns into a new post someone else can find.
- Why filters and not a calendar: there are only a handful of posts at a time, so a calendar would be mostly empty. Filters answer the real question in one tap: "who's hitting legs tomorrow evening?"
- Tap "Join" on someone's post. They get a heads up. "Joined ✓" lets you leave.
- Cards show "NEW PARTNER = 3X" only on people you've never worked out with. The app tracks your past partners automatically.
- Can't join your own post. Can't post a time in the past or more than 30 days out.
- Why: the 3x new-partner bonus is how the app gets strangers meeting each other. It's the "community" part of a wellness app.

## 7. Log tab (where points are earned)
Top of the page: a "Today" card showing Workouts 0/2, Macros, Journal, Meditate with checkmarks, plus "{n} pts earned today."

### Workout
- Snap a photo after your workout. Claude (AI) looks at the photo and checks it actually looks like a workout (gym, running, yoga, cold plunge, post-workout selfie). A photo of food or a meme gets "Hmm, that doesn't look like a workout." If the AI can't be reached, it passes on the honor system so the app never breaks.
- Check what you went to: Peak Pulse event (3x), UF event (2x), or Something else (1x).
- Pick a workout partner. People from sessions you joined show at the top. Anyone new says "(new, 3x)."
- Live preview: "This workout = 9 pts. 3x from Peak Pulse. Multipliers don't stack, you get the biggest."
- Log it, and you get sent to the leaderboard for the gator.
- Photos are never saved anywhere. Picked the wrong one? "✕ Remove" on the preview clears it.

### Eating (AI macro tracker)
- ✨ AI meal tracker: type what you ate ("2 eggs, toast, chipotle bowl") or snap a photo of your plate. Claude breaks it into items and estimates protein, carbs, and fat for each, with a confidence level (high, medium, low) and a short note. One tap "Add to today."
- Works for home-cooked meals (breaks them into ingredients), restaurant food, and dining hall plates. Knows Gainesville staples like Pub Subs and Chipotle.
- Also a quick-add list of 17 common foods.
- Progress bars for protein, carbs, fat vs your goals. You set your own daily goals (default 150g protein, 250g carbs, 70g fat).
- You earn the macro point when protein, carbs, AND fat each hit 90% of your goal.
- Why we reward hitting goals instead of eating less: rewarding low calories on a college campus pushes people toward disordered eating. We reward fueling right.
- Why Claude and not a food database API: food databases only look up exact single items. They can't read "my mom's chicken stir fry" or a photo of a dining hall plate. Claude can.

### Wellness
- Journal: write on real paper, date it at the top, snap a photo to log it (+1). The photo stays on your own computer only. Never uploaded. You can scroll back through your journal pages, and delete any photo with its ✕ (the point you earned stays).
- Why paper + honor system: journaling is private and supposed to make you feel good. Policing it (checking dates, reading it) would make it feel bad. We chose trust.
- Meditation: pick Demo 10s, 5, 10, or 15 minutes. The screen locks into a full-screen breathing circle with a countdown. If you leave the tab, click away, press Escape, or give up, the session fails and you get no point. Finish it and you get +1.
- Why the lock: it forces you off your phone for real.

## 8. Design and branding
- Uses Peak Pulse's exact branding, taken straight from their website's code: their real logo (white "peak pulse" text with the orange smiling sun), their sun favicon, white background, #121212 black text, #F3F3F3 grey sections, square black buttons with white text, the Assistant font, and 1px letter spacing. Their orange (#FF6A00, from the sun) highlights "you" everywhere.
- Black sidebar like their site header, with the logo, your name, house, points, rank, the 4 tabs, and sign out.
- Built for laptops, landscape. Light mode only.
- Friendly, casual copy everywhere: "You're going! 🔥", "You ate 4 people!", "Rest up."

# HOW WE APPROACHED THE MACRO TRACKER (AI + API)

The problem: logging food is the step everyone quits. Most trackers make you search a database for one exact item at a time. College students don't eat like that. They eat Pub Subs, dining hall plates, and whatever their roommate cooked.

What we tried first and why we moved on:
- Version 1 was a fixed list of 17 common foods. Fast, but useless for anything not on the list.
- A food database API alone (like USDA or Nutritionix) only works if you know the exact food name. It can't read "my mom's chicken stir fry" or a photo of a plate.
- AI alone (just asking Claude for the macros) handles any meal, but the numbers are an educated guess. Judges and users will ask "how do you know that's right?"

What we built: AI to understand the meal, a government database to check the numbers.
1. You type a meal ("chipotle bowl double chicken, extra rice") or snap a photo of your plate.
2. Claude (claude-opus-5, through the Claude API) reads it and breaks it into separate ingredients with realistic portion sizes in grams. Home-cooked meals get split into ingredients too ("2 eggs scrambled with cheese" becomes eggs, cheese, butter). It returns structured JSON, so the app always gets clean data back.
3. For each ingredient, the app looks up verified nutrition in USDA FoodData Central, the US government's official nutrition database, and scales it to the portion size. All ingredients are looked up at the same time, so it stays fast.
4. Every item shows where its numbers came from: "✓ USDA" when it's verified, "AI est." when Claude had to estimate (like a menu item USDA doesn't have). The card says how many items were verified.
5. One tap adds the meal to today. If you hit 90% of your protein, carbs, and fat goals, you earn your daily macro point.

Why this is a smart use of AI:
- AI does what AI is good at: understanding messy, real-world input like text, photos, and home cooking.
- The database does what databases are good at: exact, trustworthy numbers.
- Every number is labeled with its source, so it's honest about what's verified and what's estimated.

Built so it never breaks:
- The Claude API key only lives on our server (a Vercel serverless function), never in the browser.
- If a USDA lookup is slow or fails, that item keeps Claude's estimate. If the AI is unreachable, the app shows a clearly labeled "offline guess" so the demo never dead-ends.
- It never rewards eating less. You earn points for hitting your goals, not for cutting calories.

One-liner for the slide: "Claude understands what you ate. USDA verifies the numbers."

# TECH STACK AND TOOLS
- Front end: plain HTML, CSS, and JavaScript. No framework. Why: fast, nothing to break, loads instantly.
- Database: Supabase (Postgres). 7 tables (profiles, point_logs, peak_pulse_events, rsvps, partner_sessions, session_joins, meal_entries) and 3 live views (month_leaderboard, greek_leaderboard, past_partners).
- The database enforces the rules itself, even if the app has a bug: workouts can only be worth 3, 6, or 9 points, a 3rd workout in a day is blocked, a 2nd journal/macros/meditation point is blocked, you can't log points for someone else or delete points, no double RSVPs or joins, you can't be your own partner, and meals are private (Row Level Security). We tested all of this with automated checks against a real Postgres database.
- Hosting: Vercel (static site + 2 serverless functions).
- AI: Claude API (claude-opus-5) in two serverless functions: workout photo check and meal macro estimates. The API key lives only on the server, never in the browser.
- Offline safety net: if the database can't be reached, the app keeps running on built-in data with the same rules, so the demo never dies on bad Wi-Fi.
- Built with: Claude Code (Anthropic's AI coding agent), Supabase, Vercel, Claude API.

# HOW WE BUILT IT (the promptathon part)
- We started with a brainstorm, locked every rule into a written feature spec, then built a quick working prototype to prove the idea.
- Then we used Claude Code as an orchestrator running a team of 7 AI agents:
  1. Foundation agent (alone, first): database layer, rules, shared design, sign in, deploy setup, photo AI.
  2. to 5. Four page agents running AT THE SAME TIME: RSVP, Leaderboard + gator, Find a Partner, Log.
  6. Integrator/QA agent (alone, last): connected the pages, fixed seams, ran the full demo twice with zero errors, ran break-it tests (two tabs at once, junk files, refresh mid-chomp).
  7. AI features agent: built the Claude meal tracker in parallel.
- Every agent read one shared "contract" file first with the exact names of every data table, function, and rule. That's what let 4 agents build at once without breaking each other.
- Each file had one owner. Agents weren't allowed to touch other agents' files. They wrote "requests for the integrator" instead.
- Every prompt used the same skeleton: Role, Task, Context, Format, Constraints. On top of that we used research-backed prompting techniques:
  - Contrastive examples (wrong vs right, and why it's wrong), like "WRONG: 3 x 3 x 3 = 27 points. RIGHT: multipliers don't stack, 9 points."
  - Contrastive reasoning (wrong reasoning chain vs right reasoning chain).
  - Plan-and-Solve: list inputs, list and check assumptions, plan, then build piece by piece.
  - The research-proven phrase "Let's work this out in a step by step way to be sure we have the right answer."
  - Chain of Verification: agents had to actually run every check, never claim a pass they didn't test.
  - Self-critique: every agent scored its own work, named the 3 likeliest ways it breaks, and fixed them before reporting.
  - Tree of Thoughts for the orchestrator: before retrying a failed agent, figure out whether it's an environment problem, a dependency problem, or an agent mistake.
  - Persona review in QA: judge, first-time freshman, skeptical engineer.
- Real numbers from the build: the gator test ate exactly 4 people every run. The integrator's demo passed 9/9 steps twice in a row. The database passed its automated rule checks.

# KEY DECISIONS AND WHY (good for a "decisions" slide)
- Built around Peak Pulse instead of a generic wellness app: they already have the community and the hype. We give them a reason to come back every week.
- Greek Life board by average: fair competition, and it's how the app spreads at UF.
- Monthly reset: new people can always win.
- Variable-reward gator: more addictive than a reward every time.
- Reward hitting macros, not eating less: protects students from disordered eating.
- Honor system for journaling: wellness should feel good, not policed.
- Claude for meals instead of a food database: handles home-cooked and dining hall food.
- Any email can sign in: judges and non-UF friends can try it.
- Database enforces the rules: cheating through the app is blocked at the source.
- Offline fallback: the demo can't die on bad Wi-Fi.

# DEMO SCRIPT (about 2 minutes)
1. Open the link. Sign in with any email and a password. Pick a name and a house (like Beta Theta Pi).
2. RSVP tab: show the real Peak Pulse runs. Hit "I'm going." Your face shows up first.
3. Find a Partner: join someone's gym session. Point out "NEW PARTNER = 3X."
4. Log tab, Eating: type "chipotle bowl double chicken" and hit Estimate. Show Claude breaking it down. Add it.
5. Log tab, Workout: snap a photo, check Peak Pulse event, pick the partner you joined (shows "new, 3x"). Preview says 9 points.
6. Hit Log workout. THE GATOR eats 4 people. Pause here. Let it land.
7. Flip to Greek Life: your house's average moved because you're now active.
8. Close: "Every workout moves you up. Every new partner is 3x. And your house is counting on you."

# WHAT'S NEXT (roadmap slide)
- Official Peak Pulse partnership and live event sync from their Instagram.
- QR check-in at events to verify attendance.
- Monthly theme days with double points.
- Expand to Tallahassee, Boca, Orlando, and the Keys (Peak Pulse already runs there).
- Phone app version.

# WHAT I NEED FROM YOU
1. A 7 to 9 slide deck outline: title, problem, solution, live demo, how it works (points + gator), how we built it (the agent team + prompting techniques), key decisions, what's next. For each slide: the headline, 3 bullets max, and what to show on screen.
2. A tight 2-minute demo script with exact words to say at each step.
3. 5 questions judges will probably ask, with short answers based ONLY on the facts above.
4. A 20-second "best use of AI" pitch covering the Claude photo check, the Claude meal tracker, and the 7-agent build.
