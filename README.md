# MainQuest — one mission at a time

An Android app built for a 5th grader with ADHD. It tracks missions (to-dos), reminds him at the right moments, pulls him back when he drifts, and helps him build organization and time skills step by step. All data stays on the phone. There are no accounts, no ads, and no tracking.

---

## Getting it onto his phone

### Option A — Real Android app (recommended: reminders work even when the app is closed)

GitHub builds the APK for you for free. This takes about 10 minutes once.

1. Create a free account at github.com if you don't have one, then make a **new repository** (e.g. `mainquest`). Public is simplest because the phone can download without logging in.
2. Upload this whole folder, **including the hidden `.github` folder**. The easiest ways:
   - **GitHub Desktop:** clone the empty repo, copy this folder's contents into it, then Commit → Push.
   - **Terminal:**
     ```bash
     cd mainquest
     git init && git add . && git commit -m "MainQuest"
     git branch -M main
     git remote add origin https://github.com/<you>/mainquest.git
     git push -u origin main
     ```
3. Open the repo's **Actions** tab. "Build MainQuest APK" runs automatically and takes about 5 minutes.
4. When it shows a green check, go to **Releases → latest** on his phone and tap **MainQuest.apk**.
5. Android will ask to allow installs from Chrome. Allow it, then tap **Install**.
6. Open MainQuest. When it asks about reminders, tap **Yes, remind me** and allow notifications.
7. Optional: in the Grown-up zone, tap **Allow exact alarms** if it shows. This makes reminders fire on the minute.

**Updating later:** change anything in `www/`, push again, and reinstall the new APK from Releases. It installs as an update and keeps his data, because the build always uses the same signing key in `android/app/debug.keystore`.

### Option B — Web app (fastest to try, weaker reminders)

Host the `www/` folder on any HTTPS site. The included `pages.yml` workflow can publish it to GitHub Pages: in the repo go to Settings → Pages → Source: **GitHub Actions**. Open the URL in Chrome on his phone and use ⋮ → **Add to Home screen / Install app**.
It works offline, but reminders only fire while the app is open or recently used. That's why Option A is better for daily use.

---

## First-time setup (2 minutes, ideally together)

1. **He** takes the 6-question style quiz, picks and names a buddy, and adds 1–3 missions.
2. **You** open Me → 🔒 Grown-up zone and set a 4-digit PIN. Then:
   - Set **bedtime** and **school hours**. Reminders stay quiet during school and after bedtime.
   - Adjust the **When → Then anchor times** (after school / after snack / after dinner) to match your house.
   - **Edit the reward menu together.** Coins are worth roughly 10–20 per mission. Favor privileges and experiences.
3. Review the default routines (Morning, After-school, Bedtime, Sunday Reset) on the Routines tab and edit the steps to match real life.

---

## What it does, and the research behind it

