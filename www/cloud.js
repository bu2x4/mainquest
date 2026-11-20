'use strict';
/* Parent link via the parent's own Google Drive. The phone talks to a small Apps Script "relay" the parent deploys
   in their Google account; the relay files everything into Drive → MainQuest/<child>/… The phone is linked with a
   one-time 6-character code from the dashboard and gets its own key (it can write its data and read only what's
   meant for it: notes, approvals, targets, study packs). Never shared: parking-lot thoughts, the Study AI key. */

const Cloud = {
  busy: false, timer: null,
  url() { return (S.cloud.url || (APP_CONFIG.cloud || {}).url || '').trim(); },
  configured() { return /^https:\/\/script\.google(usercontent)?\.com\//.test(this.url()); },
  soon(ms = 8000) { if (!S.cloud.linked) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.sync('change'), ms); },

  /* Apps Script web app: plain POST (no custom headers → no CORS preflight), JSON back. */
  async call(op, body = {}) {
    const res = await fetch(this.url(), { method: 'POST', body: JSON.stringify(Object.assign({ op, key: S.cloud.key, v: APP_VERSION }, body)), redirect: 'follow' });
    if (!res.ok) throw new Error('Drive relay answered ' + res.status);
    const j = await res.json();
    if (!j.ok) { const e = new Error(j.error || 'Relay error'); e.code = j.code; throw e; }
    return j;
  },

  async pair(code) {
    if (!this.configured()) throw new Error('Add the relay address first');
    const j = await this.call('pair', { code: code.trim().toUpperCase(), key: undefined });
    Object.assign(S.cloud, { linked: true, key: j.phoneKey, childName: j.child, lastError: '' });
    // first link: send recent history so the dashboard isn't empty
    const have = new Set((S.outbox || []).map(e => e.id));
    (S.log || []).forEach(e => { if (!have.has(e.id)) S.outbox.push(e); });
    S.papers.forEach(p => { p.cloudPages = []; });
    save({ noSchedule: true });
    await this.sync('pair');
    return j.child;
  },

  unlink() { Object.assign(S.cloud, { linked: false, key: '', childName: '', lastSync: 0 }); save({ noSchedule: true }); },

  snapshot() {
    const lvl = levelFor(S.stats.xp), rk = rankFor(lvl);
    return {
      app_version: APP_VERSION, player: { tag: S.player.tag, grade: S.player.grade }, level: lvl, rank: `${rk.name} ${rk.div || ''}`.trim(), xp: S.stats.xp, coins: S.stats.coins,
      missions_total: S.stats.missions, focus_min_total: Math.round(S.stats.focusMin || 0), bosses_down: S.stats.bossesDown || 0,
      settings: { bedtime: S.settings.bedtime, checkins: S.settings.checkins },
      rewards: S.rewards, routines: S.routines.map(r => ({ id: r.id, name: r.name, time: r.time, days: r.days, steps: r.items.length })),
      upcoming: S.tasks.filter(t => !t.done && t.date && daysUntil(t.date) >= 0 && daysUntil(t.date) < 8).map(t => ({ title: t.title, date: t.date, time: t.time || null, kind: t.kind, assignmentId: t.assignmentId || null })),
      backlog: S.tasks.filter(t => !t.done && t.when === 'later').length,
      achievements: Object.keys(S.achievements || {}), gcal_on: !!S.settings.gcal.on, study_ai: S.settings.ai.on ? (S.settings.ai.via || 'api') : 'off',
      parking_count: (S.parking || []).length, linked_at: S.cloud.linkedAt || null,
    };
  },
  paperMeta(p) { return { date: p.date, subject: p.subject, title: p.title || '' }; },
  needsPhotos(p) { return S.cloud.sharePhotos || p.status === 'queued' || p.jobSent; },

  async sync(reason = 'manual') {
    if (!S.cloud.linked || this.busy || !this.configured()) return false;
    if (navigator.onLine === false) return false;
    this.busy = true;
    try {
      // 1) activity + state (events in batches; state rides along on the first batch)
      const since = Date.now() - 35 * 864e5;
      const daily = MQM.daily((S.log || []).filter(e => Date.parse(e.ts) >= since));
      let first = true;
      do {
        const batch = S.outbox.slice(0, 400);
        const body = { events: batch };
        if (first) Object.assign(body, {
          daily,
          assignments: S.assignments.map(a => { const linked = S.tasks.filter(t => t.assignmentId === a.id);
            return { id: a.id, title: a.title, subject: a.subject, type: a.type, due: a.due, status: a.status, created: new Date(a.created).toISOString(), done_at: a.doneAt ? new Date(a.doneAt).toISOString() : null,
              result: a.result || null, teks: a.teks || [], sessions_planned: linked.length, sessions_done: linked.filter(t => t.done).length }; }),
          papers: S.papers.map(p => ({ id: p.id, date: p.date, subject: p.subject, title: p.title || '', pages: p.imageIds.length, status: p.status, assignment_id: p.assignmentId || null,
            teks: ((p.study || {}).teks || []).map(t => t.code), cards: ((p.study || {}).flashcards || []).length, mastered: ((p.study || {}).flashcards || []).filter(c => (c.box || 0) >= 3).length, summary: (p.study || {}).summary || null })),
          snapshot: this.snapshot(),
          requests: S.redemptions.map(r => ({ id: r.id, kind: 'redeem', title: r.name, cost: r.cost, status: r.status, at: new Date(r.at).toISOString(), given_at: r.givenAt ? new Date(r.givenAt).toISOString() : null }))
            .concat(S.wishes.map(w => ({ id: w.id, kind: 'wish', title: w.text, status: w.status, at: new Date(w.at).toISOString() }))),
        });
        await this.call('push', body);
        S.outbox.splice(0, batch.length); save({ noSchedule: true }); first = false;
      } while (S.outbox.length);
      // 2) photos (only when sharing is on, or the paper was sent to the study builder)
      for (const p of S.papers.filter(x => this.needsPhotos(x))) {
        p.cloudPages = p.cloudPages || [];
        for (let i = 0; i < p.imageIds.length; i++) {
          if (p.cloudPages.includes(p.imageIds[i])) continue;
          const d = await IDB.get(p.imageIds[i]); if (!d) continue;
          await this.call('photo', { paperId: p.id, n: i + 1, b64: d, meta: this.paperMeta(p) });
          p.cloudPages.push(p.imageIds[i]); save({ noSchedule: true });
        }
      }
      // 3) study-pack requests for your Claude account
      for (const p of S.papers.filter(x => x.status === 'queued' && !x.jobSent)) {
        await this.call('job', { paperId: p.id, meta: this.paperMeta(p), job: School.jobFor(p) });
        p.jobSent = Date.now(); save({ noSchedule: true });
      }
      // 4) what's waiting for the phone: notes/approvals, targets, finished study packs
      const got = await this.call('pull');
      const acts = got.actions || []; acts.forEach(a => this.apply(a));
      S.goals = got.goals || [];
      const packs = [];
      for (const pk of got.packs || []) { const p = S.papers.find(x => x.id === pk.paperId); if (p) { School.applyStudy(p, pk.study, 'Claude (your account)'); packs.push(pk.paperId); } else packs.push(pk.paperId); }
      save({ noSchedule: true });
      if (acts.length || packs.length) await this.call('ack', { actions: acts.map(a => a.id), packs });
      if (packs.length) UI.toast(packs.length === 1 ? 'A study pack is ready 📚' : `${packs.length} study packs are ready 📚`);
      S.cloud.lastSync = Date.now(); S.cloud.lastError = '';
    } catch (e) {
      S.cloud.lastError = (e && e.message) || String(e);
      if (e && e.code === 'auth') { S.cloud.linked = false; S.cloud.key = ''; S.cloud.lastError = 'This phone was unlinked from the dashboard. Link it again with a new code.'; }
    } finally {
      this.busy = false; save({ noSchedule: true });
      if ($('#sheet-wrap').hidden && !S.focus && S.profile.onboarded && reason !== 'timer') UI.render();
      if (typeof window !== 'undefined' && window.__mqPackHook) window.__mqPackHook();
    }
    return !S.cloud.lastError;
  },

  apply(a) {
    const d = a.data || {};
    if (a.kind === 'note') { S.notes = S.notes || []; S.notes.unshift({ id: a.id, text: String(d.text || '').slice(0, 300), from: d.from || 'Your grown-up', at: Date.parse(a.created_at) || Date.now(), read: false }); S.notes = S.notes.slice(0, 20); }
    if (a.kind === 'redeem_given') { const r = S.redemptions.find(x => x.id === d.id); if (r) { r.status = 'given'; r.givenAt = Date.now(); } }
    if (a.kind === 'wish_add') { const w = S.wishes.find(x => x.id === d.id); if (w) w.status = 'added'; if (d.name && d.cost > 0) S.rewards.push({ id: uid(), emoji: d.emoji || '⭐', name: String(d.name).slice(0, 60), cost: Math.round(d.cost) }); }
    if (a.kind === 'wish_decline') { const w = S.wishes.find(x => x.id === d.id); if (w) w.status = 'no'; }
    if (a.kind === 'set_rewards' && Array.isArray(d.rewards)) S.rewards = d.rewards.slice(0, 20).map(r => ({ id: r.id || uid(), emoji: r.emoji || '⭐', name: String(r.name || 'Reward').slice(0, 60), cost: Math.max(1, Math.round(+r.cost || 50)) }));
  },

  /* ---------- Home: today's targets (Daily Report Card) */
  targetsCard() {
    const goals = (S.goals || []).filter(g => g.active !== false); if (!goals.length) return '';
    const day = MQM.daily((S.log || []).filter(e => MQM.dayOf(e.ts) === today()))[today()] || { date: today(), schoolDay: MQM.isSchoolDay(today()) };
    const rows = goals.map(g => { const m = MQM.GOAL_METRICS[g.metric] || {}; const met = MQM.goalMet(g, day); const v = day[g.metric];
      return `<div class="tg-row ${met ? 'met' : ''}"><span class="tg-dot">${met === null ? '–' : met ? '✓' : ''}</span><span class="grow">${esc(g.label)}</span><span class="faint">${met === null ? 'n/a today' : m.binary ? (met ? 'done' : 'not yet') : `${v ?? 0}${m.unit ? ' ' + m.unit : ''} / ${g.target}`}</span></div>`; }).join('');
    const sc = MQM.drcDay(goals, day);
    return `<div class="card targets"><div class="row" style="justify-content:space-between"><b>Today’s targets</b>${sc ? `<span class="pill ${sc.met ? 'gold' : ''}">${sc.pct}%</span>` : ''}</div>${rows}
      <div class="faint" style="margin-top:6px">You and your grown-up picked these. 2 out of 3 = a win.</div></div>`;
  },

  /* ---------- Grown-up zone section */
  adminHTML() {
    const c = S.cloud;
    const status = !this.configured() ? 'Not set up' : !c.linked ? 'Not linked' : c.lastError ? 'Problem: ' + c.lastError : c.lastSync ? 'Linked · synced ' + new Date(c.lastSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Linked';
    return `<div class="card ai-card">
      <div class="row"><div class="grow"><b>Status</b><div class="faint">${esc(status)}</div></div><span class="pill ${c.linked && !c.lastError ? 'gold' : ''}">${c.linked ? 'LINKED' : 'OFF'}</span></div>
      ${!c.linked ? `
        ${!(APP_CONFIG.cloud || {}).url ? `<label class="lbl">Drive relay address (your Apps Script web app URL)</label><input class="field" id="cl-url" value="${esc(c.url)}" placeholder="https://script.google.com/macros/s/…/exec" spellcheck="false">` : ''}
        <label class="lbl">Link code from the parent dashboard</label>
        <div class="row"><input class="field grow" id="cl-code" placeholder="e.g. K7Q2MX" maxlength="8" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.2em"><button class="btn small primary" data-x="clpair">Link</button></div>
        <p class="faint">Dashboard → Settings → Link a phone. A code works once and expires in 30 minutes.</p>` : `
        <div class="list-btn" data-x="clphotos">Share paper photos to Drive<span class="switch ${c.sharePhotos ? 'on' : ''}" style="margin-left:auto"></span></div>
        <div class="btn-row"><button class="btn small primary" data-x="clsync">Sync now</button><button class="btn small ghost" data-x="clunlink">Unlink this phone</button></div>`}
      <details class="fold"><summary>What gets shared</summary><p class="sub" style="margin:0">Saved in your Google Drive (MainQuest folder): missions, focus time, check-ins, which strategies he used, routines, assignments and due dates, study sessions, quiz and flashcard results, papers (photos only if allowed, or when sent to the study builder) and reward requests. <b>Never shared:</b> his parking-lot thoughts and the Study AI key. He can see this list on his Profile.</p></details>
    </div>`;
  },
  async adminClick(x, b, root) {
    if (x === 'clpair') {
      const u = $('#cl-url', root); if (u) S.cloud.url = u.value.trim();
      const code = ($('#cl-code', root).value || '').trim();
      if (!this.configured()) { UI.toast('That relay address doesn’t look right (it starts with https://script.google.com/)'); return true; }
      if (code.length < 6) { UI.toast('Enter the 6-character code'); return false; }
      UI.toast('Linking…');
      try { const name = await this.pair(code); UI.toast(`Linked to ${name}’s dashboard ✓`); } catch (e) { UI.toast(e.message || 'Couldn’t link'); }
      return true;
    }
    if (x === 'clsync') { UI.toast('Syncing…'); const ok = await this.sync('manual'); UI.toast(ok ? 'Synced ✓' : 'Sync problem: ' + S.cloud.lastError); return true; }
    if (x === 'clphotos') { S.cloud.sharePhotos = !S.cloud.sharePhotos; save({ noSchedule: true }); return true; }
    if (x === 'clunlink') { if (await ask('Unlink this phone from the parent dashboard? Data already in Drive stays there.', { ok: 'Unlink' })) this.unlink(); return true; }
    return false;
  },
};
