# Peak Pulse Build Prompts

7 prompts that build the app in Base44 with a team of AI agents.

## The team

| # | Agent | Runs | Builds |
|---|---|---|---|
| 00 | Orchestrator | You paste this one | Starts the others, checks their work |
| 01 | Foundation | Alone, first | Data tables, points rules, layout, theme, sign-up, fake demo data |
| 02 | RSVP | At the same time as 03-05 | RSVP page |
| 03 | Leaderboard | At the same time as 02, 04, 05 | Leaderboard + the gator |
| 04 | Partner | At the same time as 02, 03, 05 | Find a Partner page |
| 05 | Log | At the same time as 02-04 | Workout, Eating, Wellness |
| 06 | Integrator | Alone, last | Fixes the seams, runs the full demo twice |

## Plan A: Claude Code runs everything (one laptop)

1. Connect Base44 (one time):
   ```bash
   claude mcp add --transport http base44 https://app.base44.com/mcp
   ```
2. Open Claude Code in the promptathon folder.
3. Type `/mcp`, pick base44, and sign in in the browser window.
4. Open `00-orchestrator.md`, copy everything, paste it into Claude Code, press Enter.
5. Wait. You'll get a short update after each phase and a final summary with 5 demo steps.

## Plan B: 5 laptops, Base44 chat only (no Claude Code)

1. Laptop 1 pastes `01-foundation.md` into the Base44 project's AI chat. Everyone else waits.
2. When laptop 1 is done, copy the BUILD_NOTES.md it made into a group chat.
3. Laptops 2 to 5 each paste one of `02` to `05`, with BUILD_NOTES.md pasted at the very top.
4. When all 4 are done, laptop 1 pastes `06-integrate-qa.md` with everyone's reports inside the `<reports>` tags.
Note: in Plan B, lines about "Base44 MCP tools" and "checkpoints" just mean "use Base44's normal editor features".

## Undo button
Every agent makes a Base44 checkpoint before and after it works. If something breaks, restore the one named `demo-ready` (or the last `...-done` one).
