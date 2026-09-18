# Feature Spec: Peak Pulse Wellness App (UF Promptathon)

A social wellness app for the UF community, built around Peak Pulse.
One idea drives everything: a leaderboard that pushes everyone forward.

(MVP) = must be in the demo. (Later) = nice to have if there's time.

---

- **Accounts and profile (MVP)**
  - Sign up
    - Name
    - UF email
    - Profile photo
  - Greek life (optional)
    - Pick your fraternity or sorority from a list
  - Active member
    - Logged at least one thing in the last 30 days

- **App layout (MVP)**
  - Bottom bar with 4 tabs
    - RSVP
    - Leaderboard
    - Find a Partner
    - Log

- **RSVP tab (MVP)**
  - Event list
    - Upcoming Peak Pulse events
    - Each shows date, time, location
    - Entered by an admin for the MVP
  - RSVP button
    - Tap "Going" to RSVP
    - Tap again to cancel
  - Who's going
    - Profile photos and names
    - Total count

- **Leaderboard tab (MVP)**
  - Individuals sub-tab
    - Everyone ranked by points this month
  - Greek Life sub-tab
    - Houses ranked by average points of active members
    - House needs at least 10 active members to show up
  - Your row
    - Always highlighted
    - List jumps to it when you open the tab
  - Monthly reset
    - Resets on the 1st of every month
  - Theme day (Later)
    - One day a month is double points
    - Has a theme (TBD)
    - Stacks on top of everything else that day

- **Find a Partner tab (MVP)**
  - Post a session
    - Type: gym or run only
      - Gym: pick what you're hitting
        - Arms
        - Legs
        - Cardio
    - Date and time
    - Location
  - Session feed
    - Everyone can see posted sessions
  - Join
    - Tap "Join" on someone's post
    - Both people get notified
  - New partner bonus
    - Log a workout with someone you've never worked out with = 3x
    - App tracks past partners, so "new" is automatic

- **Log tab (MVP)**
  - Workout
    - Take one photo after you're done
      - Claude checks it looks like a workout
    - Pick the events you went to
      - Peak Pulse
      - UF event
      - Other
    - Tag a partner (optional)
    - Honor system for the rest
    - Max 2 workouts per day
  - Eating
    - Set daily macro goals
      - Protein
      - Carbs
      - Fat
    - Log meals
      - Search foods through a nutrition API
    - Points
      - Hit all your macros for the day = 1 point
      - No points for eating less
  - Wellness
    - Journal
      - Write on paper
      - Date it at the top
      - Snap a photo to log it
        - No AI check, honor system
        - Photo stays on the phone, never uploaded
      - Max 1 point per day
    - Meditation
      - In-app timer
        - Pick 5, 10, or 15 min
      - Lock-in
        - Leave the app early = session fails, no point
      - Max 1 point per day

- **Points system (MVP)**
  - Base points
    - Workout = 3 (max 2 per day)
    - Hit daily macros = 1
    - Journal = 1
    - Meditation = 1
  - Workout multipliers
    - Peak Pulse event = 3x (9 pts)
      - Run, cold plunge, and yoga together count as ONE workout
    - With someone new = 3x (9 pts)
    - UF event = 2x (6 pts)
      - UF run club, intramurals, etc.
    - Anything else = 1x (3 pts)
  - Rules
    - Multipliers don't stack, you get the highest one
    - Best possible day = 21 points
      - 2 workouts at 9 + macros + journal + meditation

- **Chomping gator (MVP)**
  - When it happens
    - Right after you log a workout
    - Only if your new points pass someone on the leaderboard
      - Not every time, on purpose
  - What it does
    - Gator runs across and chomps their row
    - You jump above them
    - Pass several people = chomps them one after another

- **Instagram story card (Later)**
  - Share button after logging a workout
  - Image includes
    - Your workout photo
    - Your leaderboard spot
    - App branding
  - Shares through the phone's share menu
    - Works with IG stories, no Instagram setup needed

- **Journal history (Later)**
  - Scroll through your own journal photos by date
  - Private, on your phone only

- **Branding and UI**
  - Peak Pulse branding
    - Colors, logo, vibe
    - Need their permission first
  - Aiden pulling UI examples and animation repos

- **Open questions**
  - Do we have Peak Pulse's permission to use their brand?
  - What are the monthly theme days?
  - What tech are we building it with?
    - MVP: plain web app in the app folder, data saved in the browser only
    - Next: Supabase for real accounts, shared leaderboard, and events
