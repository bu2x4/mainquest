'use strict';
/* Google Calendar sync through the phone's calendar (Android keeps it in two-way sync with Google).
   - Pull: events from the calendars a grown-up picks show in Calendar, Planner, Home, reminders.
   - Push: MainQuest events (+ optionally due dates/tests and study sessions) go to one chosen calendar.
   - Invites: guests added to a MainQuest event get a Google invite; invites he receives can be accepted here. */

const GSync = {
  busy: false,
  timer: null,
  plugin() { return Native.ok ? Native.plugin('CalendarSync') : null; },
  available() { return !!this.plugin(); },
  cfg() { return S.settings.gcal; },
  cal(id) { return (this.cfg().cals || []).find(c => c.id === String(id)); },
  selfEmail(calId) { const c = this.cal(calId); return c ? (c.owner || c.account || '') : ''; },
  canInvite() { const g = this.cfg(); return g.on && g.writeId && g.invites !== 'off'; },

  async permission() {
    const P = this.plugin(); if (!P) return 'unavailable';
    try { return (await P.checkPermissions()).calendar; } catch (e) { return 'unknown'; }
  },
  async connect() {
    const P = this.plugin(); if (!P) return false;
    let st = 'denied';
    try { st = (await P.requestPermissions({ permissions: ['calendar'] })).calendar; } catch (e) { }
    if (st !== 'granted') { UI.toast('Calendar permission is needed to sync'); return false; }
    await this.refreshCalendars();
    return true;
  },
  async refreshCalendars() {
    const P = this.plugin(); if (!P) return [];
    try { const r = await P.listCalendars(); this.cfg().cals = (r.calendars || []).map(c => ({ ...c, id: String(c.id) })); } catch (e) { this.cfg().lastError = e.message || String(e); }
    return this.cfg().cals || [];
  },

  soon() { clearTimeout(this.timer); this.timer = setTimeout(() => this.sync('change'), 1500); },

  /* ---------- time helpers */
  localDayStart(dk) { return new Date(dk + 'T00:00:00'); },
  utcMidnight(dk) { const [y, m, d] = dk.split('-').map(Number); return Date.UTC(y, m - 1, d); },
  payloadForEvent(e) {
    const p = { title: e.title, location: e.where || '', description: 'Added from MainQuest' };
    if (e.time) {
      const start = new Date(e.date + 'T' + e.time + ':00').getTime();
      let end = e.endTime ? new Date(e.date + 'T' + e.endTime + ':00').getTime() : start + (e.duration || 60) * 60000;
      if (end <= start) end = start + 60 * 60000;
      Object.assign(p, { start, end, allDay: false });
    } else Object.assign(p, { start: this.utcMidnight(e.date), end: this.utcMidnight(e.date) + 864e5, allDay: true });
    return p;
  },
  payloadForAssignment(a) {
    const t = atype(a.type);
    return { title: `${a.type === 'test' || a.type === 'quiz' ? t.name : 'Due'}: ${a.title}`, description: `${subj(a.subject).name} · added from MainQuest${a.notes ? '\n' + a.notes : ''}`,
      location: '', start: this.utcMidnight(a.due), end: this.utcMidnight(a.due) + 864e5, allDay: true };
  },
  payloadForTask(t) {
    const start = new Date(t.date + 'T' + t.time + ':00').getTime();
    return { title: t.title, description: 'Study session · MainQuest', location: '', start, end: start + (t.est || 20) * 60000, allDay: false };
  },
  normalize(ev) {
    const c = this.cal(ev.calendarId) || {};
    const begin = Number(ev.begin), end = Number(ev.end);
    let date, endDate, time = '';
    if (ev.allDay) { date = new Date(begin).toISOString().slice(0, 10); endDate = new Date(Math.max(end, begin + 864e5)).toISOString().slice(0, 10); }
    else { const b = new Date(begin); date = dayKey(b); time = fmt24(b); endDate = dayKey(addDays(new Date(Math.max(begin, end - 1)), 1)); }
    const self = (c.owner || '').toLowerCase();
    const isOrganizer = !!ev.organizer && ev.organizer.toLowerCase() === self;
    return { key: ev.eventId + '_' + begin, id: String(ev.eventId), calId: String(ev.calendarId), title: ev.title || '(no title)', location: ev.location || '', description: ev.description || '',
      start: begin, end, allDay: !!ev.allDay, date, endDate, time, endTime: ev.allDay ? '' : fmt24(new Date(end)), organizer: ev.organizer || '', isOrganizer,
      selfStatus: ev.selfStatus || 'none', attendees: (ev.attendees || []).filter(a => a.email), recurring: !!ev.recurring, color: c.color || '#9aa3c7', calName: c.name || '' };
  },

  /* ---------- the sync pass */
  async sync(reason = 'manual') {
    const g = this.cfg(); const P = this.plugin();
    if (!g.on || !P || this.busy) return false;
    if ((await this.permission()) !== 'granted') { g.lastError = 'Calendar permission is off — reconnect in the Grown-up zone.'; save({ noSchedule: true }); return false; }
    this.busy = true;
    const fresh = [];
    try {
      await this.refreshCalendars();
      const self = this.selfEmail(g.writeId);
      // 1) deletions queued from MainQuest
      for (const id of S.gdeletes.splice(0)) { try { await P.deleteEvent({ id }); } catch (e) { } }
      // 2) push MainQuest items
      if (g.writeId) {
        const push = async (obj, payload, guests) => {
          const data = { ...payload }; if (guests) { data.attendees = guests; data.selfEmail = self; }
          if (!obj.gcalId) { const r = await P.createEvent({ calendarId: g.writeId, ...data }); obj.gcalId = String(r.id); obj.gdirty = false; obj.gsynced = true; }
          else if (obj.gdirty) { try { await P.updateEvent({ id: obj.gcalId, ...data }); } catch (e) { if (/NOT_FOUND|not found/i.test(e.message || e.code || '')) { const r = await P.createEvent({ calendarId: g.writeId, ...data }); obj.gcalId = String(r.id); } else throw e; } obj.gdirty = false; obj.gsynced = true; }
        };
        if (g.pushEvents) for (const e of S.events) await push(e, this.payloadForEvent(e), e.attendees || []);
        if (g.pushDue) for (const a of S.assignments) { if (a.status === 'done' && !a.gcalId) continue; await push(a, this.payloadForAssignment(a)); }
        if (g.pushStudy) for (const t of S.tasks) { if (t.kind !== 'study' || !t.date || !t.time || (t.done && !t.gcalId)) continue; await push(t, this.payloadForTask(t)); }
      }
      // 3) pull
      const ids = [...new Set([...(g.readIds || []), g.writeId].filter(Boolean))];
      const r = ids.length ? await P.listEvents({ calendarIds: ids, start: +addDays(new Date(), -7), end: +addDays(new Date(), 62) }) : { events: [] };
      const byId = {}; (r.events || []).forEach(ev => { if (!byId[ev.eventId]) byId[ev.eventId] = ev; });
      // Google edits to MainQuest-made events flow back (Google wins unless he changed it locally since)
      S.events = S.events.filter(e => {
        if (!e.gcalId || e.gdirty) return true;
        const ev = byId[e.gcalId];
        if (!ev) return !e.gsynced; // deleted in Google → remove here
        const n = this.normalize(ev);
        Object.assign(e, { title: n.title, date: n.date, time: n.time, endTime: n.time ? n.endTime : '', where: n.location || e.where || '' });
        e.guestStatus = n.attendees.filter(a => !a.organizer).map(a => ({ email: a.email, status: a.status }));
        return true;
      });
      const mine = new Set([...S.events, ...S.assignments, ...S.tasks].map(x => x.gcalId).filter(Boolean));
      const before = new Set(Object.keys(S.gseen || {}));
      S.gevents = (r.events || []).filter(ev => !mine.has(String(ev.eventId))).map(ev => this.normalize(ev));
      S.gseen = S.gseen || {};
      S.gevents.filter(ev => ev.selfStatus === 'invited' && !ev.isOrganizer && ev.end > Date.now()).forEach(ev => { if (!before.has(ev.key)) { S.gseen[ev.key] = Date.now(); fresh.push(ev); } });
      // 4) nudge Android to talk to Google now
      try { await P.requestSync({ calendarIds: ids }); } catch (e) { }
      g.lastSync = Date.now(); g.lastError = '';
    } catch (e) {
      g.lastError = (e && (e.message || e.code)) || String(e);
    } finally {
      this.busy = false;
      save();
      if (fresh.length) this.announce(fresh, reason);
      if ($('#sheet-wrap').hidden && !S.focus && S.profile.onboarded) UI.render();
    }
    return !g.lastError;
  },

  announce(list, reason) {
    const first = list[0];
    const title = list.length > 1 ? `${list.length} new invites` : `New invite: ${first.title}`;
    const body = list.length > 1 ? list.map(e => e.title).slice(0, 3).join(' · ') : `${dueLabel(first.date)}${first.time ? ' · ' + fmtHM(first.time) : ''}${first.organizer ? ' · from ' + first.organizer : ''}`;
    if (document.hidden || reason === 'timer') Reminders.focusNotify(900200 + Math.floor(Math.random() * 999), new Date(Date.now() + 1500), title, body);
    else UI.toast(`📨 ${title}`);
  },

  async rsvp(ev, status) {
    const P = this.plugin(); if (!P) return;
    try {
      await P.setRsvp({ eventId: ev.id, email: this.selfEmail(ev.calId), status });
      const me = this.selfEmail(ev.calId).toLowerCase();
      S.gevents.filter(x => x.id === ev.id).forEach(x => { x.selfStatus = status; x.attendees.forEach(a => { if ((a.email || '').toLowerCase() === me) a.status = status; }); });
      save({ noSchedule: true });
      try { await P.requestSync({ calendarIds: [ev.calId] }); } catch (e) { }
      UI.toast(status === 'accepted' ? 'Accepted — the organizer gets your reply' : status === 'declined' ? 'Declined' : 'Marked maybe');
      Sfx.play(status === 'accepted' ? 'coin' : 'tap');
    } catch (e) { UI.toast(e.message || 'Couldn’t send your reply'); }
  },

  invites() { return (S.gevents || []).filter(ev => ev.selfStatus === 'invited' && !ev.isOrganizer && ev.end > Date.now()).sort((a, b) => a.start - b.start); },
  onDay(dk) { return (S.gevents || []).filter(ev => ev.date <= dk && dk < ev.endDate && ev.selfStatus !== 'declined'); },

  invitesCard() {
    const list = this.invites(); if (!list.length) return '';
    return `<div class="card invites"><div class="row" style="justify-content:space-between"><b>📨 Invites · ${list.length}</b><span class="faint">from Google Calendar</span></div>
      ${list.slice(0, 3).map(ev => `<div class="inv-row"><button class="grow inv-t" data-a="gevent" data-k="${esc(ev.key)}"><b>${esc(ev.title)}</b><span class="faint">${dueLabel(ev.date)}${ev.time ? ' · ' + fmtHM(ev.time) : ''}${ev.organizer ? ' · ' + esc(ev.organizer) : ''}</span></button>
        <div class="inv-btns"><button class="btn small primary" data-a="rsvp" data-k="${esc(ev.key)}" data-s="accepted">Yes</button><button class="btn small" data-a="rsvp" data-k="${esc(ev.key)}" data-s="tentative">Maybe</button><button class="btn small ghost" data-a="rsvp" data-k="${esc(ev.key)}" data-s="declined">No</button></div></div>`).join('')}
      ${list.length > 3 ? `<button class="btn small ghost block" data-a="tab" data-t="calendar">See all in Calendar</button>` : ''}</div>`;
  },

  detail(ev) {
    const st = { accepted: 'Going', declined: 'Not going', tentative: 'Maybe', invited: 'Not answered', none: '' };
    const guests = ev.attendees.filter(a => a.email);
    UI.sheet(`<div class="grab"></div>
      <div class="row"><i class="swatch" style="background:${ev.color};width:14px;height:14px"></i><span class="faint">${esc(ev.calName)} · Google Calendar</span></div>
      <h3 style="margin-top:8px">${esc(ev.title)}</h3>
      <div class="sub">${new Date(ev.start).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(ev.allDay ? { timeZone: 'UTC' } : {}) })}${ev.time ? ` · ${fmtHM(ev.time)}–${fmtHM(ev.endTime)}` : ' · all day'}${ev.recurring ? ' · repeats' : ''}</div>
      ${ev.location ? `<div class="sub" style="margin-top:4px">📍 ${esc(ev.location)}</div>` : ''}
      ${ev.organizer && !ev.isOrganizer ? `<div class="faint" style="margin-top:6px">Organizer: ${esc(ev.organizer)}</div>` : ''}
      ${ev.description ? `<p class="sub" style="white-space:pre-wrap">${esc(ev.description.slice(0, 500))}</p>` : ''}
      ${guests.length ? `<label class="lbl">Guests · ${guests.length}</label>${guests.slice(0, 12).map(a => `<div class="guest"><span class="grow">${esc(a.name || a.email)}</span><span class="pill ${a.status === 'accepted' ? 'gold' : ''}">${a.organizer ? 'Organizer' : st[a.status] || ''}</span></div>`).join('')}` : ''}
      ${!ev.isOrganizer && ev.selfStatus !== 'none' ? `<label class="lbl">Your answer${ev.selfStatus !== 'invited' ? `: <b>${st[ev.selfStatus]}</b>` : ''}</label>
        <div class="btn-row"><button class="btn ${ev.selfStatus === 'accepted' ? 'primary' : ''}" data-x="r" data-s="accepted">Yes</button><button class="btn ${ev.selfStatus === 'tentative' ? 'primary' : ''}" data-x="r" data-s="tentative">Maybe</button><button class="btn ${ev.selfStatus === 'declined' ? 'primary' : ''}" data-x="r" data-s="declined">No</button></div>` : ''}
      <div class="spacer"></div>
      <div class="btn-row"><button class="btn" data-x="mission">＋ Make it a mission</button><button class="btn primary" data-x="close">Close</button></div>`, root => {
      root.onclick = async e => {
        const b = e.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 'r') { await this.rsvp(ev, b.dataset.s); return this.detail(S.gevents.find(x => x.key === ev.key) || ev); }
        if (b.dataset.x === 'mission') { S.tasks.push(newTask(`Get ready: ${ev.title}`, { date: ev.date, time: ev.time ? fmt24(new Date(ev.start - 30 * 60e3)) : '' })); save(); UI.closeSheet(); UI.render(); UI.toast('Added a get-ready mission'); }
        if (b.dataset.x === 'close') { UI.closeSheet(); UI.render(); }
      };
    });
  },

  /* ---------- Grown-up zone section */
  adminHTML() {
    const g = this.cfg();
    if (!this.available()) return `<div class="card soft sub">Google Calendar sync works in the installed Android app (it uses the phone’s calendar, which Android keeps synced with Google). Open the Grown-up zone on his phone to set it up.</div>`;
    const cals = g.cals || [];
    const byAcct = {}; cals.forEach(c => { (byAcct[c.account] = byAcct[c.account] || []).push(c); });
    const status = !g.connected ? 'Not connected' : !g.on ? 'Connected · sync paused' : g.lastError ? 'Problem: ' + g.lastError : g.lastSync ? 'Synced ' + new Date(g.lastSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Connected · not synced yet';
    return `<div class="card ai-card">
      <div class="row"><div class="grow"><b>Status</b><div class="faint">${esc(status)}</div></div><span class="pill ${g.on && g.connected && !g.lastError ? 'gold' : ''}">${g.on && g.connected ? 'ON' : 'OFF'}</span></div>
      ${!g.connected ? `<p class="sub" style="margin:10px 0">Uses the Google account already on this phone (Settings → Accounts). Make sure “Calendar” sync is on for that account.</p><button class="btn primary block" data-x="gconnect">Connect phone calendars</button>` : `
      <div class="list-btn" data-x="gon" style="margin-top:10px">Sync ${g.on ? 'on' : 'off'}<span class="switch ${g.on ? 'on' : ''}" style="margin-left:auto"></span></div>
      ${!g.readIds.length && !g.writeId ? `<p class="sub" style="margin:10px 0 0">Nothing is synced until you pick calendars below.</p>` : ''}
      <label class="lbl">Show these calendars in MainQuest</label>
      ${Object.keys(byAcct).length ? Object.entries(byAcct).map(([acct, list]) => `<div class="faint" style="margin:8px 2px 4px">${esc(acct)}</div>${list.map(c => `<button class="list-btn ${g.readIds.includes(c.id) ? 'on' : ''}" data-x="gread" data-k="${c.id}"><span class="check ${g.readIds.includes(c.id) ? 'on' : ''}" style="width:28px;height:28px;font-size:14px">${g.readIds.includes(c.id) ? '✓' : ''}</span><i class="swatch" style="background:${c.color}"></i><span class="grow">${esc(c.name)}</span>${c.primary ? '<span class="pill">primary</span>' : ''}</button>`).join('')}`).join('') : `<p class="faint">No calendars found on this phone. Add a Google account in Android Settings → Accounts, then tap Refresh.</p>`}
      <label class="lbl">Save MainQuest items to</label>
      <div class="chips">${cals.filter(c => c.writable).map(c => `<button class="chip ${g.writeId === c.id ? 'on' : ''}" data-x="gwrite" data-k="${c.id}"><i class="swatch" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('') || '<span class="faint">No writable calendars</span>'}</div>
      <label class="lbl">Send to Google</label>
      ${[['pushEvents', 'His events (practice, plans…)'], ['pushDue', 'Due dates + tests (all-day)'], ['pushStudy', 'Study sessions']].map(([k, l]) => `<div class="list-btn" data-x="gtog" data-k="${k}">${l}<span class="switch ${g[k] ? 'on' : ''}" style="margin-left:auto"></span></div>`).join('')}
      <div class="list-btn" data-x="gtog" data-k="remind">MainQuest reminders for Google events<span class="switch ${g.remind ? 'on' : ''}" style="margin-left:auto"></span></div>
      <label class="lbl">Sending invites</label>
      <div class="chips">${[['off', 'Off'], ['approved', 'Approved contacts only'], ['anyone', 'Anyone']].map(([k, l]) => `<button class="chip ${g.invites === k ? 'on' : ''}" data-x="ginv" data-k="${k}">${l}</button>`).join('')}</div>
      ${g.invites === 'approved' ? `<div style="margin-top:10px">${(g.contacts || []).map((c, i) => `<div class="guest"><span class="grow"><b>${esc(c.name)}</b> <span class="faint">${esc(c.email)}</span></span><button class="iconbtn sm" data-x="gcdel" data-i="${i}" aria-label="Remove">✕</button></div>`).join('') || '<p class="faint">No approved contacts yet.</p>'}
        <div class="grid2" style="margin-top:8px"><input class="field" id="gc-name" placeholder="Name"><input class="field" id="gc-email" type="email" placeholder="email@example.com"></div>
        <button class="btn small block" data-x="gcadd" style="margin-top:8px">＋ Add contact</button></div>` : ''}
      <p class="faint" style="margin-top:8px">Guests get a normal Google Calendar invite when the phone syncs. You can see every invite he sends below.</p>
      ${this.sentList()}
      <div class="btn-row"><button class="btn small primary" data-x="gsync">Sync now</button><button class="btn small" data-x="grefresh">Refresh calendars</button></div>
      <details class="fold"><summary>Test without Google</summary><p class="faint" style="margin:0 0 8px">Creates a phone-only test calendar with one sample invite so you can try the flow. It never syncs to Google.</p><button class="btn small" data-x="gtest">Create test calendar</button></details>
      <button class="btn small ghost block" data-x="gdisconnect" style="margin-top:8px">Disconnect (stop syncing)</button>`}
    </div>`;
  },
  sentList() {
    const sent = S.events.filter(e => (e.attendees || []).length && e.date >= dayKey(addDays(new Date(), -14)));
    if (!sent.length) return '';
    return `<details class="fold"><summary>Invites he sent · ${sent.length}</summary>${sent.map(e => `<div class="guest"><span class="grow"><b>${esc(e.title)}</b> <span class="faint">${dueLabel(e.date)} → ${e.attendees.map(esc).join(', ')}</span></span></div>`).join('')}</details>`;
  },
  async adminClick(x, b, root) {
    const g = this.cfg();
    if (x === 'gconnect') { if (await this.connect()) { g.connected = true; g.on = true; g.readIds = []; g.writeId = ''; save({ noSchedule: true }); UI.toast('Connected. Now pick which calendars to show and where to save.'); } return true; }
    if (x === 'gon') { g.on = !g.on; save({ noSchedule: true }); if (g.on) await this.sync('manual'); return true; }
    if (x === 'gread') { const k = b.dataset.k; g.readIds = g.readIds.includes(k) ? g.readIds.filter(i => i !== k) : [...g.readIds, k]; save({ noSchedule: true }); this.soon(); return true; }
    if (x === 'gwrite') { g.writeId = b.dataset.k; if (!g.readIds.includes(g.writeId)) g.readIds.push(g.writeId); save({ noSchedule: true }); this.soon(); return true; }
    if (x === 'gtog') { g[b.dataset.k] = !g[b.dataset.k]; save(); this.soon(); return true; }
    if (x === 'ginv') { g.invites = b.dataset.k; save({ noSchedule: true }); return true; }
    if (x === 'gcadd') { const n = $('#gc-name', root).value.trim(), em = $('#gc-email', root).value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { UI.toast('Enter a valid email'); return false; } g.contacts.push({ name: n || em.split('@')[0], email: em }); save({ noSchedule: true }); return true; }
    if (x === 'gcdel') { g.contacts.splice(+b.dataset.i, 1); save({ noSchedule: true }); return true; }
    if (x === 'gsync') { UI.toast('Syncing…'); const ok = await this.sync('manual'); UI.toast(ok ? 'Synced ✓' : 'Sync problem: ' + (g.lastError || 'unknown')); return true; }
    if (x === 'grefresh') { await this.refreshCalendars(); save({ noSchedule: true }); return true; }
    if (x === 'gtest') { try { const r = await this.plugin().createTestCalendar(); await this.refreshCalendars(); if (!g.readIds.includes(String(r.calendarId))) g.readIds.push(String(r.calendarId)); if (!g.writeId) g.writeId = String(r.calendarId); save({ noSchedule: true }); await this.sync('manual'); UI.toast('Test calendar created with a sample invite'); } catch (e) { UI.toast(e.message || 'Couldn’t create test calendar'); } return true; }
    if (x === 'gdisconnect') { if (await ask('Stop syncing with Google Calendar? Events already synced stay in Google.', { ok: 'Disconnect' })) { Object.assign(g, { on: false, connected: false }); S.gevents = []; save(); } return true; }
    return false;
  },
};
