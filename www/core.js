'use strict';
/* MainQuest core: state, persistence, native bridge, sound, rewards engine, reminders. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dayKey(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hm(str) { const [h, m] = (str || '0:0').split(':').map(Number); return { h, m }; }
function atTime(str, base = new Date()) { const { h, m } = hm(str); const d = new Date(base); d.setHours(h, m, 0, 0); return d; }
function fmtTime(d) { let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; }
function fmtHM(str) { return fmtTime(atTime(str)); }
function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }

/* ------------------------------------------------------------------ State */
const KEY = 'mainquest.v1';
function freshState() {
  return {
    v: 2,
    created: Date.now(),
    profile: { onboarded: false, style: { peak: 'unsure', sprint: 10, helpers: [], start: 'easy', reward: 'levels', voice: 'chill' } },
    player: { tag: '', grade: 5, emblem: 'bolt', color: '#7dff8a', banner: 'night', title: 'newcomer', theme: 'volt' },
    tasks: [], assignments: [], events: [], papers: [],
    routines: DEFAULT_ROUTINES(),
    parking: [],
    stats: { xp: 0, coins: 0, missions: 0, focusMin: 0, sessions: [], estimates: [], days: {}, focusByDay: {}, scanDays: {}, cardsMastered: 0,
      comebacks: 0, loadout: 0, quizzes: 0, bossesDown: 0, lastActive: Date.now(), bestWeek: 0 },
    season: { id: -1, xp: 0, claimed: [] },
    weekly: { week: '', offered: [], picked: [], progress: {}, done: [] },
    achievements: {},
    boosts: 0,
    unlocked: { themes: ['volt'], banners: ['night'], titles: ['newcomer'], colors: ['#7dff8a', '#3de2ff', '#ffb84d', '#a98bff', '#ff5cc8', '#ffd84a'] },
    rewards: DEFAULT_REWARDS(), rewardsUpdated: Date.now(), redemptions: [], wishes: [], notes: [],
    tips: { seen: {}, liked: [], hidden: [], day: '', current: '' },
    settings: { bedtime: '21:00', schoolQuiet: true, schoolStart: '07:55', schoolEnd: '15:10', checkins: 'gentle',
      sound: true, haptics: true, calm: false, light: false, bigtext: false, dyslexic: false, weekGoal: 4, pin: '',
      anchors: { afterschool: '15:45', aftersnack: '16:15', afterdinner: '18:45' },
      gcal: { on: false, connected: false, cals: [], readIds: [], writeId: '', pushEvents: true, pushDue: true, pushStudy: false, remind: true, invites: 'approved', contacts: [], lastSync: 0, lastError: '' },
      ai: { on: !!APP_CONFIG.ai.enabled, via: APP_CONFIG.ai.via || 'drive', key: '', model: APP_CONFIG.ai.model, endpoint: APP_CONFIG.ai.endpoint, apiVersion: APP_CONFIG.ai.apiVersion,
        maxPages: APP_CONFIG.ai.maxPages, monthlyLimit: APP_CONFIG.ai.monthlyLimit, usage: { month: '', builds: 0 }, lastTest: null }, parentSeen: 0 },
    gevents: [], gseen: {}, gdeletes: [], outbox: [], log: [], goals: [],
    cloud: { linked: false, childId: '', childName: '', lastSync: 0, lastError: '', sharePhotos: true, url: '', key: '' },
    focus: null, fired: {},
  };
}
let S = load();

/* ------------------------------------------------------------------ Activity log (feeds targets, the parent dashboard and counselor report).
   Never logs the text of parked thoughts. */
const T = {
  log(type, data = {}) {
    const e = { id: uid() + uid(), ts: new Date().toISOString(), type, data };
    (S.outbox = S.outbox || []).push(e);
    (S.log = S.log || []).push(e);
    if (S.log.length > 3000 || (S.log[0] && Date.now() - Date.parse(S.log[0].ts) > 35 * 864e5)) S.log = S.log.filter(x => Date.now() - Date.parse(x.ts) < 35 * 864e5).slice(-3000);
    if (S.outbox.length > 5000) S.outbox = S.outbox.slice(-5000);
    if (typeof Cloud !== 'undefined') Cloud.soon();
  },
};
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { console.warn('load failed', e); }
  return freshState();
}
function migrate(s) {
  const f = freshState();
  const out = { ...f, ...s };
  out.profile = { ...f.profile, ...s.profile, style: { ...f.profile.style, ...((s.profile || {}).style) } };
  out.player = { ...f.player, ...s.player };
  if (!s.player && s.profile && s.profile.name) out.player.tag = s.profile.name;
  out.stats = { ...f.stats, ...s.stats };
  out.settings = { ...f.settings, ...s.settings, anchors: { ...f.settings.anchors, ...((s.settings || {}).anchors) }, ai: { ...f.settings.ai, ...((s.settings || {}).ai) }, gcal: { ...f.settings.gcal, ...((s.settings || {}).gcal) } };
  out.unlocked = { ...f.unlocked, ...s.unlocked };
  out.tips = { ...f.tips, ...s.tips };
  out.cloud = { ...f.cloud, ...s.cloud };
  out.season = { ...f.season, ...s.season }; out.weekly = { ...f.weekly, ...s.weekly };
  if (!(s.v >= 2)) {
    // v1 → v2: add "scan papers" to after-school routine if missing
    const r = out.routines.find(x => x.id === 'r-after');
    if (r && !r.items.some(i => i.action === 'scan')) r.items.splice(1, 0, { id: 'r-after-scan', emoji: '📸', text: 'Scan today’s papers', action: 'scan' });
    out.v = 2;
  }
  return out;
}
let saveTimer = null;
function save(opts = {}) {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn(e); }
  if (Native.ok) { const P = Native.plugin('Preferences'); P && P.set({ key: KEY, value: JSON.stringify(S) }).catch(() => {}); }
  if (opts.noSchedule) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => Reminders.sync(), 1200);
}

