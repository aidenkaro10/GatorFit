# Peak Pulse MVP

A phone-sized web app. No installs, no accounts, no API keys.

## Files
- `index.html`: the page layout
- `styles.css`: colors and look (change colors at the top)
- `data.js`: fake students, events, gym posts, and foods
- `app.js`: all the features and point rules (rules are at the top in `RULES`)

## How to run
1. Open Terminal.
2. Paste this and press Enter:
   `python3 -m http.server 8744 --directory ~/Documents/projects/promptathon/app`
3. Open Chrome and go to `localhost:8744`
4. To make it look like a phone: right click, Inspect, then click the phone icon at the top left.

## Faked for the MVP
- Workout photo check (real app: Claude looks at the photo)
- Food list (real app: nutrition API)
- Other students and Greek houses
- Notifications when someone joins your session

## Reset
Tap the ↺ next to your points at the top.
