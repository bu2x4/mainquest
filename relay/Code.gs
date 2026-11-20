/**
 * MainQuest Drive relay — runs as YOU inside your Google account and files everything the phone sends into
 * Google Drive → MainQuest/<child>/…  Your Claude account (Google Drive connector + scheduled tasks) reads and
 * writes the same folders. Nothing is stored anywhere else.
 *
 * Setup (once): paste this file into script.google.com → run setup() → Deploy → New deployment → Web app,
 * Execute as: Me, Who has access: Anyone → copy the /exec URL. Full steps: relay/SETUP.md in the repo.
 *
 * Keys: PHONE key (phone writes its own data, reads only notes/targets/study packs meant for it) and
 * PARENT key (dashboard reads everything, sends notes/approvals). The URL alone can do nothing.
 */

const CHILD_NAME = 'My kid';          // ← change before running setup() (folder name only)
const ROOT_NAME = 'MainQuest';
const VERSION = 3;

/* ------------------------------------------------------------------ setup */
function setup() {
  const P = PropertiesService.getScriptProperties();
  const root = getOrCreate_(DriveApp.getRootFolder(), ROOT_NAME);
  const kid = getOrCreate_(root, P.getProperty('CHILD') || CHILD_NAME);
  P.setProperty('CHILD', kid.getName());
  const ids = {};
  const make = (key, path) => { let f = kid; path.split('/').forEach(n => { f = getOrCreate_(f, n); }); ids[key] = f.getId(); };
  make('activity', 'Activity'); make('daily', 'Daily'); make('assignments', 'Assignments'); make('papers', 'Papers');
  make('progress', 'Progress'); make('requests', 'Requests'); make('tophone', 'To phone'); make('reports', 'Reports');
  make('jobsPending', 'Claude/Jobs/pending'); make('jobsDone', 'Claude/Jobs/done'); make('packs', 'Claude/Study packs');
  ids.kid = kid.getId(); ids.root = root.getId();
  P.setProperty('IDS', JSON.stringify(ids));
  if (!P.getProperty('PARENT_KEY')) P.setProperty('PARENT_KEY', 'P-' + rand_(28));
  if (!P.getProperty('PHONE_KEY')) P.setProperty('PHONE_KEY', 'K-' + rand_(28));
  put_(root, 'README for Claude.md', README_FOR_CLAUDE.replace(/{{CHILD}}/g, kid.getName()));
  ['actions.json', 'goals.json'].forEach(n => { if (!find_(DriveApp.getFolderById(ids.tophone), n)) put_(DriveApp.getFolderById(ids.tophone), n, '[]'); });
  Logger.log('MainQuest relay ready for "%s".\n\nPARENT KEY (dashboard sign-in — keep private):\n%s\n\nDrive folder: %s',
    kid.getName(), P.getProperty('PARENT_KEY'), kid.getUrl());
}
/** Run this if a parent key may have leaked. Then sign in to the dashboard again. */
function newParentKey() { PropertiesService.getScriptProperties().setProperty('PARENT_KEY', 'P-' + rand_(28)); Logger.log('New PARENT KEY: %s', PropertiesService.getScriptProperties().getProperty('PARENT_KEY')); }

