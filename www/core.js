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
    v: 1,
    created: Date.now(),
    profile: { name: '', buddy: 'dragon', buddyName: 'Sparky', theme: 'mint', onboarded: false,
      style: { peak: 'unsure', sprint: 10, helpers: [], start: 'easy', reward: 'buddy', voice: 'chill' } },
    tasks: [],
    routines: DEFAULT_ROUTINES(),
    parking: [],
    stats: { xp: 0, coins: 0, missions: 0, focusMin: 0, sessions: [], estimates: [], days: {}, chests: 0, bestWeek: 0 },
    stickers: [],
    unlockedThemes: ['mint'],
    rewards: DEFAULT_REWARDS(),
    rewardsUpdated: Date.now(),
    redemptions: [],
    wishes: [],
    notes: [],            // praise notes from parent
    tips: { seen: {}, liked: [], hidden: [], day: '', current: '' },
    settings: { bedtime: '21:00', schoolQuiet: true, schoolStart: '07:55', schoolEnd: '15:10', checkins: 'gentle',
      sound: true, haptics: true, calm: false, light: false, bigtext: false, dyslexic: false, weekGoal: 4, pin: '',
      anchors: { afterschool: '15:45', aftersnack: '16:15', afterdinner: '18:45' } },
    focus: null,
    fired: {},
  };
}
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('load failed', e); }
  return freshState();
}
function migrate(s) {
  const f = freshState();
  const out = { ...f, ...s };
  out.profile = { ...f.profile, ...s.profile, style: { ...f.profile.style, ...(s.profile || {}).style } };
  out.stats = { ...f.stats, ...s.stats };
  out.settings = { ...f.settings, ...s.settings, anchors: { ...f.settings.anchors, ...((s.settings || {}).anchors) } };
  out.tips = { ...f.tips, ...s.tips };
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

/* ------------------------------------------------------------------ Progress engine */
const XP = { step: 2, tiny: 5, small: 10, big: 20, boss: 35, sprint: 5, checkin: 1, routineItem: 1, routineAll: 5, estimate: 3, warmup: 3, park: 0 };
function levelFor(xp) { let lvl = 1, need = 25; while (xp >= need) { lvl++; need += 25 * lvl; } return lvl; }
function levelBounds(lvl) { let lo = 0, need = 25, l = 1; while (l < lvl) { lo = need; l++; need += 25 * l; } return [lo, need]; }
function buddyStage(lvl = levelFor(S.stats.xp)) { let s = 0; STAGE_LEVELS.forEach((L, i) => { if (lvl >= L) s = i; }); return s; }
function buddyEmoji() { const b = BUDDIES[S.profile.buddy] || BUDDIES.dragon; return b.stages[buddyStage()]; }
function markGoodDay() { S.stats.days[today()] = (S.stats.days[today()] || 0) + 1; }
function goodDaysThisWeek() {
  const ws = weekStart(); let n = 0;
  for (let i = 0; i < 7; i++) if (S.stats.days[dayKey(addDays(ws, i))]) n++;
  return n;
}
function totalGoodDays() { return Object.keys(S.stats.days).length; }

/* award() is the single door for XP so level-ups and unlocks always fire. */
function award(amount, reason) {
  if (!amount) return;
  const before = levelFor(S.stats.xp), stageBefore = buddyStage(before);
  S.stats.xp += amount; S.stats.coins += amount;
  const after = levelFor(S.stats.xp);
  const gw = goodDaysThisWeek(); if (gw > S.stats.bestWeek) S.stats.bestWeek = gw;
  if (after > before) {
    const newThemes = THEMES.filter(t => t.level <= after && !S.unlockedThemes.includes(t.id));
    newThemes.forEach(t => S.unlockedThemes.push(t.id));
    const evolved = buddyStage(after) > stageBefore;
    setTimeout(() => UI.levelUp(after, evolved, newThemes), 900);
  }
  return amount;
}

/* Surprise chest — variable reward that thins out gradually (every mission early on, then rarer). */
function chestChance() {
  const m = S.stats.missions;
  if (m <= 3) return 1;          // first days: fast, guaranteed delight
  if (m <= 10) return 0.5;
  if (m <= 25) return 0.33;
  return 0.22;
}
function rollChest() {
  if (Math.random() > chestChance()) return null;
  S.stats.chests++;
  const lockedStickers = STICKERS.filter(s => !S.stickers.includes(s));
  const r = Math.random();
  if (r < 0.5 && lockedStickers.length) { const s = pick(lockedStickers); S.stickers.push(s); return { kind: 'sticker', s, text: `New sticker: ${s}` }; }
  if (r < 0.62) {
    const lockedTheme = THEMES.find(t => !S.unlockedThemes.includes(t.id));
    if (lockedTheme) { S.unlockedThemes.push(lockedTheme.id); return { kind: 'theme', text: `Secret theme unlocked: ${lockedTheme.name}!` }; }
  }
  const coins = pick([5, 5, 8, 10, 10, 15, 20, 25]); S.stats.coins += coins;
  return { kind: 'coins', text: `+${coins} bonus coins 🪙` };
}

/* ------------------------------------------------------------------ Tasks helpers */
function taskDate(t) { return t.date || today(); }
function isToday(t) { return !t.done && t.when !== 'later' && taskDate(t) <= today(); }
function carriedDays(t) { if (t.done || t.when === 'later') return 0; const d = taskDate(t); if (d >= today()) return 0; return Math.round((new Date(today()) - new Date(d)) / 864e5); }
function sizeXP(t) { return t.size === 'boss' ? XP.boss : XP[t.size] || XP.small; }
function todayQueue() {
  const list = S.tasks.filter(isToday);
  const style = S.profile.style.start;
  const weight = { tiny: 0, small: 1, big: 2, boss: 3 };
  list.sort((a, b) => {
    if ((a.pin || 0) !== (b.pin || 0)) return (b.pin || 0) - (a.pin || 0);   // "make this next" wins
    const da = a.defer === today() ? a.deferAt : 0, db = b.defer === today() ? b.deferAt : 0;
    if (da !== db) return da - db;                                              // "not now" goes to the back
    const ta = a.time ? atTime(a.time) : null, tb = b.time ? atTime(b.time) : null;
    if (ta && tb) return ta - tb;
    if (style === 'hard') return (weight[b.size] || 1) - (weight[a.size] || 1) || a.created - b.created;
    if (style === 'easy') return (weight[a.size] || 1) - (weight[b.size] || 1) || a.created - b.created;
    return (a.order ?? a.created) - (b.order ?? b.created);
  });
  return list;
}
/* Quietly park things carried over 3+ days into Later — no red backlog. */
function tidyBacklog() {
  let moved = 0;
  S.tasks.forEach(t => { if (carriedDays(t) >= 3) { t.when = 'later'; t.date = null; t.parkedAuto = true; moved++; } });
  // keep done tasks for 14 days only
  const cutoff = Date.now() - 14 * 864e5;
  S.tasks = S.tasks.filter(t => !t.done || t.doneAt > cutoff);
  if (moved) save({ noSchedule: true });
  return moved;
}
function newTask(title, extra = {}) {
  const t = { id: uid(), title: title.trim(), emoji: autoEmoji(title), size: 'small', when: 'today', date: today(), time: '', anchor: '',
    steps: [], gear: [], est: null, done: false, created: Date.now(), focusMin: 0, ...extra };
  if (t.when === 'tomorrow') t.date = dayKey(addDays(new Date(), 1));
  if (t.when === 'later') t.date = null;
  return t;
}
function completeTask(t, { fromFocus = false, actualMin = null } = {}) {
  if (t.done) return null;
  t.done = true; t.doneAt = Date.now(); t.pin = 0; t.defer = null;
  S.stats.missions++;
  const parts = [];
  let total = award(sizeXP(t)); parts.push(`+${sizeXP(t)} mission`);
  const firstToday = !S.tasks.some(x => x !== t && x.done && x.doneAt && dayKey(new Date(x.doneAt)) === today());
  if (firstToday) { total += award(XP.warmup); parts.push(`+${XP.warmup} first of the day`); }
  let estimateMsg = '';
  if (t.est && actualMin) {
    S.stats.estimates.push({ est: t.est, act: actualMin, at: Date.now() });
    const ratio = actualMin / t.est;
    if (ratio >= 0.7 && ratio <= 1.3) { total += award(XP.estimate); parts.push(`+${XP.estimate} Time Detective`); estimateMsg = `You guessed ${t.est} min — it took ${actualMin}. Super close! 🕵️`; }
    else estimateMsg = `You guessed ${t.est} min — it took ${actualMin}. ${ratio > 1 ? 'Took longer than you thought — that is normal! Next time guess a bit more.' : 'Faster than you thought! 🚀'}`;
  }
  markGoodDay();
  const chest = rollChest();
  save();
  return { total, parts, chest, estimateMsg };
}

/* ------------------------------------------------------------------ Orientation: what's next today */
function upcomingEvents(from = new Date(), horizonH = 30) {
  const ev = [];
  const end = new Date(from.getTime() + horizonH * 3600e3);
  for (let dOff = 0; dOff <= 1; dOff++) {
    const base = addDays(from, dOff); const dk = dayKey(base); const wd = base.getDay();
    S.routines.forEach(r => {
      if (!r.days.includes(wd)) return;
      const at = atTime(r.time, base);
      const doneAll = (r.log[dk] || []).length >= r.items.length;
      if (!doneAll) ev.push({ kind: 'routine', id: r.id, at, title: r.name, emoji: r.emoji });
    });
    S.tasks.forEach(t => {
      if (t.done || !t.time || t.when === 'later') return;
      const td = taskDate(t); const effective = td < today() ? today() : td;
      if (effective !== dk) return;
      ev.push({ kind: 'task', id: t.id, at: atTime(t.time, base), title: t.title, emoji: t.emoji });
    });
    ev.push({ kind: 'bed', at: atTime(S.settings.bedtime, base), title: 'Bedtime', emoji: '😴' });
  }
  return ev.filter(e => e.at > from && e.at < end).sort((a, b) => a.at - b.at);
}
function routineActive(now = new Date()) {
  // A routine is "active" from 10 min before its time until 90 min after, if not finished.
  const dk = today(), wd = now.getDay();
  return S.routines.find(r => {
    if (!r.days.includes(wd)) return false;
    const at = atTime(r.time); const done = (r.log[dk] || []).length;
    return done < r.items.length && now >= new Date(at - 10 * 60e3) && now <= new Date(+at + 90 * 60e3) && !(r.skipped === dk);
  });
}
function inSchoolQuiet(d) {
  const st = S.settings; if (!st.schoolQuiet) return false;
  const wd = d.getDay(); if (wd === 0 || wd === 6) return false;
  return d >= atTime(st.schoolStart, d) && d < atTime(st.schoolEnd, d);
}
function inNightQuiet(d) {
  const bed = atTime(S.settings.bedtime, d); const wake = atTime('06:30', d);
  return d >= new Date(+bed + 30 * 60e3) || d < wake;
}

/* ------------------------------------------------------------------ Reminders
   Native (APK): real Android notifications via @capacitor/local-notifications — fire even when the app is closed.
   Web/PWA: in-app banners + service-worker notifications while the app is alive. */
const Reminders = {
  ready: false,
  plan(now = new Date()) {
    const voice = S.profile.style.voice; const out = [];
    const horizon = new Date(+now + 48 * 3600e3);
    const push = (o) => { if (o.at > now && o.at < horizon && !inNightQuiet(o.at)) out.push(o); };
    // Missions with a time: heads-up (−5), at time, gentle follow-up (+10). Varied wording each time.
    S.tasks.forEach(t => {
      if (t.done || !t.time || t.when === 'later') return;
      const td = taskDate(t); const d = new Date((td < today() ? today() : td) + 'T00:00:00');
      const at = atTime(t.time, d);
      if (inSchoolQuiet(at)) return;
      push({ key: `h-${t.id}-${+at}`, at: new Date(+at - 5 * 60e3), title: 'Heads up', body: voiceLine(voice, 'heads', t.title), kind: 'mission', taskId: t.id, channel: 'missions' });
      push({ key: `s-${t.id}-${+at}`, at, title: `${t.emoji} ${t.title}`, body: voiceLine(voice, 'start', t.title), kind: 'mission', taskId: t.id, channel: 'missions' });
      push({ key: `f-${t.id}-${+at}`, at: new Date(+at + 10 * 60e3), title: `${t.emoji} Still waiting`, body: voiceLine(voice, 'follow', t.title), kind: 'mission', taskId: t.id, channel: 'missions' });
    });
    // Routines on their days.
    for (let dOff = 0; dOff <= 1; dOff++) {
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
      push({ key: `bed-${dk}`, at: new Date(+bed - 30 * 60e3), title: '🌙 30 minutes to bedtime', body: pick(BUDDY_LINES.evening), kind: 'bed', channel: 'routines' });
    }
    out.sort((a, b) => a.at - b.at);
    return out.slice(0, 48);
  },
  idFor(key) { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000 + 1; },

  async init() {
    if (Native.ok) {
      const LN = Native.plugin('LocalNotifications'); if (!LN) return;
      try {
        await LN.createChannel({ id: 'missions', name: 'Mission reminders', importance: 4, vibration: true, description: 'Heads-up and start reminders for missions' });
        await LN.createChannel({ id: 'routines', name: 'Routines', importance: 4, vibration: true, description: 'Morning, after-school and bedtime routines' });
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
        smallIcon: 'ic_stat_mainquest', iconColor: '#5ee0b5',
      })) });
    } catch (e) { console.warn('schedule failed', e); }
  },
  /* Focus sprint notifications (end-of-sprint + "still there?" when he leaves the app). */
  async focusNotify(id, at, title, body) {
    if (Native.ok) {
      const LN = Native.plugin('LocalNotifications'); if (!LN) return;
      try { await LN.schedule({ notifications: [{ id, title, body, channelId: 'focus', schedule: { at, allowWhileIdle: true }, actionTypeId: 'FOCUS', extra: { kind: 'focus' }, smallIcon: 'ic_stat_mainquest', iconColor: '#5ee0b5' }] }); } catch (e) { }
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
    const t = extra.taskId && S.tasks.find(x => x.id === extra.taskId);
    if (action === 'snooze') {
      if (t) { const d = new Date(Date.now() + 10 * 60e3); t.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`; save(); UI.toast('Snoozed 10 minutes ⏰'); }
      else if (extra.routineId) { this.focusNotify(this.idFor('rs' + extra.routineId), new Date(Date.now() + 10 * 60e3), '⏰ Routine time again', 'Ready for the next step?'); }
      return;
    }
    if (action === 'done' && t) { UI.finishQuick(t); return; }
    if (action === 'start' && t) { UI.go('now'); Focus.preflight(t.id); return; }
    if (extra.routineId) { UI.go('routines'); UI.openRoutine(extra.routineId); return; }
    if (extra.kind === 'focus' && S.focus) { Focus.render(); return; }
    if (t) { UI.go('now'); }
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