/* ------------------------------------------------------------------ Photo storage (IndexedDB — photos are too big for localStorage) */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('mainquest', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('images');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async put(id, dataUrl) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('images', 'readwrite'); tx.objectStore('images').put(dataUrl, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
  async get(id) { const db = await this.open(); return new Promise(res => { const q = db.transaction('images').objectStore('images').get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); },
  async del(id) { const db = await this.open(); return new Promise(res => { const tx = db.transaction('images', 'readwrite'); tx.objectStore('images').delete(id); tx.oncomplete = res; tx.onerror = res; }); },
};

/* ------------------------------------------------------------------ Native bridge (Capacitor) */
const Native = {
  get ok() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); },
  plugin(name) {
    const C = window.Capacitor; if (!C) return null;
    if (C.Plugins && C.Plugins[name]) return C.Plugins[name];
    try { return C.registerPlugin ? C.registerPlugin(name) : null; } catch (e) { return null; }
  },
};
async function restoreFromNative() {
  // WebView storage can be wiped by the OS; Preferences is the durable copy.
  if (!Native.ok) return false;
  const P = Native.plugin('Preferences'); if (!P) return false;
  try {
    const { value } = await P.get({ key: KEY });
    if (value && !localStorage.getItem(KEY)) { S = migrate(JSON.parse(value)); localStorage.setItem(KEY, value); return true; }
  } catch (e) { }
  return false;
}

/* ------------------------------------------------------------------ Sound + haptics (no audio files needed) */
const Sfx = {
  ctx: null,
  tone(freq, start, dur, type = 'sine', vol = 0.18) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
    const t = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  },
  play(kind) {
    if (!S.settings.sound) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const P = {
        tap: [[660, 0, .08]], step: [[784, 0, .12], [1046, .08, .18]],
        done: [[523, 0, .15], [659, .1, .15], [784, .2, .15], [1046, .3, .35]],
        level: [[523, 0, .12], [659, .1, .12], [784, .2, .12], [1046, .3, .12], [1318, .42, .5]],
        chime: [[880, 0, .5, 'triangle', .12], [1318, .25, .7, 'triangle', .1]],
        check: [[700, 0, .25, 'triangle', .1]],
        coin: [[988, 0, .08, 'square', .06], [1318, .07, .25, 'square', .06]],
      }[kind] || [];
      P.forEach(p => this.tone(...p));
    } catch (e) { }
  },
};
function buzz(kind = 'light') {
  if (!S.settings.haptics) return;
  const H = Native.ok && Native.plugin('Haptics');
  if (H) { (kind === 'success' ? H.notification({ type: 'SUCCESS' }) : H.impact({ style: kind === 'heavy' ? 'HEAVY' : 'LIGHT' })).catch(() => {}); return; }
  if (navigator.vibrate) navigator.vibrate(kind === 'success' ? [30, 60, 40] : kind === 'heavy' ? 60 : 15);
}