/* ------------------------------------------------------------------ http */
function doGet(e) {
  const v = e && e.parameter && e.parameter.view;
  if (v === 'dashboard') return HtmlService.createHtmlOutputFromFile('Dashboard').setTitle('MainQuest — Parent dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return out_({ ok: true, app: 'MainQuest relay', version: VERSION, dashboard: '?view=dashboard' });
}
function doPost(e) { let req; try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad request' }); } return out_(handle_(req)); }
/** called by the dashboard page when it is served from this script (google.script.run) */
function api(req) { return handle_(req || {}); }

function handle_(req) {
  const P = PropertiesService.getScriptProperties();
  if (!P.getProperty('IDS')) return { ok: false, error: 'Relay not set up — run setup() in the script editor' };
  try {
    if (req.op === 'pair') return pair_(req);
    const role = req.key && req.key === P.getProperty('PARENT_KEY') ? 'parent' : req.key && req.key === P.getProperty('PHONE_KEY') ? 'phone' : null;
    if (!role) { Utilities.sleep(400); return { ok: false, error: 'not linked', code: 'auth' }; }
    const fn = (role === 'phone' ? PHONE_OPS : PARENT_OPS)[req.op];
    if (!fn) return { ok: false, error: 'unknown op' };
    if (role === 'phone') { const prev = JSON.parse(P.getProperty('LAST_SEEN') || '{}'); P.setProperty('LAST_SEEN', JSON.stringify({ at: new Date().toISOString(), version: req.v || prev.version || null })); }
    return Object.assign({ ok: true }, fn(req));
  } catch (x) {
    return { ok: false, error: String(x && x.message || x) };
  }
}

/* ------------------------------------------------------------------ pairing */
function pair_(req) {
  const P = PropertiesService.getScriptProperties(), C = CacheService.getScriptCache();
  const fails = +(C.get('pairfails') || 0); if (fails >= 10) return { ok: false, error: 'Too many tries. Wait an hour.' };
  const code = String(req.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const want = JSON.parse(P.getProperty('PAIR') || 'null');
  if (!want || want.code !== code || Date.now() > want.exp) { C.put('pairfails', String(fails + 1), 3600); Utilities.sleep(800); return { ok: false, error: 'That code didn’t work. Get a fresh one from the dashboard.' }; }
  P.deleteProperty('PAIR');
  P.setProperty('PHONE_KEY', 'K-' + rand_(28));          // linking always issues a fresh phone key (old phone stops working)
  return { ok: true, phoneKey: P.getProperty('PHONE_KEY'), child: P.getProperty('CHILD') };
}

/* ------------------------------------------------------------------ phone ops */
const PHONE_OPS = {
  /** activity events + current state. events: [{id, ts, type, data}] */
  push(req) {
    return locked_(() => {
      const ids = ids_();
      if (Array.isArray(req.events) && req.events.length) {
        const byMonth = {};
        req.events.forEach(ev => { if (ev && ev.id && ev.ts && ev.type !== 'park') { const m = String(ev.ts).slice(0, 7); (byMonth[m] = byMonth[m] || []).push({ id: ev.id, ts: ev.ts, type: ev.type, data: ev.data || {} }); } });
        Object.keys(byMonth).forEach(m => {
          const folder = DriveApp.getFolderById(ids.activity), name = m + '.jsonl';
          const f = find_(folder, name); const old = f ? f.getBlob().getDataAsString() : '';
          const seen = {}; old.split('\n').forEach(l => { const i = l.indexOf('"id":"'); if (i >= 0) seen[l.slice(i + 6, l.indexOf('"', i + 6))] = 1; });
          const add = byMonth[m].filter(ev => !seen[ev.id]).sort((a, b) => a.ts < b.ts ? -1 : 1).map(ev => JSON.stringify(ev)).join('\n');
          if (add) put_(folder, name, old ? old.replace(/\n?$/, '\n') + add : add);
        });
      }
      if (req.daily && typeof req.daily === 'object') mergeJson_(ids.daily, 'daily.json', {}, cur => Object.assign(cur, req.daily));
      if (Array.isArray(req.assignments)) putJson_(ids.assignments, 'assignments.json', req.assignments);
      if (Array.isArray(req.papers)) mergeJson_(ids.papers, 'index.json', [], cur => { const m = {}; cur.forEach(p => { m[p.id] = p; }); req.papers.forEach(p => { m[p.id] = Object.assign(m[p.id] || {}, p, { folder: (m[p.id] || {}).folder || null }); }); return Object.keys(m).map(k => m[k]); });
      if (req.snapshot) putJson_(ids.progress, 'progress.json', Object.assign({ synced_at: new Date().toISOString() }, req.snapshot));
      if (Array.isArray(req.requests)) putJson_(ids.requests, 'requests.json', req.requests);
      return { received: (req.events || []).length };
    });
  },

  /** one page photo: {paperId, n, b64, meta:{date, subject, title}} */
  photo(req) {
    const folder = paperFolder_(req.paperId, req.meta || {});
    const name = 'page-' + (+req.n || 1) + '.jpg';
    const old = find_(folder, name); if (old) old.setTrashed(true);
    const blob = Utilities.newBlob(Utilities.base64Decode(String(req.b64).replace(/^data:[^,]+,/, '')), 'image/jpeg', name);
    const file = folder.createFile(blob);
    let text = '';
    try {   // optional OCR so Claude can always read the words (needs Services → Drive API added to this script)
      const doc = Drive.Files.create({ name: 'ocr-tmp', mimeType: 'application/vnd.google-apps.document', parents: [folder.getId()] }, blob, { ocrLanguage: 'en' });
      text = DocumentApp.openById(doc.id).getBody().getText(); DriveApp.getFileById(doc.id).setTrashed(true);
      put_(folder, 'page-' + (+req.n || 1) + '.txt', text.trim());
    } catch (x) { /* OCR not enabled — photos only */ }
    return { fileId: file.getId(), ocr: !!text };
  },

  /** ask your Claude account to build a study pack for a paper */
  job(req) {
    const folder = paperFolder_(req.paperId, req.meta || {});
    const ids = ids_();
    const job = Object.assign({}, req.job || {}, { paper_id: req.paperId, paper_folder_id: folder.getId(), paper_folder: 'Papers/' + folder.getName(), requested_at: new Date().toISOString(),
      output: { folder: 'Claude/Study packs', file_name: req.paperId + '.json' } });
    putJson_(ids.jobsPending, req.paperId + '.json', job);
    return { queued: true };
  },

  /** what's waiting for the phone */
  pull(req) {
    const ids = ids_();
    const actions = readJson_(ids.tophone, 'actions.json', []).filter(a => !a.applied_at);
    const goals = readJson_(ids.tophone, 'goals.json', []);
    const packs = [];
    const it = DriveApp.getFolderById(ids.packs).getFiles();
    while (it.hasNext()) { const f = it.next(); if (!/\.json$/.test(f.getName())) continue;
      try { const j = JSON.parse(f.getBlob().getDataAsString()); packs.push({ paperId: f.getName().replace(/\.json$/, ''), study: j, fileId: f.getId() }); } catch (x) { } }
    return { actions, goals, packs };
  },

  /** phone confirms it applied actions / imported packs */
  ack(req) {
    return locked_(() => {
      const ids = ids_(); const now = new Date().toISOString();
      if ((req.actions || []).length) mergeJson_(ids.tophone, 'actions.json', [], cur => { cur.forEach(a => { if (req.actions.indexOf(a.id) >= 0) a.applied_at = now; }); return cur; });
      (req.packs || []).forEach(pid => {
        const pk = find_(DriveApp.getFolderById(ids.packs), pid + '.json'); if (pk) pk.moveTo(DriveApp.getFolderById(ids.jobsDone)).setName(pid + ' (study pack, delivered).json');
        const jb = find_(DriveApp.getFolderById(ids.jobsPending), pid + '.json'); if (jb) jb.moveTo(DriveApp.getFolderById(ids.jobsDone));
      });
      return {};
    });
  },
};

/* ------------------------------------------------------------------ parent ops */
const PARENT_OPS = {
  /** everything the dashboard needs; days = how far back for raw activity */
  dash(req) {
    const ids = ids_(), P = PropertiesService.getScriptProperties();
    const days = Math.min(400, Math.max(7, +req.days || 120));
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const events = []; const folder = DriveApp.getFolderById(ids.activity);
    const months = {}; for (let t = Date.now() - days * 864e5; t <= Date.now() + 864e5; t += 20 * 864e5) months[new Date(t).toISOString().slice(0, 7)] = 1;
    months[new Date().toISOString().slice(0, 7)] = 1;
    Object.keys(months).forEach(m => { const f = find_(folder, m + '.jsonl'); if (!f) return; f.getBlob().getDataAsString().split('\n').forEach(l => { if (!l) return; try { const ev = JSON.parse(l); if (ev.ts >= since) events.push(ev); } catch (x) { } }); });
    const reports = []; const rit = DriveApp.getFolderById(ids.reports).getFiles();
    while (rit.hasNext()) { const f = rit.next(); reports.push({ name: f.getName(), url: f.getUrl(), updated: f.getLastUpdated().toISOString() }); }
    reports.sort((a, b) => a.updated < b.updated ? 1 : -1);
    const pending = []; const jit = DriveApp.getFolderById(ids.jobsPending).getFiles(); while (jit.hasNext()) pending.push(jit.next().getName().replace(/\.json$/, ''));
    return {
      child: P.getProperty('CHILD'), lastSeen: JSON.parse(P.getProperty('LAST_SEEN') || 'null'), driveUrl: DriveApp.getFolderById(ids.kid).getUrl(),
      events, daily: readJson_(ids.daily, 'daily.json', {}), assignments: readJson_(ids.assignments, 'assignments.json', []),
      papers: readJson_(ids.papers, 'index.json', []), progress: readJson_(ids.progress, 'progress.json', null), requests: readJson_(ids.requests, 'requests.json', []),
      goals: readJson_(ids.tophone, 'goals.json', []), actions: readJson_(ids.tophone, 'actions.json', []).slice(-60), timeline: readJson_(ids.progress, 'timeline.json', []),
      reports: reports.slice(0, 30), jobsPending: pending,
    };
  },
  /** paper photo as a data URL (photos are never public) */
  img(req) {
    const ids = ids_(); const idx = readJson_(ids.papers, 'index.json', []); const p = idx.filter(x => x.id === req.paperId)[0];
    if (!p || !p.folder) return { images: [] };
    const out = []; const it = DriveApp.getFolderById(p.folder).getFiles();
    while (it.hasNext()) { const f = it.next(); if (/^page-\d+\.jpg$/.test(f.getName())) out.push({ n: +f.getName().match(/\d+/)[0], url: 'data:image/jpeg;base64,' + Utilities.base64Encode(f.getBlob().getBytes()), driveUrl: f.getUrl() }); }
    out.sort((a, b) => a.n - b.n);
    return { images: out };
  },
  /** note / redeem_given / wish_add / wish_decline / set_rewards → the phone applies it on next sync */
  act(req) {
    const kinds = ['note', 'redeem_given', 'wish_add', 'wish_decline', 'set_rewards'];
    if (kinds.indexOf(req.kind) < 0) throw new Error('bad action');
    const a = { id: 'A' + rand_(10), kind: req.kind, data: req.data || {}, created_at: new Date().toISOString(), applied_at: null };
    locked_(() => mergeJson_(ids_().tophone, 'actions.json', [], cur => cur.concat([a]).slice(-300)));
    return { action: a };
  },
  goals(req) { putJson_(ids_().tophone, 'goals.json', (req.goals || []).slice(0, 8)); return {}; },
  timeline(req) { putJson_(ids_().progress, 'timeline.json', (req.timeline || []).slice(0, 200)); return {}; },
  paircode() {
    const code = rand_(6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    PropertiesService.getScriptProperties().setProperty('PAIR', JSON.stringify({ code, exp: Date.now() + 30 * 60e3 }));
    CacheService.getScriptCache().remove('pairfails');
    return { code, expires_in_min: 30 };
  },
  unlink() { PropertiesService.getScriptProperties().setProperty('PHONE_KEY', 'K-' + rand_(28)); return {}; },
};

/* ------------------------------------------------------------------ helpers */
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ids_() { return JSON.parse(PropertiesService.getScriptProperties().getProperty('IDS')); }
function rand_(n, abc) {   // Utilities.getUuid() is a crypto-random v4 UUID
  abc = abc || 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let hex = ''; while (hex.length < n * 2) hex += Utilities.getUuid().replace(/-/g, '');
  let s = ''; for (let i = 0; i < n; i++) s += abc[parseInt(hex.substr(i * 2, 2), 16) % abc.length]; return s;
}
function getOrCreate_(parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
function find_(folder, name) { const it = folder.getFilesByName(name); return it.hasNext() ? it.next() : null; }
function put_(folder, name, text) { const f = find_(folder, name); if (f) { f.setContent(text); return f; } return folder.createFile(name, text, 'text/plain'); }
function readJson_(folderId, name, dflt) { const f = find_(DriveApp.getFolderById(folderId), name); if (!f) return dflt; try { return JSON.parse(f.getBlob().getDataAsString()); } catch (x) { return dflt; } }
function putJson_(folderId, name, obj) { return put_(DriveApp.getFolderById(folderId), name, JSON.stringify(obj, null, 1)); }
function mergeJson_(folderId, name, dflt, fn) { const cur = readJson_(folderId, name, dflt); const next = fn(cur); putJson_(folderId, name, next === undefined ? cur : next); }
function locked_(fn) { const l = LockService.getScriptLock(); l.waitLock(25000); try { return fn(); } finally { l.releaseLock(); } }
function paperFolder_(paperId, meta) {
  const ids = ids_(); let folderId = null;
  locked_(() => mergeJson_(ids.papers, 'index.json', [], cur => {
    let p = cur.filter(x => x.id === paperId)[0];
    if (!p) { p = { id: paperId, date: meta.date || new Date().toISOString().slice(0, 10), subject: meta.subject || 'other', title: meta.title || '' }; cur.push(p); }
    if (!p.folder) {
      const nm = (p.date || '') + ' ' + (meta.subject || p.subject || 'other') + ' - ' + (String(meta.title || p.title || 'paper').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60)) + ' [' + paperId.slice(0, 6) + ']';
      p.folder = DriveApp.getFolderById(ids.papers).createFolder(nm).getId();
    }
    folderId = p.folder; return cur;
  }));
  return DriveApp.getFolderById(folderId);
}

/* ------------------------------------------------------------------ instructions Claude reads */
const README_FOR_CLAUDE = [
  '# MainQuest — instructions for Claude (scheduled runs)',
  '',
  'This folder is written by the MainQuest phone app (an ADHD-friendly planner) for {{CHILD}}, through a relay script owned by the parent.',
  'You are the parent\'s Claude account. Use the Google Drive connector. Never edit or delete files outside the two output folders named below.',
  '',
  '## Folder map (inside MainQuest/{{CHILD}}/)',
  '- Activity/YYYY-MM.jsonl — one event per line: {id, ts, type, data}. Types include focus_start, focus_end{minutes,completed,drifts}, checkin{result:yes|drift}, refocus, stuck_smaller|two|move|help|swap, mission_done, study_done, estimate{est,act}, routine_done{routine,late_min}, paper_scanned, assignment_added{lead_days}, assignment_done{early_days}, quiz{pct}, cards{n,known}, reminder_action{action}, when_then, plan, break, app_open.',
  '- Daily/daily.json — per-day metrics already computed by the app (missions_done, focus_min, on_task_pct, start_latency, estimate_ratio, routines, papers_scanned, study_sessions, on_time …).',
  '- Assignments/assignments.json — school work with due dates, status, study sessions planned/done.',
  '- Papers/<date subject - title>/page-N.jpg (+ page-N.txt OCR text when available); Papers/index.json lists them.',
  '- Progress/progress.json (level, routines, settings), Progress/timeline.json (parent-entered changes: new strategy, school change, etc.).',
  '- To phone/goals.json — Daily Report Card targets the parent set. Requests/requests.json — reward requests and wishes.',
  '',
  '## Job 1 — study packs (check every run)',
  'For each file in Claude/Jobs/pending/ whose paper_id has NO file yet in Claude/Study packs/:',
  '1. Read the job JSON. Open the paper photos in its paper_folder (page-1.jpg, page-2.jpg…) and the page-N.txt OCR text if present (use the text when you cannot view an image).',
  '2. Follow job.instructions exactly (they are the same rules the app uses: teach the ideas, never answer the actual graded questions, grade-level language, TEKS only from job.teks_list).',
  '3. Create Claude/Study packs/<paper_id>.json containing ONLY the JSON object described in job.instructions (no markdown fences).',
  'The phone downloads it on its next sync and moves the job to Claude/Jobs/done/ by itself. Do not move or delete jobs.',
  '',
  '## Job 2 — weekly progress report (when asked, usually Sunday)',
  'Write Reports/YYYY-MM-DD Weekly report.md for the parent and, if he chooses to share it, a counselor. Plain language, ≤ 2 pages:',
  '1. Snapshot: 3–5 numbers vs the 2 weeks before (Daily Report Card % of days met — a day is met when ≥ 67% of applicable targets in To phone/goals.json are met; on-time assignments %; median start latency; focused minutes per school day; on-task % at check-ins).',
  '2. Targets table: each goal, days met / days applicable this week. Suggest raising a target met 6–7 of 7 days for two weeks, lowering one met ≤ 3 of 7.',
  '3. Strategies he used (from Activity): counts by type, which ones preceded finishing work, and fading signals (share of focus sessions he started himself vs from a reminder; swaps that led back to the hard task).',
  '4. Patterns: time of day / subject where starts were slow or drifts high.',
  '5. Up to 3 flags, phrased neutrally (e.g. "check-ins were always yes — a spot check would confirm accuracy"). Separate "no data" from "not done": no events for a day means the app was not used, not that work was skipped.',
  '6. Questions for the counselor / suggested adjustments. Note anything from Progress/timeline.json that happened this week.',
  'Never quote parking-lot content (it is never uploaded). Do not diagnose. Do not include medication details unless the parent asks.',
].join('\n');
