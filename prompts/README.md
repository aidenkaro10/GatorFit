# Peak Pulse Build Prompts (Supabase + Vercel)

The team upgrades the working MVP in `app/` to a real database and a live link.

| # | Agent | Runs | Builds |
|---|---|---|---|
| main | Claude Code (the orchestrator) | Starts everyone | Reads reports, retries, decides next step |
| 01 | Foundation | Alone, first | Data layer (Supabase + offline demo mode), rules, shared UI, sign-in, sidebar, deploy files, photo check API |
| 02 | RSVP | At the same time as 03-05 | RSVP page |
| 03 | Leaderboard | At the same time as 02, 04, 05 | Leaderboard + the gator |
| 04 | Partner | At the same time as 02-04 | Find a Partner page |
| 05 | Log | At the same time as 02-04 | Workout, Eating, Wellness |
| 06 | Integrator | Alone, last | Fixes seams, runs the demo twice, break-it tests |

`CONTRACT.md` is the shared rules sheet every agent reads first.
The old Base44 versions are in `base44-version/`.