| Feature | What he sees | Why (evidence) |
|---|---|---|
| **Now screen** | ONE mission and one big Start button. "Next up" is shown faintly. | Fewer choices means less freeze. Cues belong at the "point of performance" (Barkley). |
| **Orientation bar** | Clock, day, and "Next: Bedtime in 2h 10m" with a filling bar. | ADHD time blindness. Time has to be shown outside his head. |
| **Visual timer** | A shrinking colored disc (Time Timer style). | Area is easier to read than digits for time-blind kids. |
| **Focus sprints** | 10-minute default (5–20 adjustable), with a short break and movement ideas. | Kids with ADHD hold attention for about 2–5 minutes in seatwork, so short blocks win. |
| **"Quick check" prompts** | "Were you working on it?" Both honest answers earn a point. | Self-monitoring is an established classroom intervention. Rewarding honesty avoids shame. |
| **Refocus screen** | "You noticed. That's the skill." It shows the mission and the tiny next step. | Neutral nudge plus a concrete next action. No red X's. |
| **Leaving the app mid-sprint** | After 90 seconds: "👀 Still on Math? Tap to jump back in." On return: Welcome back. | Catches the YouTube detour gently. |
| **I'm stuck menu** | Chop it smaller / just 2 minutes / move first / ask for help / swap. | Task initiation is the core ADHD barrier. Breaking tasks down lowers working-memory load. |
| **Gear check** | Before a sprint: ✏️ pencil, 📒 folder, 💧 water. | Resource management: every "go find X" trip restarts focus. |
| **Time Detective** | Guess how long a mission will take, then compare with the real time. | In an RCT (ages 9–15), time-skills training improved daily time management. |
| **When → Then plans** | "When I finish snack → then math." | Implementation intentions: d≈1.09 in kids with ADHD aged 10–11. |
| **Reminders** | A 5-minute heads-up, then "it's time," then one gentle follow-up. Wording rotates. Buttons: ▶ Start / ⏰ 10 min / ✅ Done. | Transition warnings (Barkley). Varied alerts beat identical ones (76% vs 55% adherence). |
| **Routines** | Morning, After-school, Bedtime, Sunday Reset checklists. | Organizational Skills Training (built for grades 3–5) uses routine checklists. |
| **Buddy + levels** | A pet that evolves and **never gets sad, sick, or dies**. | Engagement without guilt (Finch-style, not Habitica's HP loss). |
| **Surprise chests** | Random stickers, coins, or themes. Every mission at first, rarer later. | Unexpected rewards don't undermine motivation. Gradual thinning beats sudden drops. |
| **Good days, not streaks** | "★★★○ good days this week" (goal 4) and best week. Nothing resets to zero. | Streak loss leads to all-or-nothing quitting. |
| **No guilt pile** | Unfinished items say "Carried over" in gray. After 3 days they move quietly to Later. | Shame worsens executive function. |
| **Style alignment** | The quiz sets sprint length, start style (warm-up / hardest first / spin), focus helpers, and reminder voice. | Ownership and autonomy keep kids using it. |
| **Learns from him** | "You crushed 100% of 10-min sprints — try 15?" "You get most done after school — make it your power hour?" | Adapts to real behavior and suggests changes, never forces them. |
| **Coach tips** | One tip a day on organization and resources (launch pad, one folder, Sunday reset, fuel up, move first…), weighted to his style. 👍 / Not for me. | Builds the actual skills, not just the list. |
| **Parking Lot 🅿️** | Jot a stray thought without leaving the mission. | Captures the distraction instead of following it. |
| **Real rewards** | Coins buy items you set. He can request a new reward, and you set its price. | Parent involvement and real-world reinforcement. |
| **Notes from Dad** | A 💌 card on his Now screen. | Specific, informational praise boosts motivation (d=0.66). |

### Grown-up zone tips
- He can see the same weekly summary you see, so it never feels like surveillance.
- **Swap 1–2 rewards every 2–3 weeks.** The app reminds you. Kids with ADHD get used to rewards fast.
- Praise the *start*: "You started math without me asking!" Starting is the hard part.
- Over time, move from you planning, to planning together, to him planning while you glance at it.

---

## Project layout

```
www/            The app (plain HTML/CSS/JS, no build step)
  content.js    All words, tips, templates, rewards. Easy to customize.
  core.js       Data, XP/rewards engine, reminders (native + web)
  focus.js      Focus mode: timer, check-ins, refocus, stuck, celebrate
  ui.js         Screens, onboarding quiz, grown-up zone
android/        Capacitor Android project (generated; native notifications)
.github/        Workflows that build the APK / publish the web version
```

**Customize:** open `www/content.js` to change tip wording, reminder voices, breakdown templates, default routines, or default rewards. Push the change and reinstall.

**Backups:** Grown-up zone → Export saves a `.json` file. Import restores it on any phone.

---

*MainQuest supports ADHD skill-building but doesn't replace professional care. Share it with his teacher or clinician if it helps them help him.*
