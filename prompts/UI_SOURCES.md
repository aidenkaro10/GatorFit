# Approved UI sources (license checked, source reachable)

Copy the LOOK from these, translated into our tokens in prompts/UI_SPEC.md. Never import their code, fonts, or colors directly.
Fetch source with: curl -s <url>  (JSON; the code is in files[].content)

| Source | License | Use it for | Source URLs that work |
|---|---|---|---|
| Trophy UI (trophyso/ui) | MIT | Gamification: podium, rankings, streak calendar, points boost, points feed, achievement popup | https://ui.trophy.so/r/{leaderboard-podium, leaderboard-rankings, leaderboard-card, streak-card, streak-calendar, streak-badge, points-boost, points-awards, points-badge, achievement-unlocked}.json |
| shadcn/ui (shadcn-ui/ui) | MIT | Cards, tabs, inputs, login layout, sidebar, empty states | https://ui.shadcn.com/r/styles/new-york-v4/{card, tabs, input, checkbox, badge, button, login-03, sidebar-07}.json |
| Magic UI (magicuidesign/magicui) | MIT, 22k stars | Small motion only: number ticker for points, confetti, border beam | https://magicui.design/r/{number-ticker, confetti, border-beam}.json |
| ReUI (keenthemes/reui) | MIT | Timeline layout (points history) | https://reui.io/r/timeline.json (file-upload and progress need a login, skip) |
| Cult UI (nolly-studio/cult-ui) | MIT | Optional card ideas | browse only |

DO NOT USE: Origin UI (origin-space/originui). Its repo is now AGPL, which would force the whole app to be open-sourced.

Rules for motion (Magic UI): write it as plain CSS/JS, no Motion/Framer library. Keep it short (under 600ms), subtle, and off for prefers-reduced-motion. The gator stays the star.
