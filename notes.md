# Promptathon notes (UF)

## The idea
A social wellness app for the UF community, branded around Peak Pulse.
Core theme: a social leaderboard that pushes everyone forward.

Peak Pulse = a big UF run club. Their events are a run, then a cold plunge, then yoga.

## App tabs
1. RSVP (Peak Pulse events, see who's going)
2. Leaderboard
3. Find a Partner (gym sessions and runs only, for now)
4. Log (3 categories: Workout, Eating, Wellness)

## Log tab
- Workout: take one photo after you're done, pick the events you went to. Honor system.
  AI vision (Claude) checks the photo looks like a workout. No model training needed.
- Eating: food API for macros
- Wellness:
  - Journal on paper. Date it at the top and snap a photo to log it.
    Honor system: no AI check. The photo stays on the user's phone only, never uploaded.
  - Meditation: in-app timer that locks you in. If you leave the app, the session fails
    and you get no point.

## Base points (before multiplier)
- Workout: 3
- Hit daily macros: 1
- Journal: 1 (max 1 per day)
- Meditation: 1 (max 1 per day)

## Leaderboard (2 tabs)
1. Individuals
2. Fraternities and sororities (score = average of active members on the app)

## Points
- 3x: Peak Pulse events (run, cold plunge, and yoga all count)
- 2x: UF events (UF run club, intramurals, etc.)
- 1x: everything else

## Leaderboard timing
- Resets every month
- One day a month is double points, with a special theme

## Other things that earn points
- Meal tracking: use an API for macros. Points for hitting your macro goals (not for eating less)
- Wellness: meditation and journaling
- "Workout invites": post a time you want to go to the gym or run, everyone can see it.
  Going with someone you've never worked out with before = 3x points for that workout.

## RSVP tab
- RSVP to Peak Pulse events and see who else is going

## Instagram story sharing
- After an activity, post straight to your IG story
- The story card shows your workout fit photo plus a snapshot of your leaderboard spot

## UI
- Use Peak Pulse branding
- Aiden will share a few UI examples
- Chomping gator (DECIDED): after you log a workout, the gator chomps the row of anyone you pass
  on the leaderboard. It's the dopamine hit.
  - Only happens when you actually pass someone. It won't fire every time, and that's fine.
    Not knowing when it'll hit is part of what makes it exciting.

## Decided rules (FINAL)
- Events: honor system, one photo + pick the events you went to
- Max 2 workouts per day
- A Peak Pulse event (run + cold plunge + yoga) counts as ONE workout: 3 pts x 3 = 9
- Working out with someone new: 3x (3 pts x 3 = 9)
- Multipliers don't stack, you get the highest one
- Greek houses need at least 10 active members to show on the board

## Open questions
- Do we need Peak Pulse's permission to use their name and branding?
- What are the monthly theme days? (ex: "Swamp Sweat Saturday", game day week)
