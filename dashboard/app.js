'use strict';
/* MainQuest parent dashboard. Reads the data the phone files into your Google Drive (through your relay script)
   and sends notes / approvals / targets back. Works two ways:
   1) served by the relay itself: <relay>/exec?view=dashboard  (uses google.script.run — sign in with the parent key)
   2) hosted anywhere (e.g. GitHub Pages): sign in with the relay URL + parent key. */
const { esc } = Charts;
const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayK = () => dk(new Date());
const addD = (k, n) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return dk(d); };
const fmtD = (k, o = { month: 'short', day: 'numeric' }) => new Date(k + 'T12:00').toLocaleDateString(undefined, o);
const hm = t => { if (!t) return ''; const [h, mi] = t.split(':').map(Number); return new Date(2000, 0, 1, h, mi).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
const wd = k => new Date(k + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
const pct = (a, b) => b ? Math.round(a / b * 100) : null;
const store = { get() { try { return JSON.parse(localStorage.getItem('mq-dash') || 'null'); } catch (e) { return null; } }, set(v) { try { v ? localStorage.setItem('mq-dash', JSON.stringify(v)) : localStorage.removeItem('mq-dash'); } catch (e) { } } };
const inRelay = () => !!(window.google && google.script && google.script.run);

const API = {
  url: '', key: '',
  call(op, body = {}) {
    const req = Object.assign({ op, key: this.key }, body);
    if (inRelay()) return new Promise((res, rej) => google.script.run.withSuccessHandler(r => r && r.ok ? res(r) : rej(Object.assign(new Error((r && r.error) || 'Relay error'), { code: r && r.code }))).withFailureHandler(rej).api(req));
    return fetch(this.url, { method: 'POST', body: JSON.stringify(req) }).then(r => r.json()).then(j => { if (!j.ok) throw Object.assign(new Error(j.error || 'Relay error'), { code: j.code }); return j; });
  },
};

const A = { D: null, tab: 'overview', period: 28, imgs: {}, busy: false };
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

/* ------------------------------------------------------------------ data model */
function model() {
  const D = A.D;
  const computed = MQM.daily(D.events);
  const days = Object.assign({}, D.daily || {}, computed);               // phone summaries fill in older history
  const goals = (D.goals || []).filter(g => g.active !== false);
  const range = (n, endOffset = 0) => { const out = []; for (let i = n - 1 + endOffset; i >= endOffset; i--) out.push(addD(todayK(), -i)); return out; };
  const has = k => !!(days[k] && (days[k].events || 0) > 0);
  const evIn = keys => { const s = new Set(keys); return D.events.filter(e => s.has(MQM.dayOf(e.ts))); };
  function stats(keys) {
    const data = keys.filter(has); const sd = data.filter(k => MQM.isSchoolDay(k));
    const ev = evIn(keys);
    const drc = data.map(k => MQM.drcDay(goals, days[k])).filter(Boolean);
    const done = ev.filter(e => e.type === 'assignment_done');
    const lat = ev.filter(e => e.type === 'focus_start' && typeof (e.data || {}).latency === 'number').map(e => e.data.latency);
    const est = ev.filter(e => e.type === 'estimate').map(e => e.data.act / e.data.est).filter(v => isFinite(v) && v > 0);
    const chk = ev.filter(e => e.type === 'checkin');
    return {
      keys, dataDays: data.length, schoolDays: sd.length,
      drc_pct: drc.length ? pct(drc.filter(d => d.met).length, drc.length) : null, drc_met: drc.filter(d => d.met).length, drc_n: drc.length,
      on_time: done.length ? pct(done.filter(e => (e.data.early_days ?? 0) >= 0).length, done.length) : null, done: done.length,
      latency: MQM.median(lat), est_ratio: est.length ? Math.round(MQM.median(est) * 100) / 100 : null,
      focus_sd: sd.length ? Math.round(MQM.sum(sd.map(k => days[k].focus_min || 0)) / sd.length) : null,
      focus_total: Math.round(MQM.sum(data.map(k => days[k].focus_min || 0))),
      on_task: chk.length ? pct(chk.filter(e => e.data.result === 'yes').length, chk.length) : null, checkins: chk.length,
      logged: sd.length ? pct(sd.filter(k => (days[k].assignments_added || 0) + (days[k].papers_scanned || 0) > 0).length, sd.length) : null,
      missions: MQM.sum(data.map(k => days[k].missions_done || 0)),
      tactics: MQM.tacticUse(ev), ind: MQM.independence(ev), ev,
    };
  }
  const cur = stats(range(A.period)), prev = stats(range(A.period, A.period));
  return { days, goals, has, range, stats, cur, prev, evIn };
}
const markers = (keys) => (A.D.timeline || []).filter(t => keys.includes(t.date) && (t.kind !== 'medication' || A.showMed)).map(t => ({ i: keys.indexOf(t.date), label: t.label.slice(0, 22) }));

function delta(c, p, unit = '', better = 'up') {
  if (c === null || c === undefined || p === null || p === undefined) return `<span>vs previous ${A.period / 7} wks: <b>—</b></span>`;
  const d = Math.round((c - p) * 10) / 10; if (!d) return `<span>same as previous ${A.period / 7} wks</span>`;
  const good = better === 'up' ? d > 0 : d < 0;
  return `<span>${d > 0 ? '▲' : '▼'} <b>${Math.abs(d)}${unit}</b> vs previous ${A.period / 7} wks${good ? ' · better' : ''}</span>`;
}
function tile(k, v, unit, d, note) { return `<div class="tile"><div class="k">${esc(k)}</div><div class="v">${v === null || v === undefined ? '—' : esc(v) + `<small style="font-size:15px;font-weight:500;color:var(--ink2)">${unit}</small>`}</div><div class="d">${d}${note ? `<br>${esc(note)}` : ''}</div></div>`; }

/* ------------------------------------------------------------------ auto flags (neutral wording) */
function flags(m) {
  const c = m.cur, out = [];
  if (c.checkins >= 10 && c.on_task >= 95) out.push(['!', 'Check-ins are almost always “on task” (' + c.on_task + '%). A few quiet spot checks would show whether his self-ratings are accurate before relying on them.']);
  if (c.ind.starts >= 8 && c.ind.self_pct !== null && c.ind.self_pct < 30) out.push(['!', `Most focus sessions (${100 - c.ind.self_pct}%) started from a reminder. Keep the reminders, and try one start each day that he begins without a prompt.`]);
  if (c.ind.swaps >= 3 && c.ind.swaps_returned / c.ind.swaps < 0.5) out.push(['!', `He switched to an easier task ${c.ind.swaps}×; the hard task was picked back up ${c.ind.swaps_returned}×. Planned warm-ups are fine. Repeated switches that never return can mean he is avoiding the hard task.`]);
  const rs = c.ev.filter(e => e.type === 'reminder_action'); const sn = rs.filter(e => e.data.action === 'snooze').length;
  if (rs.length >= 8 && sn / rs.length > 0.5) out.push(['!', `Reminders were snoozed ${pct(sn, rs.length)}% of the time. The cue may have gone stale. Try a new time or wording.`]);
  if (c.est_ratio && c.est_ratio >= 1.6) out.push(['!', `Tasks took about ${c.est_ratio}× his estimates. Planning with longer blocks or smaller steps may fit him better.`]);
  const sprints = c.ev.filter(e => e.type === 'focus_end'); const abandon = sprints.filter(e => !e.data.completed).length;
  if (sprints.length >= 8 && abandon / sprints.length > 0.5) out.push(['!', `${pct(abandon, sprints.length)}% of focus sprints ended early. Shorter sprints (5–10 min) may be the right size for now.`]);
  if (c.drc_pct !== null && m.prev.drc_pct !== null && c.drc_pct - m.prev.drc_pct <= -20) out.push(['!', `Daily targets were met on fewer days than in the previous period (${c.drc_pct}% vs ${m.prev.drc_pct}%). Check whether something changed.`]);
  const noData = c.keys.filter(k => MQM.isSchoolDay(k) && !m.has(k)).length;
  if (noData >= 3) out.push(['·', `${noData} school days have no app data. That means the app wasn’t used those days, not that work was skipped.`]);
  const wins = [];
  if (c.drc_pct !== null && c.drc_pct >= 67) wins.push(`Targets met on ${c.drc_met} of ${c.drc_n} days.`);
  if (c.latency !== null && m.prev.latency !== null && c.latency < m.prev.latency) wins.push(`Starting faster: median ${c.latency} min after the planned time (was ${m.prev.latency}).`);
  if (c.on_time !== null && c.on_time >= 80) wins.push(`${c.on_time}% of finished assignments were on time.`);
  return { flags: out.slice(0, 4), wins };
}

/* ------------------------------------------------------------------ views */
const V = {};
V.overview = m => {
  const c = m.cur, p = m.prev; const keys = m.range(A.period);
  const drcSeries = keys.map(k => { const s = m.has(k) ? MQM.drcDay(m.goals, m.days[k]) : null; return { label: fmtD(k), full: `${wd(k)} ${fmtD(k)}${m.has(k) ? '' : ' · no app data'}`, value: s ? s.pct : null }; });
  const focus = keys.map(k => ({ label: fmtD(k), full: `${wd(k)} ${fmtD(k)}`, value: m.has(k) ? (m.days[k].focus_min || 0) : null, cls: MQM.isSchoolDay(k) ? '' : 'dim' }));
  const f = flags(m);
  return `
  <div class="tiles">
    ${tile('Days targets met', c.drc_pct, '%', delta(c.drc_pct, p.drc_pct, ' pts'), c.drc_n ? `${c.drc_met} of ${c.drc_n} days with data` : (m.goals.length ? 'no data yet' : 'set targets first'))}
    ${tile('Assignments on time', c.on_time, '%', delta(c.on_time, p.on_time, ' pts'), `${c.done} finished`)}
    ${tile('Start delay (median)', c.latency, ' min', delta(c.latency, p.latency, ' min', 'down'), 'after the planned time')}
    ${tile('Focus per school day', c.focus_sd, ' min', delta(c.focus_sd, p.focus_sd, ' min'), `${c.focus_total} min total`)}
    ${tile('On task at check-ins', c.on_task, '%', delta(c.on_task, p.on_task, ' pts'), `${c.checkins} check-ins`)}
  </div>
  <div class="grid">
    ${Charts.card('c-drc', 'Daily targets met', `% of that day’s targets met. A day counts as met at 67% or more (shaded). Dotted lines mark changes from your timeline.`,
      m.goals.length ? Charts.line(drcSeries, { max: 100, band: [67, 100], bandLabel: 'met', unit: '%', markers: markers(keys), label: 'Daily targets met' }) : `<p class="faint">No targets yet. Add 3–5 in <a href="#" data-a="tab" data-k="targets">Targets</a>.</p>`,
      Charts.table(['Day', '% met'], drcSeries.map(d => [d.full, d.value ?? 'no data'])))}
    ${Charts.card('c-focus', 'Focused minutes per day', 'Minutes in focus sprints. Weekend days are grey.', Charts.bars(focus, { unit: 'min', markers: markers(keys), label: 'Focused minutes' }), Charts.table(['Day', 'Minutes'], focus.map(d => [d.full, d.value ?? 'no data'])))}
  </div>
  <section class="card"><div class="ch-head"><h3>Worth a look</h3><span class="pill">auto-generated</span></div>
    ${f.wins.map(w => `<div class="flag"><span class="ic good">✓</span><div>${esc(w)}</div></div>`).join('')}
    ${f.flags.map(([i, t]) => `<div class="flag"><span class="ic">${i}</span><div>${esc(t)}</div></div>`).join('') || (f.wins.length ? '' : '<p class="faint">Nothing flagged yet. Flags appear after a week or two of use.</p>')}
  </section>
  ${V._now(m)}`;
};
V._now = m => {
  const pr = A.D.progress || {}; const up = (pr.upcoming || []).slice(0, 8); const open = (A.D.assignments || []).filter(a => a.status !== 'done' && a.due >= todayK()).sort((a, b) => a.due < b.due ? -1 : 1).slice(0, 6);
  return `<div class="grid">
    <section class="card"><h3>Coming up</h3><p class="muted">What he has planned for the next 7 days.</p>
      ${up.length ? Charts.table(['When', 'What'], up.map(t => [`${wd(t.date)} ${fmtD(t.date)}${t.time ? ' · ' + hm(t.time) : ''}`, t.title])) : '<p class="faint">Nothing planned yet.</p>'}</section>
    <section class="card"><h3>Due soon</h3><p class="muted">Open assignments and tests.</p>
      ${open.length ? Charts.table(['Due', 'Assignment', 'Study sessions'], open.map(a => [`${wd(a.due)} ${fmtD(a.due)}`, `${a.title} (${a.subject})`, `${a.sessions_done}/${a.sessions_planned}`])) : '<p class="faint">Nothing due.</p>'}</section>
  </div>`;
};

V.targets = m => {
  const goals = A.D.goals || []; const M = MQM.GOAL_METRICS;
  const weeks = [0, 1, 2, 3].map(w => m.range(7, w * 7));
  const rows = goals.map((g, gi) => `<tr>
    <td><select class="f" data-g="${gi}" data-f="metric">${Object.entries(M).map(([k, v]) => `<option value="${k}" ${g.metric === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></td>
    <td><input class="f" data-g="${gi}" data-f="label" value="${esc(g.label)}" maxlength="40"></td>
    <td style="width:110px"><input class="f" data-g="${gi}" data-f="target" type="number" value="${g.target}" ${M[g.metric] && M[g.metric].binary ? 'disabled' : ''}></td>
    <td><label><input type="checkbox" data-g="${gi}" data-f="active" ${g.active !== false ? 'checked' : ''}> on</label></td>
    <td><button class="btn small" data-a="gdel" data-k="${gi}">Remove</button></td></tr>`).join('');
  const perf = goals.filter(g => g.active !== false).map(g => {
    const cells = weeks.map(keys => { const r = keys.filter(m.has).map(k => MQM.goalMet(g, m.days[k])).filter(v => v !== null); return r.length ? `${r.filter(Boolean).length}/${r.length}` : '—'; });
    const last2 = weeks.slice(0, 2).flat().filter(m.has).map(k => MQM.goalMet(g, m.days[k])).filter(v => v !== null); const rate = last2.length ? last2.filter(Boolean).length / last2.length : null;
    const sug = rate === null || last2.length < 8 ? '<span class="faint">needs ~2 weeks of data</span>' : rate >= 0.86 ? '<span class="st good">Mastered: raise the target or swap it for a new one</span>' : rate <= 0.43 ? '<span class="st warn">Too hard right now: lower it or make it smaller</span>' : '<span class="st">Right level: keep it</span>';
    return [g.label, ...cells, { html: sug }];
  });
  return `<section class="card"><div class="ch-head"><div><h3>Daily targets</h3><p class="muted">Pick 3–5 specific behaviors (a Daily Report Card). He sees them on his Home screen. A day counts as met at 2 out of 3 (67%) or more. Reward met days, not perfect ones.</p></div></div>
    ${goals.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Measure</th><th>What he sees</th><th>Target</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="faint">No targets yet. Start with these three:</p>'}
    <div class="row" style="margin-top:12px"><button class="btn" data-a="gadd">＋ Add target</button>${goals.length ? '' : '<button class="btn" data-a="gstarter">Use a starter set</button>'}<button class="btn primary" data-a="gsave">Save and send to phone</button></div>
  </section>
  ${perf.length ? `<section class="card"><h3>Days met per week</h3><p class="muted">After two weeks: raise targets he meets 6–7 of 7 days, and lower ones he meets about 3 of 7.</p>
    ${Charts.table(['Target', 'This week', '1 wk ago', '2 wks ago', '3 wks ago', 'Suggestion'], perf)}</section>` : ''}`;
};

V.requests = m => {
  const R = A.D.requests || []; const acts = A.D.actions || [];
  const sent = id => acts.some(a => a.data && a.data.id === id && !a.applied_at);
  const red = R.filter(r => r.kind === 'redeem' && r.status !== 'given'); const wishes = R.filter(r => r.kind === 'wish' && (r.status === 'new' || r.status === 'pending'));
  const rewards = (A.D.progress || {}).rewards || [];
  return `<div class="grid">
    <section class="card"><h3>Rewards he cashed in</h3><p class="muted">Give it, then mark it given. He sees it on his phone.</p>
      ${red.length ? red.map(r => `<div class="flag"><div style="flex:1"><b>${esc(r.title)}</b> <span class="faint">${r.cost} coins · ${fmtD(r.at.slice(0, 10))}</span></div>${sent(r.id) ? '<span class="pill">sent · waiting for phone</span>' : `<button class="btn small primary" data-a="given" data-k="${esc(r.id)}">Mark given</button>`}</div>`).join('') : '<p class="faint">Nothing waiting.</p>'}
    </section>
    <section class="card"><h3>Wishes</h3><p class="muted">Rewards he asked you to add. Give each a coin price or say no.</p>
      ${wishes.length ? wishes.map(w => `<div class="flag"><div style="flex:1"><b>${esc(w.title)}</b></div>${sent(w.id) ? '<span class="pill">sent</span>' : `<input class="f" style="width:80px" type="number" placeholder="coins" id="wc-${esc(w.id)}"><button class="btn small primary" data-a="wadd" data-k="${esc(w.id)}" data-t="${esc(w.title)}">Add</button><button class="btn small" data-a="wno" data-k="${esc(w.id)}">No</button>`}</div>`).join('') : '<p class="faint">No new wishes.</p>'}
    </section>
  </div>
  <section class="card"><h3>Send him a note</h3><p class="muted">Shows up on his Home screen. Notice effort and starting (“You started math right on time”) more than results.</p>
    <textarea class="f" id="note" maxlength="300" placeholder="Proud of how you…"></textarea>
    <div class="row" style="margin-top:8px"><input class="f grow" id="note-from" value="${esc((store.get() || {}).from || 'Dad')}" style="max-width:180px"><button class="btn primary" data-a="note">Send note</button></div>
    ${acts.filter(a => a.kind === 'note').slice(-5).reverse().map(a => `<div class="flag"><div style="flex:1">${esc(a.data.text)}</div><span class="faint">${a.applied_at ? '✓ delivered' : 'waiting for phone'}</span></div>`).join('')}
  </section>
  <section class="card"><h3>Reward menu</h3><p class="muted">Rotate it every 2–3 weeks so rewards stay interesting. Mix small daily ones with bigger weekly ones.</p>
    <div id="rw">${rewards.map((r, i) => `<div class="row" style="margin:4px 0"><input class="f" style="width:60px" data-r="${i}" data-f="emoji" value="${esc(r.emoji)}"><input class="f grow" data-r="${i}" data-f="name" value="${esc(r.name)}"><input class="f" style="width:90px" type="number" data-r="${i}" data-f="cost" value="${r.cost}"><button class="btn small" data-a="rdel" data-k="${i}">✕</button></div>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button class="btn" data-a="radd">＋ Add</button><button class="btn primary" data-a="rsave">Send menu to phone</button></div>
  </section>`;
};

V.school = m => {
  const as = (A.D.assignments || []).slice().sort((a, b) => a.due < b.due ? 1 : -1);
  const onTime = a => a.status === 'done' && a.done_at ? (a.done_at.slice(0, 10) <= a.due ? 'on time' : 'late') : a.due < todayK() ? 'past due' : 'open';
  const papers = (A.D.papers || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const leads = A.D.events.filter(e => e.type === 'assignment_added' && typeof e.data.lead_days === 'number');
  return `<div class="tiles">
    ${tile('Assignments logged', as.length, '', `<span>${leads.length ? `median ${MQM.median(leads.map(e => e.data.lead_days))} days of notice` : ''}</span>`)}
    ${tile('Finished on time', pct(as.filter(a => onTime(a) === 'on time').length, as.filter(a => a.status === 'done').length), '%', `<span>${as.filter(a => a.status === 'done').length} finished</span>`)}
    ${tile('Papers captured', papers.length, '', `<span>${m.cur.logged ?? '—'}% of school days had something logged</span>`)}
    ${tile('Study packs waiting', (A.D.jobsPending || []).length, '', '<span>built by your scheduled Claude run</span>')}
  </div>
  <section class="card"><h3>Assignments & tests</h3>
    ${as.length ? Charts.table(['Due', 'Assignment', 'Subject', 'Type', 'Status', 'Study sessions', 'TEKS'], as.map(a => [`${wd(a.due)} ${fmtD(a.due)}`, a.title, a.subject, a.type, onTime(a), `${a.sessions_done}/${a.sessions_planned}`, (a.teks || []).join(', ')])) : '<p class="faint">None logged yet.</p>'}
  </section>
  <section class="card"><h3>Paper uploads</h3><p class="muted">Click a paper to see the photos. They’re stored in your Drive, in MainQuest → Papers.</p>
    <div class="gallery">${papers.map(p => `<div class="paper" data-a="paper" data-k="${esc(p.id)}"><div class="pt">${esc(p.title || 'Paper')}</div><div class="faint">${fmtD(p.date)} · ${esc(p.subject)} · ${p.pages || '?'} pg</div>
      <div class="faint">${p.status === 'ready' ? `📚 ${p.cards || 0} cards${p.mastered ? `, ${p.mastered} mastered` : ''}` : p.status === 'queued' ? '📨 study pack requested' : ''}${(p.teks || []).length ? ' · ' + esc(p.teks.join(', ')) : ''}</div></div>`).join('') || '<p class="faint">No papers yet.</p>'}</div>
    <div id="paper-view"></div>
  </section>`;
};

V.study = m => {
  const ev = A.D.events; const weeks = []; for (let w = 7; w >= 0; w--) weeks.push(m.range(7, w * 7));
  const wk = weeks.map(keys => ({ label: fmtD(keys[0]), full: `Week of ${fmtD(keys[0])}`, value: MQM.sum(keys.map(k => (m.days[k] || {}).focus_min || 0)) }));
  const cur = m.cur.ev; const bySub = {};
  cur.filter(e => e.type === 'mission_done' && (e.data.kind === 'study' || e.data.subject)).forEach(e => { const s = e.data.subject || 'other'; bySub[s] = bySub[s] || { n: 0, min: 0 }; bySub[s].n++; bySub[s].min += +e.data.actual || 0; });
  const quiz = ev.filter(e => e.type === 'quiz').map(e => ({ label: fmtD(MQM.dayOf(e.ts)), full: `${fmtD(MQM.dayOf(e.ts))} · ${e.data.subject || ''}`, value: e.data.pct }));
  const cards = MQM.sum(cur.filter(e => e.type === 'cards').map(e => +e.data.n || 0));
  return `<div class="tiles">
    ${tile('Study sessions done', MQM.sum(m.cur.keys.map(k => (m.days[k] || {}).study_sessions || 0)), '', delta(MQM.sum(m.cur.keys.map(k => (m.days[k] || {}).study_sessions || 0)), MQM.sum(m.prev.keys.map(k => (m.days[k] || {}).study_sessions || 0))))}
    ${tile('Flashcards reviewed', cards, '', '<span>self-testing (retrieval practice)</span>')}
    ${tile('Quiz average', quiz.length ? Math.round(MQM.sum(quiz.map(q => q.value)) / quiz.length) : null, '%', `<span>${quiz.length} quizzes</span>`)}
    ${tile('Time vs estimate', m.cur.est_ratio, '×', '<span>1.0 = he guessed right</span>')}
  </div>
  <div class="grid">
    ${Charts.card('c-wk', 'Focused minutes per week', 'All focus sprints, school and personal.', Charts.bars(wk, { unit: 'min', label: 'Minutes per week' }), Charts.table(['Week', 'Minutes'], wk.map(w => [w.full, w.value])))}
    ${Charts.card('c-sub', 'Study by subject', `Last ${A.period / 7} weeks: finished study missions and minutes.`, Object.keys(bySub).length ? Charts.hbars(Object.entries(bySub).sort((a, b) => b[1].min - a[1].min).map(([s, v]) => ({ label: s, sub: `${v.n} sessions`, value: Math.round(v.min) })), { unit: ' min' }) : '<p class="faint">No study missions finished yet.</p>', Charts.table(['Subject', 'Sessions', 'Minutes'], Object.entries(bySub).map(([s, v]) => [s, v.n, Math.round(v.min)])))}
  </div>
  ${Charts.card('c-quiz', 'Quiz scores', 'Practice quizzes from his study packs.', quiz.length ? Charts.line(quiz, { max: 100, unit: '%', label: 'Quiz scores' }) : '<p class="faint">No quizzes yet.</p>', Charts.table(['Date', 'Score'], quiz.map(q => [q.full, q.value + '%'])))}`;
};

V.strategies = m => {
  const c = m.cur, p = m.prev; const T = MQM.TACTICS;
  const rows = Object.entries(T).map(([k, t]) => ({ k, t, n: c.tactics[k] || 0, pn: p.tactics[k] || 0 })).sort((a, b) => b.n - a.n);
  const buckets = [['Before 8 am', 0, 8], ['8 am–3 pm', 8, 15], ['3–6 pm', 15, 18], ['6–9 pm', 18, 21], ['After 9 pm', 21, 24]];
  const hr = e => new Date(e.ts).getHours();
  const tod = buckets.map(([l, a, b]) => { const ch = c.ev.filter(e => e.type === 'checkin' && hr(e) >= a && hr(e) < b); const st = c.ev.filter(e => e.type === 'focus_start' && hr(e) >= a && hr(e) < b);
    return { label: l, sub: `${st.length} sessions · ${ch.length} check-ins`, value: ch.length ? pct(ch.filter(e => e.data.result === 'yes').length, ch.length) : null }; });
  const byDomain = {}; rows.filter(r => r.k !== 'park').forEach(r => { byDomain[r.t.domain] = (byDomain[r.t.domain] || 0) + r.n; });
  return `<div class="tiles">
    ${tile('Started on his own', c.ind.self_pct, '%', delta(c.ind.self_pct, p.ind.self_pct, ' pts'), `${c.ind.self_started} of ${c.ind.starts} focus sessions, no reminder`)}
    ${tile('Easier-task switches', c.ind.swaps, '', `<span>${c.ind.swaps_returned} went back to the hard task</span>`)}
    ${tile('Drift → refocus', c.tactics.refocus || 0, '', `<span>times he came back after drifting</span>`)}
    ${tile('Stuck-button uses', MQM.sum(['chunk', 'two_min', 'move_first', 'help', 'swap'].map(k => c.tactics[k] || 0)), '', '<span>chunk, 2-min start, move, help, swap</span>')}
  </div>
  ${Charts.card('c-dom', 'Strategy use by skill area', `Times used in the last ${A.period / 7} weeks, grouped by executive-function skill.`, Charts.hbars(Object.entries(byDomain).sort((a, b) => b[1] - a[1]).map(([d, n]) => ({ label: d, value: n }))), Charts.table(['Skill area', 'Uses'], Object.entries(byDomain)))}
  <section class="card"><h3>Strategies he used</h3><p class="muted">Named the way clinicians and counselors name them. “What good looks like” is the pattern to hope for over several weeks. His parking-lot use stays private to him (not even the count is sent).</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Strategy</th><th>Skill area</th><th class="n">Uses</th><th class="n">Before</th><th>Evidence</th><th>What good looks like</th><th>Watch for</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.t.name)}</td><td>${esc(r.t.domain)}</td>${r.k === 'park' ? '<td class="n faint" colspan="2">private</td>' : `<td class="n">${r.n}</td><td class="n">${r.pn}</td>`}<td class="faint">${esc(MQM.EVIDENCE[r.t.ev] || '')}</td><td>${esc(r.t.good || '')}</td><td>${esc(r.t.flag || '')}</td></tr>`).join('')}
    </tbody></table></div></section>
  ${Charts.card('c-tod', 'On task by time of day', '% of check-ins answered “locked in”. Look for times that are consistently harder.', Charts.hbars(tod, { max: 100, unit: '%' }), Charts.table(['Time', 'On task %', 'Sessions / check-ins'], tod.map(t => [t.label, t.value ?? '—', t.sub])))}`;
};

V.report = m => {
  const c = m.cur, p = m.prev; const keys = m.range(A.period); const f = flags(m); const name = A.D.child;
  const from = keys[0], to = keys[keys.length - 1];
  const goalRows = m.goals.map(g => { const r = keys.filter(m.has).map(k => MQM.goalMet(g, m.days[k])).filter(v => v !== null); const pr = m.prev.keys.filter(m.has).map(k => MQM.goalMet(g, m.days[k])).filter(v => v !== null);
    return [g.label, r.length ? `${r.filter(Boolean).length}/${r.length} (${pct(r.filter(Boolean).length, r.length)}%)` : 'no data', pr.length ? `${pct(pr.filter(Boolean).length, pr.length)}%` : '—']; });
  const tl = (A.D.timeline || []).filter(t => t.kind !== 'medication' || A.showMed).sort((a, b) => a.date < b.date ? -1 : 1);
  const tac = Object.entries(MQM.TACTICS).map(([k, t]) => [t.name, t.domain, c.tactics[k] || 0, p.tactics[k] || 0]).filter(r => r[2] || r[3]).sort((a, b) => b[2] - a[2]);
  const drcSeries = keys.map(k => { const s = m.has(k) ? MQM.drcDay(m.goals, m.days[k]) : null; return { label: fmtD(k), full: fmtD(k), value: s ? s.pct : null }; });
  const wishes = (A.D.requests || []).filter(r => r.kind === 'wish').slice(-5).map(r => r.title);
  return `<div class="row noprint" style="margin:14px 0"><button class="btn primary" data-a="print">Print / save as PDF</button><button class="btn" data-a="csv">Download daily data (CSV)</button>
    <label class="faint"><input type="checkbox" data-a="med" ${A.showMed ? 'checked' : ''}> include medication entries from the timeline</label></div>
  <article class="card report">
    <h1>Progress summary: ${esc(name)}</h1>
    <p class="muted">${fmtD(from, { month: 'long', day: 'numeric', year: 'numeric' })} – ${fmtD(to, { month: 'long', day: 'numeric', year: 'numeric' })} (${A.period / 7} weeks), compared with the ${A.period / 7} weeks before. Source: MainQuest planner app logs; ${c.dataDays} of ${keys.length} days had app data. Prepared by a parent for discussion; not a clinical assessment.</p>
    <h2>Snapshot</h2>
    ${Charts.table(['Measure', 'This period', 'Previous period'], [
      ['Days daily targets met (≥ 67%)', c.drc_pct === null ? '—' : `${c.drc_pct}% (${c.drc_met}/${c.drc_n})`, p.drc_pct === null ? '—' : `${p.drc_pct}%`],
      ['Assignments finished on time', c.on_time === null ? '—' : `${c.on_time}% of ${c.done}`, p.on_time === null ? '—' : `${p.on_time}%`],
      ['School days with assignments/papers logged', c.logged === null ? '—' : `${c.logged}%`, p.logged === null ? '—' : `${p.logged}%`],
      ['Median start delay after planned time', c.latency === null ? '—' : `${c.latency} min`, p.latency === null ? '—' : `${p.latency} min`],
      ['Time taken vs his estimate', c.est_ratio === null ? '—' : `${c.est_ratio}×`, p.est_ratio === null ? '—' : `${p.est_ratio}×`],
      ['Focused minutes per school day', c.focus_sd ?? '—', p.focus_sd ?? '—'],
      ['On task at self-check-ins', c.on_task === null ? '—' : `${c.on_task}% of ${c.checkins}`, p.on_task === null ? '—' : `${p.on_task}%`],
      ['Focus sessions started without a reminder', c.ind.self_pct === null ? '—' : `${c.ind.self_pct}%`, p.ind.self_pct === null ? '—' : `${p.ind.self_pct}%`],
    ])}
    <h2>Daily targets</h2>
    ${goalRows.length ? Charts.table(['Target', 'Days met (this period)', 'Previous'], goalRows) : '<p class="faint">No targets set.</p>'}
    ${m.goals.length ? Charts.line(drcSeries, { max: 100, band: [67, 100], bandLabel: 'met', unit: '%', markers: markers(keys), label: 'Daily targets met', height: 180 }) : ''}
    <h2>Strategies used</h2>
    ${tac.length ? Charts.table(['Strategy', 'Skill area', 'Uses', 'Previous'], tac) : '<p class="faint">None logged.</p>'}
    <h2>Observations</h2>
    ${f.wins.map(w => `<p>✓ ${esc(w)}</p>`).join('')}${f.flags.map(([, t]) => `<p>• ${esc(t)}</p>`).join('') || (f.wins.length ? '' : '<p class="faint">Nothing notable.</p>')}
    ${tl.length ? `<h2>Timeline of changes</h2>${Charts.table(['Date', 'Change', 'Type'], tl.map(t => [fmtD(t.date, { month: 'short', day: 'numeric', year: 'numeric' }), t.label, t.kind]))}` : ''}
    ${wishes.length ? `<h2>In his words</h2><p>Rewards he asked for: ${wishes.map(esc).join(' · ')}</p>` : ''}
    <h2>Questions for the counselor</h2>
    <p>Which one or two targets should we work on next? Should any supports be faded (fewer reminders, longer sprints) given the numbers above? Is there a classroom or 504/IEP accommodation the data supports? (Pattern: “Before [support], [baseline]; with [support] for ${A.period / 7} weeks, [result]”.)</p>
    <h2>Data notes</h2>
    <p class="faint">“No data” means the app wasn’t opened that day; it does not mean work was skipped. Check-ins are his own ratings. Using the app is not the same as effort. Private notes he writes in the app (“parking lot”) are never collected. Event-level data and daily summaries are in the family’s Google Drive (MainQuest folder).</p>
  </article>`;
};

V.settings = m => {
  const tl = (A.D.timeline || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const seen = A.D.lastSeen;
  return `<div class="grid">
  <section class="card"><h3>His phone</h3>
    <p class="muted">${seen ? `Last synced ${new Date(seen.at).toLocaleString()} · app ${esc(seen.version || '?')}` : 'No phone linked yet.'}</p>
    <div id="pair"><button class="btn primary" data-a="paircode">Link a phone (get a code)</button></div>
    <p class="faint">On his phone: Profile → Grown-up zone → Parent dashboard → type the code. Linking a new phone disconnects the old one.</p>
    <button class="btn small" data-a="unlink">Disconnect his phone</button>
  </section>
  <section class="card"><h3>Your Google Drive</h3>
    <p class="muted">Everything lives in your Drive: <a href="${esc(A.D.driveUrl)}" target="_blank" rel="noopener">MainQuest / ${esc(A.D.child)}</a>. Your scheduled Claude runs read this folder, build study packs, and write reports to <b>Reports</b>.</p>
    ${(A.D.reports || []).length ? Charts.table(['Report', 'Updated'], A.D.reports.slice(0, 6).map(r => [{ html: `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a>` }, new Date(r.updated).toLocaleDateString()])) : '<p class="faint">No reports yet. The weekly Claude run puts them here.</p>'}
  </section></div>
  <section class="card"><h3>Timeline</h3><p class="muted">Mark changes (new strategy, new school routine, a schedule change, a medication change) so charts show a before/after line. Medication entries stay off the counselor report unless you include them.</p>
    <div class="row"><input class="f" type="date" id="tl-date" value="${todayK()}" style="max-width:170px"><input class="f grow" id="tl-label" placeholder="e.g. Started 10-minute sprints" maxlength="60">
      <select class="f" id="tl-kind" style="max-width:160px"><option value="strategy">strategy</option><option value="change">change</option><option value="school">school</option><option value="medication">medication</option><option value="other">other</option></select>
      <button class="btn primary" data-a="tladd">Add</button></div>
    ${tl.length ? Charts.table(['Date', 'Change', 'Type'], tl.map(t => [t.date, t.label, t.kind])) + `<div class="row" style="margin-top:8px">${tl.map((t, i) => `<button class="btn small" data-a="tldel" data-k="${esc(t.date + '|' + t.label)}">✕ ${esc(t.label.slice(0, 18))}</button>`).join('')}</div>` : ''}
  </section>
  <section class="card"><h3>This computer</h3><button class="btn" data-a="signout">Sign out</button> <span class="faint">Forgets the parent key on this browser.</span></section>`;
};

/* ------------------------------------------------------------------ shell */
const TABS = [['overview', 'Overview'], ['targets', 'Targets'], ['requests', 'Requests'], ['school', 'School'], ['study', 'Study'], ['strategies', 'Strategies'], ['report', 'Counselor report'], ['settings', 'Settings']];
function render() {
  const m = model();
  const seen = A.D.lastSeen ? Math.round((Date.now() - Date.parse(A.D.lastSeen.at)) / 60e3) : null;
  $('#app').innerHTML = `<header class="top"><div class="wrap"><div class="brand">MainQuest<small>${esc(A.D.child)} · ${seen === null ? 'phone not linked' : seen < 90 ? `synced ${seen} min ago` : `synced ${Math.round(seen / 60)} h ago`}</small></div>
    <nav class="tabs">${TABS.map(([k, l]) => `<button class="${A.tab === k ? 'on' : ''}" data-a="tab" data-k="${k}">${l}</button>`).join('')}</nav></div></header>
    <main class="wrap">
      ${['settings', 'requests'].includes(A.tab) ? '' : `<div class="filters"><div class="seg">${[[14, '2 weeks'], [28, '4 weeks'], [56, '8 weeks']].map(([d, l]) => `<button class="${A.period === d ? 'on' : ''}" data-a="period" data-k="${d}">${l}</button>`).join('')}</div>
        <button class="btn small" data-a="refresh">↻ Refresh</button></div>`}
      ${V[A.tab](m)}
    </main>`;
}
async function load() {
  A.busy = true;
  try { A.D = await API.call('dash', { days: 130 }); render(); }
  catch (e) { if (e.code === 'auth') { store.set(null); login('That key didn’t work.'); } else $('#app').innerHTML = `<div class="login card"><h3>Couldn’t reach your relay</h3><p class="muted">${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`; }
  A.busy = false;
}
function login(msg) {
  $('#app').innerHTML = `<div class="login card"><h2 style="margin-top:0">MainQuest parent dashboard</h2>
    <p class="muted">Sign in with the parent key from your relay’s setup log.</p>
    ${inRelay() ? '' : `<label class="faint">Relay address</label><input class="f" id="lg-url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc((store.get() || {}).url || '')}"><div style="height:10px"></div>`}
    <label class="faint">Parent key</label><input class="f" id="lg-key" type="password" placeholder="P-…" autocomplete="current-password">
    <label class="faint" style="display:block;margin:10px 0"><input type="checkbox" id="lg-rem" checked> Remember on this computer</label>
    ${msg ? `<p style="color:var(--crit)">${esc(msg)}</p>` : ''}
    <button class="btn primary" data-a="login">Sign in</button></div>`;
  setTimeout(() => { const k = $('#lg-key'); k && k.addEventListener('keydown', e => { if (e.key === 'Enter') $('[data-a=login]').click(); }); }, 0);
}

/* ------------------------------------------------------------------ actions */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, k = b.dataset.k;
  if (a === 'login') {
    const url = $('#lg-url') ? $('#lg-url').value.trim() : ''; const key = $('#lg-key').value.trim();
    if (!inRelay() && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) return login('The relay address starts with https://script.google.com/');
    API.url = url; API.key = key; if ($('#lg-rem').checked) store.set({ url, key }); $('#app').innerHTML = '<div class="login card"><span class="spin"></span> Loading…</div>'; return load();
  }
  if (a === 'tab') { e.preventDefault(); A.tab = k; render(); window.scrollTo(0, 0); return; }
  if (a === 'period') { A.period = +k; return render(); }
  if (a === 'refresh') { b.disabled = true; return load(); }
  if (a === 'med') { A.showMed = b.checked; return render(); }
  if (a === 'print') return window.print();
  if (a === 'csv') {
    const m = model(); const keys = Object.keys(m.days).sort(); const cols = ['date', 'schoolDay', 'events', 'missions_done', 'focus_min', 'sprints', 'sprints_completed', 'checkins', 'on_task', 'on_task_pct', 'drifts', 'refocus', 'start_latency', 'estimate_ratio', 'routine_morning', 'routine_after', 'routine_bed', 'bag_packed', 'papers_scanned', 'assignments_added', 'study_sessions', 'assignments_done', 'on_time', 'stuck', 'reminders_started', 'reminders_snoozed', 'targets_met_pct'];
    const rows = keys.map(d => { const r = m.days[d]; const s = MQM.drcDay(m.goals, r); return cols.map(c => c === 'targets_met_pct' ? (s ? s.pct : '') : r[c] ?? ''); });
    const csv = [cols.join(',')].concat(rows.map(r => r.join(','))).join('\n');
    const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); el.download = `mainquest-${A.D.child}-daily.csv`; el.click(); return;
  }
  // targets
  const readGoals = () => { const g = (A.D.goals || []).map(x => ({ ...x })); document.querySelectorAll('[data-g]').forEach(el => { const i = +el.dataset.g, f = el.dataset.f; g[i][f] = f === 'active' ? el.checked : f === 'target' ? +el.value : el.value; }); return g; };
  if (a === 'gadd') { const g = readGoals(); if (g.length >= 6) return toast('Keep it to 3–5 targets'); g.push({ id: 'g' + Date.now(), metric: 'focus_min', label: 'Focus 20 minutes', target: 20, active: true }); A.D.goals = g; return render(); }
  if (a === 'gstarter') { A.D.goals = [{ id: 'g1', metric: 'missions_done', label: 'Finish 2 missions', target: 2, active: true }, { id: 'g2', metric: 'assignments_added', label: 'Log what’s due (school days)', target: 1, active: true }, { id: 'g3', metric: 'bag_packed', label: 'Bag packed the night before', target: 1, active: true }]; return render(); }
  if (a === 'gdel') { const g = readGoals(); g.splice(+k, 1); A.D.goals = g; return render(); }
  if (a === 'gsave') { const g = readGoals().map(x => { const M = MQM.GOAL_METRICS[x.metric]; if (M && M.binary) x.target = 1; if (!x.label.trim()) x.label = M ? M.label : x.metric; return x; }); await API.call('goals', { goals: g }); A.D.goals = g; toast('Targets saved. They reach his phone on its next sync.'); return render(); }
  // requests
  const act = async (kind, data, msg) => { b.disabled = true; try { const r = await API.call('act', { kind, data }); A.D.actions = (A.D.actions || []).concat([r.action]); toast(msg); render(); } catch (x) { toast(x.message); b.disabled = false; } };
  if (a === 'given') return act('redeem_given', { id: k }, 'Marked as given');
  if (a === 'wno') return act('wish_decline', { id: k }, 'Sent');
  if (a === 'wadd') { const cost = +($('#wc-' + CSS.escape(k)) || {}).value; if (!(cost > 0)) return toast('Give it a coin price first'); return act('wish_add', { id: k, name: b.dataset.t, cost }, 'Added to his reward menu'); }
  if (a === 'note') { const t = $('#note').value.trim(); if (!t) return; const from = $('#note-from').value.trim() || 'Dad'; store.get() && store.set({ ...store.get(), from }); return act('note', { text: t, from }, 'Note sent'); }
  const readRw = () => { const r = ((A.D.progress || {}).rewards || []).map(x => ({ ...x })); document.querySelectorAll('[data-r]').forEach(el => { r[+el.dataset.r][el.dataset.f] = el.dataset.f === 'cost' ? +el.value : el.value; }); return r; };
  if (a === 'radd') { const r = readRw(); r.push({ emoji: '⭐', name: 'New reward', cost: 50 }); A.D.progress = { ...(A.D.progress || {}), rewards: r }; return render(); }
  if (a === 'rdel') { const r = readRw(); r.splice(+k, 1); A.D.progress = { ...(A.D.progress || {}), rewards: r }; return render(); }
  if (a === 'rsave') { const r = readRw(); A.D.progress = { ...(A.D.progress || {}), rewards: r }; return act('set_rewards', { rewards: r }, 'Reward menu sent'); }
  // school
  if (a === 'paper') {
    const box = $('#paper-view'); const p = A.D.papers.find(x => x.id === k);
    box.innerHTML = `<div class="card"><span class="spin"></span> Loading photos…</div>`;
    try { const r = A.imgs[k] || await API.call('img', { paperId: k }); A.imgs[k] = r;
      box.innerHTML = `<div class="card"><div class="ch-head"><h3>${esc(p.title || 'Paper')}</h3><button class="tbtn" onclick="this.closest('.card').remove()">Close</button></div>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}<div class="imgs">${r.images.map(i => `<img src="${i.url}" alt="page ${i.n}">`).join('') || '<p class="faint">No photos uploaded (photo sharing is off on his phone).</p>'}</div></div>`;
      box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) { box.innerHTML = `<p class="faint">${esc(x.message)}</p>`; }
    return;
  }
  // settings
  if (a === 'paircode') { const r = await API.call('paircode'); $('#pair').innerHTML = `<div class="code">${esc(r.code)}</div><p class="faint">Type this on his phone within 30 minutes. It works once.</p>`; return; }
  if (a === 'unlink') { if (!confirm('Disconnect his phone? It stops syncing until you link it again with a new code. Data already in Drive stays.')) return; await API.call('unlink'); toast('Phone disconnected'); return; }
  if (a === 'tladd') { const label = $('#tl-label').value.trim(); if (!label) return toast('Describe the change'); const tl = (A.D.timeline || []).concat([{ date: $('#tl-date').value, label, kind: $('#tl-kind').value }]); await API.call('timeline', { timeline: tl }); A.D.timeline = tl; toast('Added to timeline'); return render(); }
  if (a === 'tldel') { const tl = (A.D.timeline || []).filter(t => t.date + '|' + t.label !== k); await API.call('timeline', { timeline: tl }); A.D.timeline = tl; return render(); }
  if (a === 'signout') { store.set(null); API.key = ''; return login(); }
});

(function boot() {
  const s = store.get();
  const q = new URLSearchParams(location.search);
  if (q.get('relay') && !inRelay()) API.url = q.get('relay');
  if (s && s.key) { API.url = s.url || API.url; API.key = s.key; load(); } else login();
})();
