# Make it look like a shipped product, not AI-generated

The owner's #1 note: GatorFit must look like a real app a funded startup shipped (Strava, Whoop, Linear, Cal AI), NOT like something an AI generated. Every UI agent follows this.

## What makes UI look AI-generated (BANNED)
- Emoji as icons or decoration everywhere (📅🏆🤝➕✨📸🎯). Use Lucide icons. Emoji allowed ONLY for: the 🐊 gator (it's the brand mascot) and 🔥 in the streak count. Nowhere else in the chrome.
- Sparkle ✨ "AI" labels, "magic", "powered by AI" badges.
- Every element in its own bordered card, cards inside cards, identical card grids with equal weight.
- Gradients on buttons, gradient text, glows, glassmorphism, blurred blobs.
- Everything centered. Big empty hero with a one-line title.
- Chatty filler copy ("Let's crush it today!", "Awesome job!", "Here's your personalized..."). Exclamation points everywhere.
- Rounded-full pills for every label, every button the same size, "tag soup" (5 badges on one card).
- Random decorative icons next to every heading.
- Uniform gray-on-gray low-contrast text.
- Default purple/blue accents (we use Peak Pulse orange + black, period).

## What makes it look shipped (DO)
- **Hierarchy:** one clear primary thing per screen (Leaderboard = your rank + the board; Log = the workout form; RSVP = next run). Secondary stuff is quieter: smaller, muted, lower.
- **Real density:** lists are lists (rows with dividers), not stacks of cards. Leaderboard rows are tight (48 to 56px), aligned columns, tabular numbers.
- **Left-aligned** layouts with a strong page header. Whitespace from the 4px grid, consistent.
- **Numbers are the hero:** points, ranks, streaks in big bold tabular numerals (32 to 48px, 800). Labels small and muted (12px, uppercase letter-spacing 0.06em only for tiny labels).
- **Restraint with color:** 90% black, white, and grays; orange ONLY for "you", the primary accent action, and active states. One orange thing per area.
- **Real UI details:** hover and pressed states, focus rings, disabled states, skeleton loading, empty states that tell you what to do, truncation on long names, pluralization ("1 person", "2 people").
- **Short, specific copy** like a real product: "Log workout", "Going", "Join", "9 pts". Sentence case. The playful gator voice only in the moments that earn it (the chomp, the chase pill, the story card).
- **Consistent components:** same button height everywhere (40, or 32 for small), same radius, same shadow. If two things do the same job, they look the same.
- **Micro-interactions that feel native:** 150ms hover, subtle press scale (0.98), points counting up once. No bouncing, no spinning.

## Quick self-check before you finish
Look at your screenshot and ask: "Would a designer at Strava ship this?" If you see emoji icons, gradient buttons, sparkles, cards in cards, or a wall of badges, fix it.
