# Parent dashboard on your Google Drive: setup (about 10 minutes, once)

Everything is stored in **your** Google Drive under `MainQuest/<your son>/`. A small Google Apps Script (the "relay") runs under your
Google account. It receives data from his phone, files it into folders, and serves your dashboard. There's no other server and no cost.

## 1. Create the relay
1. Go to **script.google.com**, signed in as you (not your son) → **New project**. Name it `MainQuest relay`.
2. Delete what's in `Code.gs` and paste in all of [`Code.gs`](Code.gs). Near the top, change `CHILD_NAME = 'My kid'` to his name. `ROOT_FOLDER_ID` already points to your MainQuest folder
   (`drive.google.com/drive/folders/1IbG6v5rQzOqCvLVNDFYnSNoRgeKFIhAO`). **Do this signed in as the Google account that owns that folder.**
3. **＋ next to Files → HTML**, name it exactly `Dashboard`, delete its contents, and paste in all of [`Dashboard.html`](Dashboard.html).
4. *(Recommended)* **Services ＋ → Drive API → Add.** This lets the relay turn paper photos into text (OCR), so Claude can read them reliably.
5. At the top, pick the function **setup** → **Run**. Google asks for permission; approve it for your own account.
   (Google warns that it "hasn't verified this app". That's expected because it's your own script: **Advanced → Go to MainQuest relay**.)
6. Open **Execution log**. Copy the **PARENT KEY** (starts with `P-`) somewhere safe, like a password manager.

## 2. Publish it
**Deploy → New deployment → ⚙ Web app** → Execute as: **Me** · Who has access: **Anyone** → **Deploy**. Copy the **Web app URL** (ends in `/exec`).

"Anyone" lets his phone reach the relay without a Google sign-in. Every request still needs a key: his phone has its own key, and you have the parent key.
The URL alone can't read anything.

## 3. Open your dashboard
Bookmark `<Web app URL>?view=dashboard` and sign in with the parent key. It works on your phone too.

## 4. Link his phone
Dashboard → **Settings → Link a phone** gives you a 6-character code. On his phone: **Profile → Grown-up zone (PIN) → Parent dashboard**.
Paste the Web app URL, type the code, and tap **Link**. To skip pasting the URL, put it in `www/config.js → cloud.url` before the next build.

## 5. Let your Claude account do the AI work
In the app's Grown-up zone → **Study AI**: turn it on and choose **Your Claude account (via Drive)**.
When he taps *Build study pack*, the paper goes to `Claude/Jobs/pending`. A scheduled task in your Claude account (Google Drive connector)
follows `MainQuest/README for Claude.md`: it builds the pack into `Claude/Study packs/`, and his phone picks it up on its next sync.
A weekly scheduled task writes `Reports/<date> Weekly report.md`, which you can share with his counselor from Drive.

## Updating later
After pasting a new `Code.gs` or `Dashboard.html`, use **Deploy → Manage deployments → ✎ → Version: New version → Deploy**.
That keeps the same URL, so his phone doesn't need relinking.

## Privacy
- His parking-lot notes never leave the phone, and not even a count is sent.
- Paper photos are uploaded only when "Share paper photos" is on, or when he asks for a study pack.
- If the parent key leaks, run `newParentKey()`. Dashboard → **Disconnect his phone** cuts the phone off until you link it again.