/* ------------------------------------------------------------------ Confetti (~1s, then calm) */
function confetti(power = 1) {
  if (S.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('#confetti'); const c = cv.getContext('2d');
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; c.scale(devicePixelRatio, devicePixelRatio);
  const colors = ['#5ee0b5', '#ffd166', '#8fa2ff', '#ff6bd6', '#5ec8ff', '#ff9b5e'];
  const N = Math.round(90 * power);
  const ps = Array.from({ length: N }, () => ({ x: innerWidth / 2, y: innerHeight * 0.45, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4,
    r: Math.random() * 6 + 4, c: pick(colors), a: Math.random() * 6, va: (Math.random() - .5) * .4 }));
  const t0 = performance.now();
  (function frame(t) {
    const el = t - t0; c.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .45; p.vx *= .99; p.a += p.va;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.globalAlpha = Math.max(0, 1 - el / 1400); c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); });
    if (el < 1400) requestAnimationFrame(frame); else c.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

/* ------------------------------------------------------------------ Progress engine: XP, levels, ranks (only go up) */
const XP = { step: 2, tiny: 5, small: 10, big: 20, boss: 35, sprint: 5, checkin: 1, routineItem: 1, routineAll: 5, estimate: 3, warmup: 3,
  study: 15, card: 1, quiz: 10, scan: 5, challenge: 25, bossDown: 50, achievement: 20 };
function stepXP(l) { return 50 + 15 * l; }
function levelFor(xp) { let l = 1, acc = 0; while (xp >= acc + stepXP(l)) { acc += stepXP(l); l++; } return l; }
function levelBounds(l) { let acc = 0; for (let i = 1; i < l; i++) acc += stepXP(i); return [acc, acc + stepXP(l)]; }
function markGoodDay() { S.stats.days[today()] = (S.stats.days[today()] || 0) + 1; }
function goodDaysThisWeek() { const ws = weekStart(); let n = 0; for (let i = 0; i < 7; i++) if (S.stats.days[dayKey(addDays(ws, i))]) n++; return n; }
function totalGoodDays() { return Object.keys(S.stats.days).length; }

/* Seasons: ~6-week blocks from Aug 3 2026. Earned unlocks never expire. */
const SEASON_EPOCH = new Date('2026-08-03T00:00:00');
function seasonNow() { return Math.floor((Date.now() - SEASON_EPOCH) / (SEASON_DAYS * 864e5)) + 1; }
function seasonEnds() { return new Date(+SEASON_EPOCH + seasonNow() * SEASON_DAYS * 864e5); }
function ensureSeason() { const n = seasonNow(); if (S.season.id !== n) S.season = { id: n, xp: 0, claimed: [] }; }
function seasonTier() { return Math.min(SEASON_TRACK.length - 1, Math.floor(S.season.xp / SEASON_TIER_XP)); }

function award(amount, reason) {
  if (!amount) return 0;
  ensureSeason();
  const before = levelFor(S.stats.xp), rankBefore = rankFor(before);
  S.stats.xp += amount; S.stats.coins += amount; S.season.xp += amount;
  const after = levelFor(S.stats.xp);
  const gw = goodDaysThisWeek(); if (gw > S.stats.bestWeek) S.stats.bestWeek = gw;
  if (after > before) {
    const fresh = [];
    THEMES.filter(t => t.level && t.level <= after && !S.unlocked.themes.includes(t.id)).forEach(t => { S.unlocked.themes.push(t.id); fresh.push(`Theme: ${t.name}`); });
    BANNERS.filter(b => b.level && b.level <= after && !S.unlocked.banners.includes(b.id)).forEach(b => { S.unlocked.banners.push(b.id); fresh.push(`Banner: ${b.name}`); });
    const rankAfter = rankFor(after);
    setTimeout(() => UI.levelUp(after, rankAfter.name !== rankBefore.name || rankAfter.div !== rankBefore.div, fresh), 900);
  }
  return amount;
}

/* Season track rewards are claimed by tapping (feels like loot, nothing expires). */
function claimSeasonTier(i) {
  if (i > seasonTier() || S.season.claimed.includes(i) || !SEASON_TRACK[i]) return null;
  const r = SEASON_TRACK[i]; S.season.claimed.push(i); let text = '';
  if (r.banner && !S.unlocked.banners.includes(r.banner)) { S.unlocked.banners.push(r.banner); text = 'Banner: ' + BANNERS.find(b => b.id === r.banner).name; }
  if (r.theme && !S.unlocked.themes.includes(r.theme)) { S.unlocked.themes.push(r.theme); text = 'Theme: ' + THEMES.find(t => t.id === r.theme).name; }
  if (r.color && !S.unlocked.colors.includes(r.color)) { S.unlocked.colors.push(r.color); text = 'New emblem color'; }
  if (r.title && !S.unlocked.titles.includes(r.title)) { S.unlocked.titles.push(r.title); text = 'Title: ' + TITLES.find(t => t.id === r.title).name; }
  if (r.boost) { S.boosts += r.boost; text = `${r.boost}× Double-XP boost`; }
  save({ noSchedule: true });
  return text || 'Already unlocked — +25 coins';
}

/* Weekly challenges: 5 offered, he picks 3. */
function weekId() { return dayKey(weekStart()); }
function ensureWeekly() {
  if (S.weekly.week === weekId()) return;
  const pool = CHALLENGE_POOL.slice().sort(() => Math.random() - .5).slice(0, 5).map(c => c.id);
  S.weekly = { week: weekId(), offered: pool, picked: [], progress: {}, done: [] };
}
function track(ev, n = 1) {
  ensureWeekly();
  const w = S.weekly;
  w.picked.forEach(id => {
    const c = CHALLENGE_POOL.find(x => x.id === id); if (!c || c.ev !== ev || w.done.includes(id)) return;
    w.progress[id] = (w.progress[id] || 0) + n;
    if (w.progress[id] >= c.goal) { w.done.push(id); award(XP.challenge); S.season.xp += 75; setTimeout(() => UI.toast(`Challenge complete: ${c.name}  +100 season XP`), 600); }
  });
  checkAchievements();
}
function unlockAch(id) {
  if (S.achievements[id]) return;
  S.achievements[id] = Date.now(); award(XP.achievement);
  const a = ACHIEVEMENTS.find(x => x.id === id);
  const t = TITLES.find(x => x.ach === id); if (t && !S.unlocked.titles.includes(t.id)) S.unlocked.titles.push(t.id);
  setTimeout(() => UI.achievement(a, t), 1200);
}
function checkAchievements() {
  const st = S.stats, td = today();
  const doneToday = S.tasks.filter(t => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === td).length;
  if (st.missions >= 1) unlockAch('first');
  if (doneToday >= 5) unlockAch('combo');
  if (doneToday >= 2 && !todayQueue().length) unlockAch('sweep');
  if (st.estimates.filter(e => e.act / e.est >= .7 && e.act / e.est <= 1.3).length >= 5) unlockAch('timelord');
  if (Object.keys(st.scanDays).length >= 5) unlockAch('papertrail');
  if (st.cardsMastered >= 50) unlockAch('scholar');
  if ((st.focusByDay[td] || 0) >= 60) unlockAch('lockedin');
  if (st.comebacks >= 10) unlockAch('comeback');
  if (st.loadout >= 5) unlockAch('loadout');
  if (st.bossesDown >= 1) unlockAch('boss');
  if (S.tasks.some(t => (t.focusMin || 0) >= 25)) unlockAch('deepfocus');
}

/* Loot drop — variable reward that thins out gradually. */
function dropChance() { const m = S.stats.missions; return m <= 3 ? 1 : m <= 10 ? .5 : m <= 25 ? .33 : .22; }
function rollDrop() {
  if (Math.random() > dropChance()) return null;
  const r = Math.random();
  const lockedColor = EMBLEM_COLORS.find(c => !S.unlocked.colors.includes(c));
  if (r < .2 && lockedColor) { S.unlocked.colors.push(lockedColor); return { text: 'New emblem color unlocked' }; }
  if (r < .35) { S.boosts++; return { text: 'Double-XP boost (next mission)' }; }
  const coins = pick([5, 8, 10, 10, 15, 20, 25]); S.stats.coins += coins;
  return { text: `+${coins} coins` };
}

/* ------------------------------------------------------------------ Tasks */
function taskDate(t) { return t.date || today(); }
function isToday(t) { return !t.done && t.when !== 'later' && taskDate(t) <= today(); }
function carriedDays(t) { if (t.done || t.when === 'later') return 0; const d = taskDate(t); if (d >= today()) return 0; return Math.round((new Date(today()) - new Date(d)) / 864e5); }
function sizeXP(t) { if (t.kind === 'study') return XP.study; return t.size === 'boss' ? XP.boss : XP[t.size] || XP.small; }
function todayQueue() {
  const list = S.tasks.filter(isToday);
  const style = S.profile.style.start;
  const weight = { tiny: 0, small: 1, big: 2, boss: 3 };
  list.sort((a, b) => {
    if ((a.pin || 0) !== (b.pin || 0)) return (b.pin || 0) - (a.pin || 0);
    const da = a.defer === today() ? a.deferAt : 0, db = b.defer === today() ? b.deferAt : 0;
    if (da !== db) return da - db;
    // things due soonest first
    const dueA = a.assignmentId ? (S.assignments.find(x => x.id === a.assignmentId) || {}).due || '9' : '9';
    const dueB = b.assignmentId ? (S.assignments.find(x => x.id === b.assignmentId) || {}).due || '9' : '9';
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    const ta = a.time ? atTime(a.time) : null, tb = b.time ? atTime(b.time) : null;
    if (ta && tb && +ta !== +tb) return ta - tb;
    if (style === 'hard') return (weight[b.size] || 1) - (weight[a.size] || 1) || a.created - b.created;
    if (style === 'easy') return (weight[a.size] || 1) - (weight[b.size] || 1) || a.created - b.created;
    return (a.order ?? a.created) - (b.order ?? b.created);
  });
  return list;
}
function tidyBacklog() {
  let moved = 0;
  S.tasks.forEach(t => { if (!t.assignmentId && carriedDays(t) >= 3) { t.when = 'later'; t.date = null; t.parkedAuto = true; moved++; } });
  const cutoff = Date.now() - 21 * 864e5;
  S.tasks = S.tasks.filter(t => !t.done || t.doneAt > cutoff);
  if (moved) save({ noSchedule: true });
  return moved;
}
function newTask(title, extra = {}) {
  const t = { id: uid(), title: title.trim(), emoji: autoEmoji(title), size: 'small', when: 'today', date: today(), time: '', anchor: '',
    steps: [], gear: [], est: null, done: false, created: Date.now(), focusMin: 0, kind: 'todo', ...extra };
  if (t.when === 'tomorrow') { t.when = 'today'; t.date = dayKey(addDays(new Date(), 1)); }
  if (t.when === 'later') t.date = null;
  return t;
}
function completeTask(t, { actualMin = null } = {}) {
  if (t.done) return null;
  t.done = true; t.doneAt = Date.now(); t.pin = 0; t.defer = null;
  S.stats.missions++;
  const parts = [];
  let base = sizeXP(t); let boosted = false;
  if (S.boosts > 0) { S.boosts--; base *= 2; boosted = true; }
  let total = award(base); parts.push(`+${base} ${t.kind === 'study' ? 'study' : 'mission'}${boosted ? ' (2×)' : ''}`);
  const firstToday = !S.tasks.some(x => x !== t && x.done && x.doneAt && dayKey(new Date(x.doneAt)) === today());
  if (firstToday) { total += award(XP.warmup); parts.push(`+${XP.warmup} first of the day`); }
  const a0 = t.assignmentId && S.assignments.find(x => x.id === t.assignmentId);
  T.log('mission_done', { task: t.id, kind: t.kind, size: t.size, subject: a0 ? a0.subject : null, assignmentId: t.assignmentId || null, est: t.est || null, actual: actualMin || null, planned: !!t.time });
  if (t.kind === 'study') T.log('study_done', { assignmentId: t.assignmentId || null, subject: a0 ? a0.subject : null });
  let estimateMsg = '';
  if (t.est && actualMin) {
    S.stats.estimates.push({ est: t.est, act: actualMin, at: Date.now() }); track('guess'); T.log('estimate', { est: t.est, act: actualMin, subject: a0 ? a0.subject : null });
    const ratio = actualMin / t.est;
    if (ratio >= 0.7 && ratio <= 1.3) { total += award(XP.estimate); parts.push(`+${XP.estimate} Time Detective`); estimateMsg = `Guessed ${t.est} min, took ${actualMin}. Dialed in.`; }
    else estimateMsg = `Guessed ${t.est} min, took ${actualMin}. ${ratio > 1 ? 'Took longer than you thought — normal. Pad your next guess a bit.' : 'Faster than you thought.'}`;
  }
  let bossMsg = '';
  if (t.assignmentId) {
    const a = S.assignments.find(x => x.id === t.assignmentId);
    if (a) {
      if (a.maxHp) { const r = damageBoss(a, 100); if (r) bossMsg = r; }
      if (a.type !== 'test' && a.type !== 'quiz' && a.type !== 'project') finishAssignment(a);
      if (a.type === 'project' && !S.tasks.some(x => x.assignmentId === a.id && !x.done)) finishAssignment(a);
    }
    if (t.kind === 'study') track('study');
  }
  markGoodDay(); track('mission');
  const drop = rollDrop();
  save();
  return { total, parts, drop, estimateMsg, bossMsg };
}

/* ------------------------------------------------------------------ School: assignments, study planning, bosses */
const STUDY_ROUNDS = {
  test: [['Make or review flashcards', 'Do 10 minutes of flashcards'], ['Practice quiz', 'Review what you missed'], ['Flashcards: only the hard ones', 'Practice quiz again'], ['Final review: skim everything once', 'Pack what you need for the test']],
  quiz: [['Flashcards for 10 minutes', 'Practice quiz'], ['Review mistakes', 'Quick final run-through']],
};
const PROJECT_STEPS = ['Read the requirements + make a checklist', 'Gather materials / research', 'Build part 1', 'Build part 2', 'Finish + polish', 'Final check, pack it for school'];
function anchorTime(k) { return k === 'beforebed' ? fmt24(new Date(+atTime(S.settings.bedtime) - 75 * 60e3)) : (S.settings.anchors[k] || '16:00'); }
function dayLoad(dk) { return S.tasks.filter(t => !t.done && t.date === dk).length + S.events.filter(e => e.date === dk && e.time).length; }
function planAssignment(a) {
  S.tasks.filter(t => t.assignmentId === a.id && !t.done && t.auto && t.gcalId).forEach(t => (S.gdeletes = S.gdeletes || []).push(t.gcalId));
  S.tasks = S.tasks.filter(t => !(t.assignmentId === a.id && !t.done && t.auto));
  const due = new Date(a.due + 'T12:00:00'); const now = new Date(); now.setHours(12, 0, 0, 0);
  const daysUntil = Math.round((due - now) / 864e5);
  const lastDay = daysUntil >= 1 ? addDays(due, -1) : now;
  const mk = (title, date, steps, extra = {}) => {
    const dk = dayKey(date);
    const load = dayLoad(dk); const slot = load >= 2 ? 'afterdinner' : load === 1 ? 'aftersnack' : 'afterschool';
    S.tasks.push(newTask(title, { date: dk, time: a.noRemind ? '' : anchorTime(slot), anchor: slot, assignmentId: a.id, auto: true, emoji: subj(a.subject).icon,
      steps: steps.map(text => ({ id: uid(), text, done: false })), kind: extra.kind || 'homework', size: extra.size || 'small', est: extra.est || null }));
  };
  let n = 0;
  if (a.type === 'test' || a.type === 'quiz') {
    const rounds = STUDY_ROUNDS[a.type];
    const offsets = a.type === 'test' ? [6, 4, 2, 1] : [2, 1];
    let days = offsets.map(o => addDays(due, -o)).filter(d => d >= now);
    if (!days.length) days = [now];
    const used = rounds.slice(rounds.length - days.length);
    days.forEach((d, i) => mk(`Study ${a.title} · ${i + 1}/${days.length}`, d, used[i], { kind: 'study', est: 20 }));
    n = days.length;
  } else if (a.type === 'project') {
    const avail = Math.max(1, Math.round((lastDay - now) / 864e5) + 1);
    n = clamp(Math.round(avail / 2), 2, 6); if (avail < n) n = avail;
    const steps = n >= PROJECT_STEPS.length ? PROJECT_STEPS : [PROJECT_STEPS[0], ...PROJECT_STEPS.slice(2, 2 + n - 2), PROJECT_STEPS[5]].slice(0, n);
    for (let i = 0; i < n; i++) { const d = addDays(now, Math.round(i * (avail - 1) / Math.max(1, n - 1))); mk(`${a.title}: ${steps[i]}`, d, [steps[i]], { kind: 'study', size: 'big', est: 30 }); }
  } else if (a.type === 'form') {
    mk(`Get signed: ${a.title}`, now, ['Give it to a grown-up', 'Put it back in your folder'], { size: 'tiny' });
  } else {
    mk(a.title, lastDay, [], { size: a.type === 'reading' ? 'small' : 'small', kind: 'homework' });
  }
  if (a.type === 'test' || a.type === 'quiz' || a.type === 'project') { a.maxHp = n * 100; a.hp = a.maxHp; a.boss = a.boss || bossName(a.subject, a.id); }
  else { a.maxHp = 0; a.hp = 0; }
}
function createAssignment(fields) {
  const a = { id: uid(), title: fields.title.trim(), subject: fields.subject || 'other', type: fields.type || 'homework', due: fields.due, created: Date.now(),
    notes: fields.notes || '', paperIds: fields.paperIds || [], status: 'open', teks: fields.teks || [] };
  T.log('assignment_added', { type: a.type, subject: a.subject, due: a.due, lead_days: daysUntil(a.due), source: (fields.paperIds || []).length ? 'scan' : 'manual' });
  S.assignments.push(a); planAssignment(a); save();
  return a;
}
function damageBoss(a, dmg) {
  if (!a.maxHp || a.defeated) return '';
  a.hp = Math.max(0, a.hp - dmg);
  if (a.hp <= 0) { a.defeated = true; S.stats.bossesDown++; award(XP.bossDown); setTimeout(() => UI.toast(`Boss down: ${a.boss}. You’re ready for ${a.title}.`), 700); return `Boss down: ${a.boss}`; }
  return `${a.boss} −${dmg} HP`;
}
function finishAssignment(a) {
  if (a.status === 'done') return;
  a.status = 'done'; a.doneAt = Date.now();
  const left = Math.round((new Date(a.due + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5);
  T.log('assignment_done', { type: a.type, subject: a.subject, early_days: left });
  if (left >= 2) { unlockAch('speedrun'); track('early'); } else if (left === 0) unlockAch('clutch'); else if (left === 1) track('early');
}
function openAssignments() { return S.assignments.filter(a => a.status !== 'done').sort((a, b) => a.due < b.due ? -1 : 1); }
function daysUntil(dk) { return Math.round((new Date(dk + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5); }
function dueLabel(dk) { const n = daysUntil(dk); return n < 0 ? `${-n} day${n === -1 ? '' : 's'} ago` : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 7 ? new Date(dk + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' }) : new Date(dk + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function dueLc(dk) { const l = dueLabel(dk); return l === 'Today' || l === 'Tomorrow' ? l.toLowerCase() : l; }
/* Study AI is only "ready" when a grown-up switched it on, a key is set, and the monthly limit isn't hit. */
function aiUsage() { const ai = S.settings.ai; const m = today().slice(0, 7); if (!ai.usage || ai.usage.month !== m) ai.usage = { month: m, builds: 0 }; return ai.usage; }
function aiStatus() {
  const ai = S.settings.ai;
  if (!ai.on) return { ready: false, code: 'off', label: 'Off' };
  if (ai.via === 'drive') return S.cloud.linked ? (ai.monthlyLimit && aiUsage().builds >= ai.monthlyLimit ? { ready: false, code: 'limit', label: 'On — monthly limit reached' } : { ready: true, code: 'ready', label: 'On — via your Claude account (Drive)' }) : { ready: false, code: 'nolink', label: 'On — link the parent dashboard first' };
  if (!ai.key && /anthropic\.com/.test(ai.endpoint || '')) return { ready: false, code: 'nokey', label: 'On — needs an API key' };
  if (ai.monthlyLimit && aiUsage().builds >= ai.monthlyLimit) return { ready: false, code: 'limit', label: 'On — monthly limit reached' };
  return { ready: true, code: 'ready', label: 'On — ready' };
}
function aiHeaders() {
  const ai = S.settings.ai; const h = { 'content-type': 'application/json', 'anthropic-version': ai.apiVersion || '2023-06-01' };
  if (ai.key) h['x-api-key'] = ai.key;
  if (/api\.anthropic\.com/.test(ai.endpoint || '')) h['anthropic-dangerous-direct-browser-access'] = 'true';
  return h;
}
/* Tiny natural-language parse: "math at 4pm", "science project tomorrow", "read later" */
function parseQuick(text) {
  const extra = {};
  if (/\btomorrow\b/i.test(text)) { extra.when = 'tomorrow'; text = text.replace(/\btomorrow\b/i, ''); }
  if (/\b(later|someday)\b/i.test(text)) { extra.when = 'later'; text = text.replace(/\b(later|someday)\b/i, ''); }
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
  if (m) {
    let h = +m[1]; const mi = +(m[2] || 0); const ap = (m[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; if (!ap && h < 8) h += 12;
    if (h < 24 && mi < 60) { extra.time = `${pad(h)}:${pad(mi)}`; text = text.replace(m[0], ''); }
  }
  text = text.replace(/\s+/g, ' ').replace(/\s+(at|on)\s*$/i, '').trim() || 'Mission';
  return { title: text.charAt(0).toUpperCase() + text.slice(1), extra };
}
function itemsOn(dk) {
  return {
    events: S.events.filter(e => e.date === dk).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1),
    due: S.assignments.filter(a => a.due === dk),
    google: (typeof GSync !== 'undefined') ? GSync.onDay(dk) : [],
    tasks: S.tasks.filter(t => t.date === dk).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1),
  };
}

/* ------------------------------------------------------------------ Orientation */
function upcomingEvents(from = new Date(), horizonH = 30) {
  const ev = []; const end = new Date(from.getTime() + horizonH * 3600e3);
  for (let dOff = 0; dOff <= 1; dOff++) {
    const base = addDays(from, dOff); const dk = dayKey(base); const wd = base.getDay();
    S.routines.forEach(r => { if (!r.days.includes(wd)) return; if ((r.log[dk] || []).length >= r.items.length) return; ev.push({ kind: 'routine', id: r.id, at: atTime(r.time, base), title: r.name, emoji: r.emoji }); });
    S.tasks.forEach(t => { if (t.done || !t.time || t.when === 'later') return; const td = taskDate(t); const eff = td < today() ? today() : td; if (eff !== dk) return; ev.push({ kind: 'task', id: t.id, at: atTime(t.time, base), title: t.title, emoji: t.emoji }); });
    S.events.forEach(e => { if (e.date !== dk || !e.time) return; ev.push({ kind: 'event', id: e.id, at: atTime(e.time, base), title: e.title, emoji: e.emoji || '📅' }); });
    (S.gevents || []).forEach(g => { if (g.date !== dk || !g.time || g.selfStatus === 'declined') return; ev.push({ kind: 'gevent', id: g.key, at: new Date(g.start), title: g.title, emoji: '📅' }); });
    ev.push({ kind: 'bed', at: atTime(S.settings.bedtime, base), title: 'Bedtime', emoji: '😴' });
  }
  return ev.filter(e => e.at > from && e.at < end).sort((a, b) => a.at - b.at);
}
function routineActive(now = new Date()) {
  const dk = today(), wd = now.getDay();
  return S.routines.find(r => {
    if (!r.days.includes(wd)) return false;
    const at = atTime(r.time); const done = (r.log[dk] || []).length;
    return done < r.items.length && now >= new Date(at - 10 * 60e3) && now <= new Date(+at + 90 * 60e3) && r.skipped !== dk;
  });
}
function inSchoolQuiet(d) {
  const st = S.settings; if (!st.schoolQuiet) return false;
  const wd = d.getDay(); if (wd === 0 || wd === 6) return false;
  return d >= atTime(st.schoolStart, d) && d < atTime(st.schoolEnd, d);
}
function inNightQuiet(d) { const bed = atTime(S.settings.bedtime, d); const wake = atTime('06:30', d); return d >= new Date(+bed + 30 * 60e3) || d < wake; }
function fmt24(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

const Reminders = {
  ready: false,
  plan(now = new Date()) {
    const voice = S.profile.style.voice; const out = [];
    const horizon = new Date(+now + 8 * 864e5);
    const push = (o) => { if (o.at > now && o.at < horizon && !inNightQuiet(o.at) && !(o.kind === 'event' && inSchoolQuiet(o.at))) out.push(o); };
    // Missions with a time: heads-up (−5), at time, gentle follow-up (+10). Varied wording each time.
    S.tasks.forEach(t => {
      if (t.done || !t.time || t.when === 'later') return;
      const td = taskDate(t); const d = new Date((td < today() ? today() : td) + 'T00:00:00');
      const at = atTime(t.time, d);
      if (inSchoolQuiet(at)) return;
      if (!t.auto) push({ key: `h-${t.id}-${+at}`, at: new Date(+at - 5 * 60e3), title: 'Heads up', body: voiceLine(voice, 'heads', t.title), kind: 'mission', taskId: t.id, channel: 'missions' });
      push({ key: `s-${t.id}-${+at}`, at, title: `${t.emoji} ${t.title}`, body: voiceLine(voice, 'start', t.title), kind: 'mission', taskId: t.id, channel: 'missions' });
      if (!t.auto) push({ key: `f-${t.id}-${+at}`, at: new Date(+at + 10 * 60e3), title: `${t.emoji} Still waiting`, body: voiceLine(voice, 'follow', t.title), kind: 'mission', taskId: t.id, channel: 'missions' });
    });
    // Routines on their days.
    for (let dOff = 0; dOff <= 7; dOff++) {
      const base = addDays(now, dOff); const wd = base.getDay(); const dk = dayKey(base);
      S.routines.forEach(r => {
        if (!r.remind || !r.days.includes(wd)) return;
        if ((r.log[dk] || []).length >= r.items.length) return;
        const at = atTime(r.time, base);
        push({ key: `r-${r.id}-${dk}`, at, title: `${r.emoji} ${r.name}`, body: `${r.items.length} quick steps. First: ${r.items[0].emoji} ${r.items[0].text}`, kind: 'routine', routineId: r.id, channel: 'routines' });
        push({ key: `rf-${r.id}-${dk}`, at: new Date(+at + 20 * 60e3), title: `${r.emoji} ${r.name}`, body: pick(['Still on it? Tap to see your next step.', 'Quick check — what step are you on?', 'Almost there? Tap for the next step.']), kind: 'routine', routineId: r.id, channel: 'routines' });
      });
      // Transition warning before bedtime: 30 min heads-up.
      const bed = atTime(S.settings.bedtime, base);
      push({ key: `bed-${dk}`, at: new Date(+bed - 30 * 60e3), title: '30 minutes to bedtime', body: pick(LINES.evening), kind: 'bed', channel: 'routines' });
    }
    // School: due tomorrow (after school) and turn-in day (before school). Events: 30-min heads-up.
    S.assignments.filter(a => a.status !== 'done' || a.type === 'test' || a.type === 'quiz').forEach(a => {
      if (a.result) return;
      const due = new Date(a.due + 'T00:00:00'); const ty = atype(a.type);
      if (a.status !== 'done') push({ key: `d1-${a.id}`, at: atTime(S.settings.anchors.afterschool, addDays(due, -1)), title: `Due tomorrow: ${a.title}`, body: a.type === 'test' || a.type === 'quiz' ? `${ty.name} tomorrow. One more round of study and you’re set.` : 'Knock it out today so tomorrow is easy.', kind: 'assign', channel: 'school' });
      push({ key: `d0-${a.id}`, at: atTime('07:20', due), title: a.type === 'test' || a.type === 'quiz' ? `${ty.name} today: ${a.title}` : a.type === 'form' ? `Bring it signed: ${a.title}` : `Turn in today: ${a.title}`, body: a.type === 'test' || a.type === 'quiz' ? 'You trained for this. Breathe, read every question.' : 'Check it’s in your bag.', kind: 'assign', channel: 'school' });
    });
    S.events.forEach(e => {
      if (!e.time || e.noRemind) return;
      const at = atTime(e.time, new Date(e.date + 'T00:00:00'));
      push({ key: `ev-${e.id}`, at: new Date(+at - 30 * 60e3), title: `${e.title} in 30 min`, body: e.where ? `At ${e.where}. Time to get ready.` : 'Time to get ready.', kind: 'event', channel: 'routines' });
    });
    if (S.settings.gcal.on && S.settings.gcal.remind) (S.gevents || []).forEach(g => {
      if (g.allDay || g.selfStatus === 'declined') return;
      const at = new Date(g.start - 30 * 60e3); if (inSchoolQuiet(at)) return;
      push({ key: `g-${g.key}`, at, title: `${g.title} in 30 min`, body: g.location ? `At ${g.location}. Time to get ready.` : 'Time to get ready.', kind: 'event', channel: 'routines' });
    });
    out.sort((a, b) => a.at - b.at);
    return out.slice(0, 150);
  },
  idFor(key) { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000 + 1; },

  async init() {
    if (Native.ok) {
      const LN = Native.plugin('LocalNotifications'); if (!LN) return;
      try {
        await LN.createChannel({ id: 'missions', name: 'Mission reminders', importance: 4, vibration: true, description: 'Heads-up and start reminders for missions' });
        await LN.createChannel({ id: 'routines', name: 'Routines', importance: 4, vibration: true, description: 'Morning, after-school and bedtime routines' });
        await LN.createChannel({ id: 'school', name: 'School due dates', importance: 4, vibration: true, description: 'What is due tomorrow and today' });
        await LN.createChannel({ id: 'focus', name: 'Focus sprints', importance: 4, vibration: true, description: 'Sprint finished and check-ins' });
        await LN.registerActionTypes({ types: [
          { id: 'MISSION', actions: [{ id: 'start', title: '▶ Start' }, { id: 'snooze', title: '⏰ 10 min' }, { id: 'done', title: '✅ Done' }] },
          { id: 'ROUTINE', actions: [{ id: 'open', title: '👉 Next step' }, { id: 'snooze', title: '⏰ 10 min' }] },
          { id: 'FOCUS', actions: [{ id: 'open', title: '🎯 Back to it' }] },
        ] });
        LN.addListener('localNotificationActionPerformed', ev => this.onAction(ev.actionId, (ev.notification || {}).extra || {}));
      } catch (e) { console.warn('LN init', e); }
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', ev => { if (ev.data && ev.data.type === 'notif-action') this.onAction(ev.data.action, ev.data.extra || {}); });
    }
    this.ready = true;
    this.sync();
  },
  async permission() {
    if (Native.ok) { const LN = Native.plugin('LocalNotifications'); if (!LN) return 'unavailable'; try { return (await LN.checkPermissions()).display; } catch (e) { return 'unknown'; } }
    return ('Notification' in window) ? Notification.permission : 'unsupported';
  },
  async ask() {
    if (Native.ok) {
      const LN = Native.plugin('LocalNotifications');
      try { const r = await LN.requestPermissions(); this.sync(); return r.display; } catch (e) { return 'denied'; }
    }
    if ('Notification' in window) { const r = await Notification.requestPermission(); return r; }
    return 'unsupported';
  },
  async exactStatus() {
    if (!Native.ok) return null;
    const LN = Native.plugin('LocalNotifications');
    try { if (LN.checkExactNotificationSetting) return (await LN.checkExactNotificationSetting()).exact_alarm; } catch (e) { }
    return null;
  },
  async fixExact() { const LN = Native.plugin('LocalNotifications'); try { await LN.changeExactNotificationSetting(); } catch (e) { } },

  async sync() {
    if (!this.ready) return;
    if (!Native.ok) return; // web uses tick()
    const LN = Native.plugin('LocalNotifications'); if (!LN) return;
    try {
      const pending = await LN.getPending();
      const keep = new Set(['focus']);
      const cancel = (pending.notifications || []).filter(n => !keep.has((n.extra || {}).kind)).map(n => ({ id: n.id }));
      if (cancel.length) await LN.cancel({ notifications: cancel });
      const items = this.plan();
      if (!items.length) return;
      await LN.schedule({ notifications: items.map(o => ({
        id: this.idFor(o.key), title: o.title, body: o.body, channelId: o.channel,
        schedule: { at: o.at, allowWhileIdle: true },
        actionTypeId: o.kind === 'mission' ? 'MISSION' : o.kind === 'routine' ? 'ROUTINE' : undefined,
        extra: { kind: o.kind, taskId: o.taskId, routineId: o.routineId, key: o.key },
        smallIcon: 'ic_stat_mainquest', iconColor: '#7dff8a',
      })) });
    } catch (e) { console.warn('schedule failed', e); }
  },
  /* Focus sprint notifications (end-of-sprint + "still there?" when he leaves the app). */
  async focusNotify(id, at, title, body) {
    if (Native.ok) {
      const LN = Native.plugin('LocalNotifications'); if (!LN) return;
      try { await LN.schedule({ notifications: [{ id, title, body, channelId: 'focus', schedule: { at, allowWhileIdle: true }, actionTypeId: 'FOCUS', extra: { kind: 'focus' }, smallIcon: 'ic_stat_mainquest', iconColor: '#7dff8a' }] }); } catch (e) { }
    } else {
      clearTimeout(this['_ft' + id]);
      this['_ft' + id] = setTimeout(() => this.webShow(title, body, { kind: 'focus' }), Math.max(0, at - Date.now()));
    }
  },
  async focusCancel(id) {
    if (Native.ok) { const LN = Native.plugin('LocalNotifications'); try { await LN.cancel({ notifications: [{ id }] }); } catch (e) { } }
    else clearTimeout(this['_ft' + id]);
  },
  async webShow(title, body, extra = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const actions = extra.kind === 'mission' ? [{ action: 'start', title: '▶ Start' }, { action: 'snooze', title: '⏰ 10 min' }] : [];
        await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: extra.key || title, data: extra, actions, vibrate: [80, 60, 80] });
        return true;
      }
      new Notification(title, { body, icon: 'icons/icon-192.png' }); return true;
    } catch (e) { return false; }
  },
  /* Web fallback loop: fire due reminders (app open or recently backgrounded). */
  tick() {
    if (Native.ok) return;
    const now = Date.now();
    const due = this.plan(new Date(now - 3 * 60e3)).filter(o => +o.at <= now && !S.fired[o.key]);
    due.forEach(o => {
      S.fired[o.key] = now;
      if (document.hidden) this.webShow(o.title, o.body, { kind: o.kind, taskId: o.taskId, routineId: o.routineId, key: o.key });
      else UI.banner(o);
      Sfx.play('chime'); buzz('heavy');
    });
    if (due.length) {
      const cutoff = now - 3 * 864e5; Object.keys(S.fired).forEach(k => { if (S.fired[k] < cutoff) delete S.fired[k]; });
      save({ noSchedule: true });
    }
  },
  onAction(action, extra) {
    if (action === 'start') S._fromReminder = Date.now();
    T.log('reminder_action', { action, kind: extra.kind || null });
    const t = extra.taskId && S.tasks.find(x => x.id === extra.taskId);
    if (action === 'snooze') {
      if (t) { const d = new Date(Date.now() + 10 * 60e3); t.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`; save(); UI.toast('Snoozed 10 minutes ⏰'); }
      else if (extra.routineId) { this.focusNotify(this.idFor('rs' + extra.routineId), new Date(Date.now() + 10 * 60e3), '⏰ Routine time again', 'Ready for the next step?'); }
      return;
    }
    if (action === 'done' && t) { UI.finishQuick(t); return; }
    if (action === 'start' && t) { UI.go('home'); Focus.preflight(t.id); return; }
    if (extra.routineId) { UI.go('routines'); UI.openRoutine(extra.routineId); return; }
    if (extra.kind === 'focus' && S.focus) { Focus.render(); return; }
    if (extra.kind === 'assign') { School.seg = 'due'; UI.go('school'); return; }
    if (t) { UI.go('home'); }
  },
};

/* In-app dialogs (browser prompt/confirm are blocked in some frames and feel jarring to kids). */
function ask(text, { input = false, value = '', placeholder = '', ok = 'OK', cancel = 'Cancel', type = 'text' } = {}) {
  return new Promise(resolve => {
    let d = document.getElementById('dlg');
    if (!d) { d = document.createElement('div'); d.id = 'dlg'; document.body.appendChild(d); }
    d.innerHTML = `<div class="dlg-box" role="alertdialog" aria-modal="true"><p class="dlg-q">${esc(text)}</p>
      ${input ? `<input class="field" id="dlg-in" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" enterkeyhint="done">` : ''}
      <div class="btn-row"><button class="btn" data-d="no">${esc(cancel)}</button><button class="btn primary" data-d="yes">${esc(ok)}</button></div></div>`;
    d.hidden = false;
    const inp = d.querySelector('#dlg-in'); if (inp) setTimeout(() => inp.focus(), 30);
    const done = v => { d.hidden = true; d.innerHTML = ''; resolve(v); };
    d.onclick = e => { const b = e.target.closest('[data-d]'); if (b) done(b.dataset.d === 'yes' ? (input ? inp.value : true) : (input ? null : false)); else if (e.target === d) done(input ? null : false); };
    if (inp) inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); };
  });
}
