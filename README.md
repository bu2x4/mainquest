# MainQuest — your planner, built like a game

An Android app for a 10–15 year old with ADHD. It tracks missions (to-dos), school assignments, tests, and projects. It plans study time on a monthly calendar and reminds him what's due. It turns photos of school papers into TEKS-aligned study material, and it pulls him back when he drifts. Everything stays on the phone, except paper photos he chooses to send to Study AI. There are no accounts, no ads, and no tracking.

## What's new in v2
- **Calendar (monthly view):** shows school due dates, study sessions, personal events (practice, appointments), and to-dos. Tap a day to see it or add something.
- **School tab**
  - **Due:** everything open, grouped Today / Tomorrow / This week. Reminders go out the afternoon before ("Due tomorrow") and the morning of ("Turn in today").
  - **Papers:** photograph each paper from school. **Study AI** reads it and builds a short summary, key terms, TEKS tags, 8–15 flashcards, a practice quiz, and study steps. If it spots a due date, it offers to put it on the calendar. It never answers the actual homework. It teaches the ideas and writes *similar* practice problems.
  - **Study:** flashcard decks with light spaced repetition, plus practice quizzes with explanations.
- **Study planning:** add a test or project and MainQuest spaces study sessions before the due date. A test gets sessions 6, 4, 2 and 1 days out; a project gets milestones spread across the available days. Sessions land on the calendar at your "after school / after snack / after dinner" times.
- **Boss battles:** every test and project is a boss with an HP bar. Each study session, flashcard round, and practice quiz does damage.
- **Teen redesign** (based on research into what 10–15 year olds find motivating versus "cringe"):
  - **Look:** dark HUD style with bundled game fonts.
  - **Identity:** gamertag, emblem, banner, and title.
  - **Ranks:** Recruit → Legend. Ranks only go up.
  - **Seasons:** a free track of about 6 weeks. Earned rewards never expire.
  - **Weekly challenges:** he picks 3 of 5.
  - **Extras:** 16 achievements and loot drops.
  - **Gone:** the cute pet, baby talk, and anything that punishes missed days.
- **TEKS index:** 224 current Texas standards (grades 5–8: math 2012, science 2021, ELA 2017, social studies 2022) are bundled in `www/teks.js` and used to tag study material.

## Study AI connection (ships OFF)
Study AI is a switch you control. It ships **off**: no network calls, and no mention of AI anywhere in his app. He can still scan papers, make his own flashcards, and tag TEKS by hand.

**To deploy it later** (Profile → Grown-up zone → Study AI connection):
1. **API key:** create one at console.anthropic.com → API keys (add a few dollars of credit). Paste it and tap **Test connection**. The result and time are shown.
2. **Model:** choose Sonnet 5.5 (best with handwriting and diagrams) or Haiku 5.5 (cheaper). **Custom** takes any future model ID.
3. **Limits:** max pages per paper (default 6) and a monthly cap on study packs (default 100; 0 = none). A usage counter has a reset button.
4. **Advanced:** endpoint URL and API version. Point the endpoint at your own proxy later if you'd rather keep the key off the phone. **Restore build defaults** resets these (the key is kept).
5. Flip **Connection on**. Status reads *On — ready*, with a LIVE badge.

Turn it off any time; every setting is kept. To change what a *fresh install* starts with (on/off, model, limits, endpoint), edit `www/config.js` before building.

Photos go to the endpoint only when he taps "Build study pack": the paper's pages, his grade, and that grade's TEKS list. No name or account is sent.

## Google Calendar sync (send + receive invites)
MainQuest syncs through the **phone's own calendar**, which Android keeps in two-way sync with the Google account signed in on the phone. There's no Google Cloud project, OAuth setup, or extra key. It works with a Family Link account and keeps working offline; changes sync when the phone is back online.

**Set up** (Profile → Grown-up zone → Google Calendar sync):
1. Make sure his Google account is on the phone (Android Settings → Accounts) with **Calendar** sync on.
2. Tap **Connect phone calendars** and allow calendar access.
3. Pick which calendars **show in MainQuest** (his calendar, family, school, holidays…) and which one MainQuest **saves to**.
4. Choose what to **send to Google:** his events (on), due dates + tests as all-day events (on), study sessions (off).
5. **Sending invites:** Off / **Approved contacts only** (default; you add names + emails) / Anyone. Every invite he sends is listed under "Invites he sent."

**What he gets:**
- **Invites:** new invites show on Home with **Yes / Maybe / No**. His reply goes to the organizer through Google. A notification appears when a new one arrives.
- **Calendar:** Google events appear in Calendar (colored by calendar), the planner, the "Next:" bar, and 30-minute heads-up reminders (can be turned off).
- **Sending invites:** when he creates an event he can add guests. Google emails them a normal invite when the phone syncs, and their replies (going / maybe / not going) show on the event.
- **Two-way edits:** if someone moves or renames a MainQuest event in Google Calendar, it updates in MainQuest. Deleting it in either place removes it in both.

Sync runs when the app opens or returns to the foreground, after every change, and every 10 minutes while open. The Android calendar itself syncs with Google in the background. Use **Test without Google** to try the flow with a phone-only test calendar.

**Note:** a school (Google Workspace for Education) account may have calendar sharing or invites to outside people restricted by the district. A personal or Family Link account has no such limits.

## Planning ahead (rolling 7 days)
**Plan ahead** (Home) opens a 7-day strip starting today. Tap a day or use ‹ › to cycle through. For any day you can:
- see what's fixed (events, tests and due items, routines);
- add missions by typing ("read at 7pm");
- add a due date or test, a study block, or an event; the planner reopens when you save;
- give a mission a when-then time (tap its time chip: After school → After snack → After dinner → Before bed);
- move a mission a day earlier or later, or park it in Later;
- pull parked items into that day.

More than 3 missions on a day gets a gentle "heavy day" note. Reminders are now scheduled 8 days ahead, so planned days fire even if the app isn't opened.

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

## Parent dashboard (data in your Google Drive)
- **Where the data lives:** your own Google Drive, `MainQuest/<child>/`. It contains activity logs, daily summaries, assignments, paper photos, progress, requests, targets and reports. A Google Apps Script relay ([`relay/Code.gs`](relay/Code.gs)) running under your account files it there.
- **Dashboard:** `<relay URL>?view=dashboard`, signed in with the parent key. It has eight tabs: Overview (KPIs vs the previous period, targets met, focus minutes, auto flags), Targets (Daily Report Card editor with raise/lower suggestions), Requests (rewards, wishes, notes, reward menu), School (assignments, on-time %, paper photos), Study (minutes, subjects, quizzes), Strategies (clinical names, evidence level, what good looks like, independence/fading signals), a printable **Counselor report** (with CSV export, before/after timeline, and medication entries excluded unless chosen) and Settings.
- **Your Claude account as the AI:** study packs and weekly reports are produced by scheduled Claude tasks that read/write the Drive folder (see `MainQuest/README for Claude.md`, created by setup). No API key on the phone.
- Setup: **[relay/SETUP.md](relay/SETUP.md)**. After editing `dashboard/`, run `node scripts/build-dashboard.js` to regenerate `relay/Dashboard.html`.
