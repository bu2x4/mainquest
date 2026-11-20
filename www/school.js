'use strict';
/* School: assignments, paper scans, AI study packs (TEKS-aligned), flashcards, practice quizzes. */

const teksFor = (grade, subject) => ((typeof TEKS !== 'undefined' && TEKS[grade]) ? (TEKS[grade][subject] || []) : []);
function teksDesc(grade, code) {
  if (typeof TEKS === 'undefined' || !TEKS[grade]) return '';
  for (const k of Object.keys(TEKS[grade])) { const hit = TEKS[grade][k].find(([c]) => c === code); if (hit) return hit[1]; }
  return '';
}

const School = {
  seg: 'due',

  /* ================================================================ Tab view */
  view() {
    const seg = this.seg;
    return `<div class="row" style="justify-content:space-between;align-items:center"><h1>School</h1>
        <button class="btn small primary" data-a="scan">📸 Scan paper</button></div>
      <div class="seg">${[['due', 'Due'], ['papers', 'Papers'], ['study', 'Study']].map(([k, l]) => `<button class="${seg === k ? 'on' : ''}" data-a="seg" data-k="${k}">${l}</button>`).join('')}</div>
      ${seg === 'due' ? this.dueView() : seg === 'papers' ? this.papersView() : this.studyView()}`;
  },

  dueView() {
    const open = openAssignments();
    const groups = [['Still open', a => daysUntil(a.due) < 0], ['Today', a => daysUntil(a.due) === 0], ['Tomorrow', a => daysUntil(a.due) === 1],
      ['This week', a => daysUntil(a.due) > 1 && daysUntil(a.due) <= 7], ['Later', a => daysUntil(a.due) > 7]];
    const done = S.assignments.filter(a => a.status === 'done' && a.doneAt > Date.now() - 7 * 864e5);
    return `<button class="btn ghost block" data-a="newAssignment" style="margin-bottom:12px">＋ Add assignment, test or project</button>
      ${open.length ? groups.map(([label, fn]) => { const list = open.filter(fn); return list.length ? `<h2>${label}</h2>${list.map(a => this.assignmentRow(a)).join('')}` : ''; }).join('')
        : `<div class="card soft center sub">Nothing due. Add homework as you get it — or scan the paper and let MainQuest find the due date.</div>`}
      ${done.length ? `<details class="fold"><summary>Cleared this week · ${done.length}</summary>${done.map(a => this.assignmentRow(a)).join('')}</details>` : ''}`;
  },

  assignmentRow(a) {
    const s = subj(a.subject), t = atype(a.type);
    const linked = S.tasks.filter(x => x.assignmentId === a.id);
    const prog = linked.length ? `${linked.filter(x => x.done).length}/${linked.length} sessions` : '';
    return `<button class="arow ${a.status === 'done' ? 'done' : ''}" data-a="openAssignment" data-id="${a.id}" style="--sc:${s.color}">
      <span class="arow-ic">${t.icon}</span>
      <span class="grow"><span class="arow-t">${esc(a.title)}</span>
        <span class="arow-m">${esc(s.name)} · ${esc(t.name)} · ${a.status === 'done' ? 'Cleared' : 'Due ' + dueLc(a.due)}${prog ? ' · ' + prog : ''}</span>
        ${a.maxHp && a.status !== 'done' ? `<span class="hp"><i style="width:${(a.hp / a.maxHp * 100).toFixed(0)}%"></i></span>` : ''}</span>
      <span class="chev">›</span></button>`;
  },

  papersView() {
    const papers = S.papers.slice().sort((a, b) => b.created - a.created);
    const byDay = {}; papers.forEach(p => { (byDay[p.date] = byDay[p.date] || []).push(p); });
    const scannedToday = (byDay[today()] || []).length;
    return `<div class="card hero-scan">
        <div class="grow"><b style="font-size:18px">Today’s papers</b><div class="sub">${scannedToday ? `${scannedToday} scanned today` : 'Snap each paper you got today. Due dates and study material come out of it.'}</div></div>
        <button class="btn primary" data-a="scan">📸 Scan</button></div>
      ${Object.keys(byDay).sort().reverse().map(d => `<h2>${d === today() ? 'Today' : dueLabel(d)} <span class="faint">${new Date(d + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></h2>
        ${byDay[d].map(p => `<button class="arow" data-a="openPaper" data-id="${p.id}" style="--sc:${subj(p.subject).color}">
          <span class="thumb" data-thumb="${p.imageIds[0] || ''}"></span>
          <span class="grow"><span class="arow-t">${esc(p.title || 'Untitled paper')}</span>
          <span class="arow-m">${esc(subj(p.subject).name)} · ${p.imageIds.length} page${p.imageIds.length === 1 ? '' : 's'} · ${{ saved: 'saved', processing: 'building study pack…', queued: 'study pack on the way', ready: 'study pack ready', error: 'tap to retry' }[p.status] || ''}</span></span>
          <span class="chev">›</span></button>`).join('')}`).join('')}`;
  },

  studyView() {
    const decks = S.papers.filter(p => p.study && ((p.study.flashcards || []).length || (p.study.quiz || []).length));
    const bosses = openAssignments().filter(a => a.maxHp && !a.defeated);
    const rank = p => { const a = p.assignmentId && S.assignments.find(x => x.id === p.assignmentId && x.status !== 'done'); return a ? daysUntil(a.due) : 99; };
    decks.sort((a, b) => rank(a) - rank(b));
    return `${bosses.length ? `<h2>Boss fights</h2>${bosses.map(a => this.bossCard(a)).join('')}` : ''}
      <h2>Study decks</h2>
      ${decks.length ? decks.map(p => { const due = (p.study.flashcards || []).filter(c => (c.box || 0) < 3).length;
        return `<div class="card deck" style="--sc:${subj(p.subject).color}"><div class="row"><div class="grow"><b>${esc(p.title || 'Study deck')}</b>
          <div class="faint">${esc(subj(p.subject).name)} · ${(p.study.flashcards || []).length} cards (${due} to learn) · ${(p.study.quiz || []).length} quiz questions</div></div></div>
          <div class="btn-row"><button class="btn small" data-a="cards" data-id="${p.id}">Flashcards</button><button class="btn small" data-a="quiz" data-id="${p.id}" ${(p.study.quiz || []).length ? '' : 'disabled'}>Practice quiz</button><button class="btn small ghost" data-a="openPaper" data-id="${p.id}">Pack</button></div></div>`; }).join('')
        : `<div class="card soft center sub">Scan a paper or study guide to build your first deck.</div>`}`;
  },

  bossCard(a) {
    const s = subj(a.subject);
    const linked = S.tasks.filter(x => x.assignmentId === a.id);
    const next = linked.find(x => !x.done);
    return `<div class="card boss-card" style="--sc:${s.color}">
      <div class="row"><div class="grow"><div class="boss-name">${esc(a.boss)}</div><div class="faint">${esc(atype(a.type).name)}: ${esc(a.title)} · ${dueLabel(a.due)}</div></div><span class="pill">${a.hp}/${a.maxHp} HP</span></div>
      <div class="hp big"><i style="width:${(a.hp / a.maxHp * 100).toFixed(0)}%"></i></div>
      <div class="faint" style="margin-top:6px">${linked.filter(x => x.done).length} of ${linked.length} study hits landed${next ? ` · next: ${next.date === today() ? 'today' : dueLc(next.date)}` : ''}</div>
      <div class="btn-row">${next ? `<button class="btn small primary" data-a="start" data-id="${next.id}">⚔️ Attack (study now)</button>` : ''}<button class="btn small" data-a="openAssignment" data-id="${a.id}">Details</button></div></div>`;
  },

  /* ================================================================ Assignment add/edit */
  assignmentSheet(a = null, prefill = {}) {
    const isNew = !a;
    const f = a ? { ...a } : { title: '', subject: 'math', type: 'homework', due: dayKey(addDays(new Date(), 1)), notes: '', ...prefill };
    const quick = [[1, 'Tomorrow'], [2, '2 days'], [nextWeekday(5), 'Friday'], [nextWeekday(1), 'Next Mon'], [7, '1 week']];
    const draw = () => UI.sheet(`<div class="grab"></div><h3>${isNew ? 'New assignment' : 'Edit assignment'}</h3>
      <input class="field" id="as-title" value="${esc(f.title)}" placeholder="e.g. Chapter 4 math test" autocomplete="off">
      <label class="lbl">Subject</label><div class="chips">${SUBJECTS.map(s => `<button class="chip ${f.subject === s.id ? 'on' : ''}" data-x="subj" data-k="${s.id}">${s.icon} ${s.name}</button>`).join('')}</div>
      <label class="lbl">Type</label><div class="chips">${ATYPES.map(t => `<button class="chip ${f.type === t.id ? 'on' : ''}" data-x="type" data-k="${t.id}">${t.icon} ${t.name}</button>`).join('')}</div>
      <label class="lbl">Due</label><div class="chips">${quick.map(([d, l]) => `<button class="chip ${f.due === dayKey(addDays(new Date(), d)) ? 'on' : ''}" data-x="due" data-k="${d}">${l}</button>`).join('')}</div>
      <input class="field" type="date" id="as-due" value="${f.due}" style="margin-top:8px">
      ${['test', 'quiz', 'project'].includes(f.type) ? `<p class="sub" style="margin:10px 2px 0">⚔️ This becomes a boss fight. MainQuest spreads study sessions before ${dueLc(f.due)} — each one is a hit.</p>` : ''}
      <label class="lbl">Notes</label><input class="field" id="as-notes" value="${esc(f.notes || '')}" placeholder="Pages, problems, what the teacher said…">
      <div class="spacer"></div><button class="btn primary big" data-x="save">${isNew ? 'Add + plan it' : 'Save'}</button>
      ${!isNew ? `<div class="btn-row"><button class="btn ghost" data-x="delete">Delete</button></div>` : ''}`, root => {
      const pull = () => { f.title = $('#as-title', root).value.trim(); f.due = $('#as-due', root).value || f.due; f.notes = $('#as-notes', root).value; };
      root.onclick = async e => {
        const b = e.target.closest('[data-x]'); if (!b) return; pull(); const k = b.dataset.k;
        if (b.dataset.x === 'subj') { f.subject = k; return draw(); }
        if (b.dataset.x === 'type') { f.type = k; return draw(); }
        if (b.dataset.x === 'due') { f.due = dayKey(addDays(new Date(), +k)); return draw(); }
        if (b.dataset.x === 'save') {
          if (!f.title) { UI.toast('Give it a name'); return; }
          if (isNew) { const na = createAssignment(f); GSync.soon(); UI.closeSheet(); UI.render(); UI.toast(na.maxHp ? `Boss spawned: ${na.boss}. ${S.tasks.filter(t => t.assignmentId === na.id).length} study hits scheduled.` : `Added. Reminder set for ${dueLabel(na.due) === 'Tomorrow' ? 'today after school' : 'the day before'}.`); Sfx.play('coin'); }
          else { const orig = S.assignments.find(x => x.id === a.id); const replan = orig.due !== f.due || orig.type !== f.type; Object.assign(orig, { title: f.title, subject: f.subject, type: f.type, due: f.due, notes: f.notes, gdirty: true }); if (replan) planAssignment(orig); save(); GSync.soon(); UI.closeSheet(); UI.render(); UI.toast(replan ? 'Saved and re-planned' : 'Saved'); }
        }
        if (b.dataset.x === 'delete') { if (await ask(`Delete “${a.title}” and its planned study sessions?`, { ok: 'Delete' })) { if (a.gcalId) S.gdeletes.push(a.gcalId); S.tasks.filter(t => t.assignmentId === a.id && !t.done && t.gcalId).forEach(t => S.gdeletes.push(t.gcalId)); S.assignments = S.assignments.filter(x => x.id !== a.id); S.tasks = S.tasks.filter(t => !(t.assignmentId === a.id && !t.done)); save(); GSync.soon(); UI.closeSheet(); UI.render(); } }
      };
    });
    draw();
  },

  assignmentDetail(a) {
    const s = subj(a.subject), t = atype(a.type);
    const linked = S.tasks.filter(x => x.assignmentId === a.id).sort((x, y) => (x.date || '') < (y.date || '') ? -1 : 1);
    const papers = S.papers.filter(p => p.assignmentId === a.id || (a.paperIds || []).includes(p.id));
    const past = daysUntil(a.due) < 0 || (daysUntil(a.due) === 0 && new Date().getHours() >= 15);
    UI.sheet(`<div class="grab"></div>
      <div class="row"><span style="font-size:30px">${t.icon}</span><div class="grow"><h3 style="margin:0">${esc(a.title)}</h3><div class="faint">${esc(s.name)} · ${esc(t.name)} · due ${dueLabel(a.due)}</div></div><button class="btn small" data-x="edit">Edit</button></div>
      ${a.notes ? `<p class="sub">${esc(a.notes)}</p>` : ''}
      ${a.maxHp ? `<div class="card boss-card" style="--sc:${s.color};margin-top:12px"><div class="row"><div class="grow boss-name">${esc(a.boss)}</div><span class="pill">${a.defeated ? 'Defeated' : `${a.hp}/${a.maxHp} HP`}</span></div><div class="hp big"><i style="width:${(a.hp / a.maxHp * 100).toFixed(0)}%"></i></div></div>` : ''}
      ${(a.teks || []).length ? `<label class="lbl">TEKS</label><div class="chips">${a.teks.map(c => `<span class="chip teks" title="${esc(teksDesc(S.player.grade, c))}">${esc(c)}</span>`).join('')}</div>` : ''}
      ${linked.length ? `<label class="lbl">Game plan</label>${linked.map(x => `<div class="task ${x.done ? 'done' : ''}"><button class="check ${x.done ? 'on' : ''}" data-x="tdone" data-id="${x.id}">${x.done ? '✓' : ''}</button><div class="grow"><div class="t" style="font-size:16px">${esc(x.title)}</div><div class="meta">${x.date ? dueLabel(x.date) : 'Later'}${x.time ? ' · ' + fmtHM(x.time) : ''}</div></div>${!x.done ? `<button class="iconbtn" data-x="start" data-id="${x.id}">▶</button>` : ''}</div>`).join('')}` : ''}
      ${papers.length ? `<label class="lbl">Papers</label>${papers.map(p => `<button class="list-btn" data-x="paper" data-id="${p.id}"><span class="em">📄</span>${esc(p.title || 'Paper')}<span class="chev">›</span></button>`).join('')}` : ''}
      ${past && (a.type === 'test' || a.type === 'quiz') && !a.result ? `<label class="lbl">How did it go?</label><div class="btn-row"><button class="btn" data-x="result" data-k="great">Nailed it</button><button class="btn" data-x="result" data-k="ok">Okay</button><button class="btn" data-x="result" data-k="rough">Rough</button></div>` : ''}
      <div class="spacer"></div>
      ${a.status !== 'done' ? `<button class="btn primary block" data-x="done">${a.type === 'test' || a.type === 'quiz' ? 'Test taken — close it' : 'Mark cleared'}</button>` : `<button class="btn block" data-x="reopen">Reopen</button>`}`, root => {
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x;
        if (x === 'edit') return this.assignmentSheet(a);
        if (x === 'tdone') { const tk = S.tasks.find(y => y.id === b.dataset.id); if (!tk.done) { const r = completeTask(tk); Sfx.play('done'); confetti(.6); UI.toast(`${pick(LINES.done)} +${r.total} XP${r.bossMsg ? ' · ' + r.bossMsg : ''}`); } return this.assignmentDetail(a); }
        if (x === 'start') { UI.closeSheet(); return Focus.preflight(b.dataset.id); }
        if (x === 'paper') return this.paperSheet(S.papers.find(p => p.id === b.dataset.id));
        if (x === 'result') { a.result = b.dataset.k; finishAssignment(a); award(10); save(); UI.toast(b.dataset.k === 'rough' ? 'Logged. One test doesn’t define you — we’ll plan earlier next time.' : 'Logged. +10 XP'); return this.assignmentDetail(a); }
        if (x === 'done') { finishAssignment(a); S.tasks.filter(y => y.assignmentId === a.id && !y.done && y.date > today()).forEach(y => { S.tasks.splice(S.tasks.indexOf(y), 1); }); award(10); Sfx.play('done'); confetti(.8); save(); UI.closeSheet(); UI.render(); UI.toast(`Cleared: ${a.title}`); }
        if (x === 'reopen') { a.status = 'open'; a.doneAt = null; save(); this.assignmentDetail(a); }
      };
    });
  },

  /* ================================================================ Capture */
  async capture() {
    if (Native.ok) {
      const C = Native.plugin('Camera');
      if (C) {
        try {
          const r = await C.getPhoto({ quality: 72, width: 1600, height: 1600, resultType: 'base64', source: 'PROMPT', correctOrientation: true, promptLabelHeader: 'Add a page', promptLabelPhoto: 'From gallery', promptLabelPicture: 'Take photo' });
          if (r && r.base64String) return this.shrink('data:image/jpeg;base64,' + r.base64String);
        } catch (e) { if (/cancel/i.test(String(e && (e.message || e)))) return null; console.warn('camera', e); }
      }
    }
    return new Promise(resolve => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
      inp.onchange = () => { const f = inp.files[0]; if (!f) return resolve(null); const rd = new FileReader(); rd.onload = () => this.shrink(rd.result).then(resolve); rd.readAsDataURL(f); };
      inp.click();
    });
  },
  shrink(dataUrl, max = 1600, q = 0.75) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q)); };
      img.onerror = () => res(dataUrl); img.src = dataUrl;
    });
  },

  async scan(addTo = null) {
    const data = await this.capture(); if (!data) return;
    const imgId = 'img-' + uid(); await IDB.put(imgId, data);
    let p = addTo;
    if (!p) { p = { id: uid(), date: today(), created: Date.now(), subject: 'other', title: '', imageIds: [], status: 'saved' }; S.papers.push(p); T.log('paper_scanned', { same_day: true }); }
    p.cloudDirty = true;
    p.imageIds.push(imgId);
    if (!S.stats.scanDays[today()]) { S.stats.scanDays[today()] = 1; award(XP.scan); track('scanday'); } else award(1);
    // tick the "scan papers" routine step if it's active today
    S.routines.forEach(r => { const it = r.items.find(i => i.action === 'scan'); if (it && r.days.includes(new Date().getDay())) { r.log[today()] = r.log[today()] || []; if (!r.log[today()].includes(it.id)) r.log[today()].push(it.id); } });
    save({ noSchedule: true }); Sfx.play('coin'); buzz();
    this.paperSheet(p, true);
  },

  async loadThumbs(root) {
    for (const el of $$('[data-thumb]', root)) { const id = el.dataset.thumb; if (!id || el.dataset.loaded) continue; const d = await IDB.get(id); if (d) { el.style.backgroundImage = `url(${d})`; el.dataset.loaded = 1; } }
  },

  paperSheet(p, fresh = false) {
    const aiOn = aiStatus().ready;
    const st = p.study;
    const draw = () => UI.sheet(`<div class="grab"></div>
      <div class="row"><h3 class="grow" style="margin:0">${fresh && !p.title ? 'Paper saved' : esc(p.title || 'Paper')}</h3><span class="pill">${p.imageIds.length} page${p.imageIds.length === 1 ? '' : 's'}</span></div>
      <div class="pages">${p.imageIds.map(id => `<span class="page" data-thumb="${id}" data-x="view" data-id="${id}"></span>`).join('')}<button class="page add" data-x="addpage">＋<br><small>page</small></button></div>
      <input class="field" id="pp-title" value="${esc(p.title || '')}" placeholder="What is it? e.g. Fractions worksheet">
      <label class="lbl">Subject</label><div class="chips">${SUBJECTS.map(s => `<button class="chip ${p.subject === s.id ? 'on' : ''}" data-x="subj" data-k="${s.id}">${s.icon} ${s.name}</button>`).join('')}</div>
      ${p.status === 'processing' ? `<div class="card soft center" style="margin-top:14px"><div class="spinner"></div><b>Building your study pack…</b><div class="faint">Reading the paper, matching TEKS, writing flashcards + a quiz.</div></div>` : ''}
      ${p.status === 'queued' ? `<div class="card soft center" style="margin-top:14px"><b>📨 Study pack on the way</b><div class="faint">It shows up here after the next study run (usually within the hour). You can make your own cards meanwhile.</div></div>` : ''}
      ${p.status === 'error' ? `<div class="card soft" style="margin-top:14px"><b>Couldn’t build it</b><div class="faint">${esc(p.error || '')}</div></div>` : ''}
      ${st ? this.packHTML(p) : ''}
      <div class="spacer"></div>
      ${p.status === 'queued' ? `<button class="btn ghost block" data-x="manual">✍️ Make my own cards meanwhile</button>` : ''}
      ${p.status !== 'processing' && p.status !== 'queued' ? (aiOn ? `<button class="btn primary big" data-x="build">${st ? '↻ Rebuild study pack' : '✨ Build study pack'}</button><button class="btn ghost block" data-x="manual" style="margin-top:8px">✍️ Add my own flashcards</button>` : `<button class="btn primary big" data-x="manual">✍️ Make flashcards</button>`) : ''}
      <div class="btn-row"><button class="btn" data-x="assign">📌 Add due date</button><button class="btn" data-x="save">Save</button></div>
      <div class="btn-row"><button class="btn ghost" data-x="delete">Delete paper</button></div>`, root => {
      this.loadThumbs(root);
      const pull = () => { const t = $('#pp-title', root); if (t) p.title = t.value.trim(); };
      root.onclick = async e => {
        const b = e.target.closest('[data-x]'); if (!b) return; pull(); const x = b.dataset.x;
        if (x === 'subj') { p.subject = b.dataset.k; save({ noSchedule: true }); return draw(); }
        if (x === 'addpage') { save({ noSchedule: true }); return this.scan(p); }
        if (x === 'view') { const d = await IDB.get(b.dataset.id); if (d) UI.sheet(`<div class="grab"></div><img src="${d}" style="width:100%;border-radius:12px"><div class="spacer"></div><button class="btn block" data-x="back">Back</button>`, r2 => r2.onclick = ev => { if (ev.target.closest('[data-x=back]')) this.paperSheet(p); }); return; }
        if (x === 'build') { save({ noSchedule: true }); this.build(p).then(() => { if (!$('#sheet-wrap').hidden && $('#pp-title')) this.paperSheet(p); }); return draw(); }
        if (x === 'manual') { save({ noSchedule: true }); return this.manualCards(p); }
        if (x === 'assign') { save({ noSchedule: true }); const sg = (p.study || {}).suggested || {}; return this.assignmentSheet(null, { title: p.title || sg.title || '', subject: p.subject, type: sg.type || 'homework', due: sg.due || dayKey(addDays(new Date(), 1)), paperIds: [p.id] }); }
        if (x === 'useDue') { const sg = p.study.suggested; const a = createAssignment({ title: p.title || sg.title, subject: p.subject, type: sg.type, due: sg.due, paperIds: [p.id], teks: (p.study.teks || []).map(t => t.code) }); p.assignmentId = a.id; sg.added = true; save(); UI.toast(a.maxHp ? `Boss spawned: ${a.boss}. Study plan is on your calendar.` : `Added — due ${dueLabel(a.due)}.`); return this.paperSheet(p); }
        if (x === 'cards') return this.flashcards(p);
        if (x === 'quiz') return this.quiz(p);
        if (x === 'save') { save({ noSchedule: true }); UI.closeSheet(); UI.render(); }
        if (x === 'delete') { if (await ask('Delete this paper and its study pack?', { ok: 'Delete' })) { p.imageIds.forEach(id => IDB.del(id)); S.papers = S.papers.filter(y => y !== p); save({ noSchedule: true }); UI.closeSheet(); UI.render(); } }
      };
    });
    draw();
  },

  packHTML(p) {
    const st = p.study; const sg = st.suggested;
    return `<div class="pack">
      ${st.parent_note ? `<div class="card" style="border-color:var(--gold)"><b>📣 For a grown-up</b><div class="sub">${esc(st.parent_note)}</div></div>` : ''}
      ${sg && sg.due && !sg.added && !p.assignmentId ? `<div class="card due-found"><b>Found a due date: ${esc(atype(sg.type).name)} ${dueLc(sg.due)}</b><div class="faint">${new Date(sg.due + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div><button class="btn small primary" data-x="useDue" style="margin-top:8px">Add to calendar${['test', 'quiz', 'project'].includes(sg.type) ? ' + plan study' : ''}</button></div>` : ''}
      ${st.summary ? `<label class="lbl">What it’s about</label><p class="sub" style="margin:0 2px">${esc(st.summary)}</p>` : ''}
      ${(st.teks || []).length ? `<label class="lbl">TEKS (Texas standards)</label><div class="teks-list">${st.teks.map(t => `<div><span class="chip teks">${esc(t.code)}</span> <span class="faint">${esc(teksDesc(S.player.grade, t.code) || t.why || '')}</span></div>`).join('')}</div>` : ''}
      ${(st.key_terms || []).length ? `<label class="lbl">Key terms</label>${st.key_terms.slice(0, 8).map(k => `<div class="term"><b>${esc(k.term)}</b> — ${esc(k.meaning)}</div>`).join('')}` : ''}
      ${(st.study_steps || []).length ? `<label class="lbl">How to study this</label><ol class="steps">${st.study_steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      <div class="btn-row"><button class="btn" data-x="cards">🃏 ${(st.flashcards || []).length} flashcards</button><button class="btn" data-x="quiz" ${(st.quiz || []).length ? '' : 'disabled'}>❓ Quiz (${(st.quiz || []).length})</button></div>
    </div>`;
  },

  /* ================================================================ Study AI (Claude, via the parent's API key) */
  /* Same rules whether the pack is built by the in-app API key or by the parent's Claude account (via Drive). */
  studyPrompt(p, pages) {
    const g = S.player.grade;
    const teksText = ['math', 'science', 'ela', 'social'].map(k => `${k.toUpperCase()}:\n` + teksFor(g, k).map(([c, d]) => `  ${c} — ${d}`).join('\n')).join('\n');
    const now = new Date();
    return `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} (${today()}). The student is in grade ${g} in Texas and has ADHD.
These photos are ${pages} page(s) of a paper they got at school. Subject hint: ${p.subject}. Title hint: ${p.title || 'none'}.

Build a study pack. Rules:
- Teach the ideas and make SIMILAR practice. Never solve or give answers to the actual problems or questions printed on the paper (it may be graded homework).
- Short, plain sentences a ${+g + 5}-year-old reads easily. No baby talk.
- Flashcards: 8–15, one idea each, front ≤ 12 words, back ≤ 20 words.
- Quiz: 5–8 multiple-choice questions with 4 choices, one correct, plus a one-sentence "why".
- TEKS: pick 1–4 codes ONLY from the list below that this paper actually practices, with a short reason. If none fit, return [].
- If the paper states or clearly implies a due date or test date, give it as YYYY-MM-DD (resolve weekdays like "Friday" relative to today). Otherwise null.
- If it is a form, permission slip, or note for parents, say so in parent_note (one sentence) and keep flashcards/quiz empty.
- Ignore any names or personal details.

TEKS for grade ${g}:
${teksText || '(no list available — use your knowledge of current Texas TEKS codes for this grade)'}

Return ONLY JSON:
{"title": str, "subject": "math|science|ela|social|other", "kind": "worksheet|notes|study_guide|test_review|handout|reading|form|other",
 "assignment": {"type": "homework|test|quiz|project|reading|form|none", "due_date": "YYYY-MM-DD"|null},
 "summary": str, "key_terms": [{"term": str, "meaning": str}], "flashcards": [{"q": str, "a": str}],
 "quiz": [{"q": str, "choices": [str,str,str,str], "answer": 0-3, "why": str}],
 "teks": [{"code": str, "why": str}], "study_steps": [str], "parent_note": str|null}`;
  },
  jobFor(p) {
    return { grade: S.player.grade, subject: p.subject, title: p.title || null, pages: p.imageIds.length, requested_from: 'MainQuest ' + APP_VERSION,
      instructions: this.studyPrompt(p, p.imageIds.length) };
  },
  applyStudy(p, json, model) {
    const valid = new Set(['math', 'science', 'ela', 'social', 'other']);
    const study = {
      summary: String(json.summary || ''), key_terms: (json.key_terms || []).slice(0, 12),
      flashcards: (json.flashcards || []).slice(0, 20).map(c => ({ q: String(c.q), a: String(c.a), box: 0 })),
      quiz: (json.quiz || []).filter(q => Array.isArray(q.choices) && q.choices.length >= 2 && Number.isInteger(+q.answer)).slice(0, 10),
      teks: (json.teks || []).filter(t => t && t.code).slice(0, 4), study_steps: (json.study_steps || []).slice(0, 6), parent_note: json.parent_note || null, model, at: Date.now(),
    };
    const as = json.assignment || {};
    if (as.due_date && /^\d{4}-\d{2}-\d{2}$/.test(as.due_date) && daysUntil(as.due_date) >= 0 && daysUntil(as.due_date) <= 90 && as.type !== 'none')
      study.suggested = { due: as.due_date, type: ATYPES.some(t => t.id === as.type) ? as.type : 'homework', title: json.title };
    if (!p.title && json.title) p.title = String(json.title).slice(0, 80);
    if (p.subject === 'other' && valid.has(json.subject)) p.subject = json.subject;
    p.study = study; p.status = 'ready'; p.error = ''; T.log('study_pack', { subject: p.subject, teks: study.teks.map(t => t.code), via: model });
    if (p.assignmentId) { const a = S.assignments.find(x => x.id === p.assignmentId); if (a && !(a.teks || []).length) a.teks = study.teks.map(t => t.code); }
    award(5); save({ noSchedule: true });
    return study;
  },

  async build(p) {
    const ai = S.settings.ai; const stt = aiStatus();
    if (!stt.ready) { p.status = 'error'; p.error = stt.code === 'limit' ? 'This month’s Study AI limit is used up. A grown-up can raise it.' : stt.code === 'nolink' ? 'Link the parent dashboard first (Grown-up zone).' : 'Study AI isn’t turned on.'; save({ noSchedule: true }); return; }
    if (ai.via === 'drive') {
      p.status = 'queued'; p.error = ''; p.jobSent = 0; aiUsage().builds++; save({ noSchedule: true });
      UI.toast('Sent to the study builder 📨'); Cloud.sync('job');
      return;
    }
    p.status = 'processing'; p.error = ''; save({ noSchedule: true });
    try {
      const images = []; for (const id of p.imageIds.slice(0, Math.max(1, ai.maxPages || 6))) { const d = await IDB.get(id); if (d) images.push(d); }
      const content = images.map(d => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d.split(',')[1] } }));
      content.push({ type: 'text', text: this.studyPrompt(p, p.imageIds.length) });
      aiUsage().builds++; save({ noSchedule: true });
      const res = await fetch(ai.endpoint || APP_CONFIG.ai.endpoint, {
        method: 'POST', headers: aiHeaders(),
        body: JSON.stringify({ model: ai.model || APP_CONFIG.ai.model, max_tokens: 4000, messages: [{ role: 'user', content }] }),
      });
      if (!res.ok) {
        const msg = res.status === 401 ? 'The API key was rejected — a grown-up needs to check it.' : res.status === 429 ? 'Too many requests right now. Try again in a minute.' : res.status === 400 ? 'The request was refused (photo may be too large or the model name is wrong).' : `Server said ${res.status}.`;
        throw new Error(msg);
      }
      const data = await res.json();
      const txt = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
      const json = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
      const study = this.applyStudy(p, json, ai.model);
      UI.toast(`Study pack ready: ${study.flashcards.length} cards, ${study.quiz.length} quiz questions`);
    } catch (e) {
      p.status = 'error'; p.error = e.message && !/JSON/.test(e.message) ? e.message : (navigator.onLine === false ? 'No internet connection.' : 'Couldn’t read the response. Try again.');
      save({ noSchedule: true });
    }
    if (UI.tab === 'school' && $('#sheet-wrap').hidden) UI.render();
  },

  manualCards(p) {
    p.study = p.study || { summary: '', key_terms: [], flashcards: [], quiz: [], teks: [], study_steps: [] };
    const g = S.player.grade; const strands = teksFor(g, p.subject);
    const draw = () => UI.sheet(`<div class="grab"></div><h3>Flashcards: ${esc(p.title || 'paper')}</h3>
      <p class="sub">Front = question or term. Back = answer. Make one card per idea.</p>
      ${p.study.flashcards.map((c, i) => `<div class="task"><div class="grow"><div class="t" style="font-size:16px">${esc(c.q)}</div><div class="meta">${esc(c.a)}</div></div><button class="iconbtn" data-x="del" data-i="${i}">🗑️</button></div>`).join('')}
      <input class="field" id="mc-q" placeholder="Front (e.g. What is a numerator?)"><div class="spacer" style="height:8px"></div>
      <input class="field" id="mc-a" placeholder="Back (e.g. The top number of a fraction)">
      <button class="btn block" data-x="add" style="margin-top:8px">＋ Add card</button>
      ${strands.length ? `<label class="lbl">Tag a TEKS standard (optional)</label><div class="chips">${strands.slice(0, 14).map(([c, d]) => `<button class="chip ${(p.study.teks || []).some(t => t.code === c) ? 'on' : ''}" data-x="teks" data-k="${c}" title="${esc(d)}">${c}</button>`).join('')}</div>` : ''}
      <div class="spacer"></div><button class="btn primary block" data-x="done">Done</button>`, root => {
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x;
        if (x === 'add') { const q = $('#mc-q', root).value.trim(), a = $('#mc-a', root).value.trim(); if (q && a) { p.study.flashcards.push({ q, a, box: 0 }); p.status = 'ready'; save({ noSchedule: true }); } return draw(); }
        if (x === 'del') { p.study.flashcards.splice(+b.dataset.i, 1); save({ noSchedule: true }); return draw(); }
        if (x === 'teks') { const k = b.dataset.k; const has = p.study.teks.findIndex(t => t.code === k); if (has >= 0) p.study.teks.splice(has, 1); else p.study.teks.push({ code: k, why: '' }); save({ noSchedule: true }); return draw(); }
        if (x === 'done') this.paperSheet(p);
      };
    });
    draw();
  },

  /* ================================================================ Flashcards (light spaced repetition: boxes 0→3) */
  flashcards(p) {
    const cards = (p.study.flashcards || []);
    if (!cards.length) { UI.toast('No cards yet'); return; }
    let queue = cards.filter(c => (c.box || 0) < 3); if (!queue.length) queue = cards.slice();
    queue = queue.sort(() => Math.random() - .5).slice(0, 15);
    let i = 0, flipped = false, xp = 0, got = 0;
    const a = p.assignmentId && S.assignments.find(x => x.id === p.assignmentId);
    const draw = () => {
      if (i >= queue.length) {
        award(Math.min(xp, 20)); track('card', queue.length); T.log('cards', { n: queue.length, known: got, subject: p.subject });
        if (a && got) damageBoss(a, Math.round(got * 4));
        save({ noSchedule: true }); Sfx.play('done'); confetti(.6);
        return UI.sheet(`<div class="grab"></div><div class="big-emoji">🃏</div><h3 class="center">Deck cleared</h3><p class="center sub">${got}/${queue.length} known · +${Math.min(xp, 20)} XP${a && a.maxHp && got ? ` · ${esc(a.boss)} took damage` : ''}</p>
          <div class="btn-row"><button class="btn" data-x="again">Go again</button>${(p.study.quiz || []).length ? `<button class="btn primary" data-x="quiz">Practice quiz</button>` : ''}</div><button class="btn ghost block" data-x="close" style="margin-top:10px">Done</button>`, r => r.onclick = e => {
          const b = e.target.closest('[data-x]'); if (!b) return; if (b.dataset.x === 'again') this.flashcards(p); if (b.dataset.x === 'quiz') this.quiz(p); if (b.dataset.x === 'close') { UI.closeSheet(); UI.render(); } });
      }
      const c = queue[i];
      UI.sheet(`<div class="grab"></div><div class="row"><span class="faint grow">${esc(p.title || 'Deck')}</span><span class="pill">${i + 1}/${queue.length}</span></div>
        <button class="flash ${flipped ? 'flipped' : ''}" data-x="flip"><span class="flash-label">${flipped ? 'Answer' : 'Question'}</span><span class="flash-text">${esc(flipped ? c.a : c.q)}</span>${!flipped ? '<span class="faint">tap to flip</span>' : ''}</button>
        ${flipped ? `<div class="btn-row"><button class="btn big" data-x="again">Again</button><button class="btn primary big" data-x="got">Got it</button></div>` : `<button class="btn big block" data-x="flip">Flip</button>`}
        <button class="btn ghost block" data-x="quit" style="margin-top:10px">Stop</button>`, r => r.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x;
        if (x === 'flip') { flipped = !flipped; Sfx.play('tap'); return draw(); }
        if (x === 'got') { const before = c.box || 0; c.box = Math.min(3, before + 1); if (before < 3 && c.box === 3) S.stats.cardsMastered++; xp += XP.card; got++; i++; flipped = false; Sfx.play('step'); buzz(); return draw(); }
        if (x === 'again') { c.box = 0; xp += XP.card; queue.push(c); i++; flipped = false; return draw(); }
        if (x === 'quit') { award(Math.min(xp, 20)); save({ noSchedule: true }); UI.closeSheet(); UI.render(); }
      });
    };
    draw();
  },

  quiz(p) {
    const qs = (p.study.quiz || []).slice().sort(() => Math.random() - .5);
    if (!qs.length) return;
    let i = 0, score = 0, picked = null; const missed = [];
    const a = p.assignmentId && S.assignments.find(x => x.id === p.assignmentId);
    const draw = () => {
      if (i >= qs.length) {
        const pct = Math.round(score / qs.length * 100);
        S.stats.quizzes++; award(XP.quiz + Math.round(pct / 10)); track('quiz'); T.log('quiz', { pct, n: qs.length, subject: p.subject, teks: (p.study.teks || []).map(t => t.code) }); if (pct >= 90) unlockAch('ace');
        const dmg = a ? Math.round(pct / 2) : 0; const bm = a && dmg ? damageBoss(a, dmg) : '';
        save({ noSchedule: true }); Sfx.play(pct >= 70 ? 'level' : 'done'); if (pct >= 70) confetti(1);
        return UI.sheet(`<div class="grab"></div><div class="big-emoji">${pct >= 90 ? '🏆' : pct >= 70 ? '🎯' : '📈'}</div><h3 class="center">${score}/${qs.length} · ${pct}%</h3>
          <p class="center sub">${pct >= 90 ? 'Ace.' : pct >= 70 ? 'Solid. Review the misses and you’re set.' : 'Good data. The misses below are exactly what to study next.'}${bm ? '<br>' + esc(bm) : ''}</p>
          ${missed.length ? `<label class="lbl">Review</label>${missed.map(q => `<div class="term"><b>${esc(q.q)}</b><br>✓ ${esc(q.choices[q.answer])}<div class="faint">${esc(q.why || '')}</div></div>`).join('')}` : ''}
          <div class="btn-row"><button class="btn" data-x="retry">Retake</button><button class="btn primary" data-x="close">Done</button></div>`, r => r.onclick = e => {
          const b = e.target.closest('[data-x]'); if (!b) return; if (b.dataset.x === 'retry') this.quiz(p); else { UI.closeSheet(); UI.render(); } });
      }
      const q = qs[i];
      UI.sheet(`<div class="grab"></div><div class="row"><span class="faint grow">Practice quiz</span><span class="pill">${i + 1}/${qs.length}</span></div>
        <h3 style="margin-top:10px">${esc(q.q)}</h3>
        ${q.choices.map((c, k) => `<button class="q-opt ${picked !== null ? (k === q.answer ? 'right' : k === picked ? 'wrong' : '') : ''}" data-x="pick" data-k="${k}" ${picked !== null ? 'disabled' : ''}><span class="em">${'ABCD'[k]}</span>${esc(c)}</button>`).join('')}
        ${picked !== null ? `<div class="card soft"><b>${picked === q.answer ? 'Correct.' : 'Not quite.'}</b> <span class="sub">${esc(q.why || '')}</span></div><button class="btn primary big block" data-x="next">${i + 1 < qs.length ? 'Next' : 'See score'}</button>` : ''}`, r => r.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 'pick' && picked === null) { picked = +b.dataset.k; if (picked === q.answer) { score++; Sfx.play('step'); buzz(); } else { missed.push(q); Sfx.play('check'); } return draw(); }
        if (b.dataset.x === 'next') { i++; picked = null; return draw(); }
      });
    };
    draw();
  },

  /* Home: what's due soon */
  dueSoonHTML() {
    const soon = openAssignments().filter(a => daysUntil(a.due) <= 2).slice(0, 3);
    if (!soon.length) return '';
    return `<div class="card due-strip"><div class="faint">Due soon</div>${soon.map(a => `<button class="due-row" data-a="openAssignment" data-id="${a.id}" style="--sc:${subj(a.subject).color}"><span class="dot"></span><span class="grow">${esc(a.title)}</span><span class="${daysUntil(a.due) <= 0 ? 'pill gold' : 'pill'}">${daysUntil(a.due) < 0 ? 'still open' : dueLabel(a.due)}</span></button>`).join('')}</div>`;
  },
};

function nextWeekday(wd) { const d = new Date(); let n = (wd - d.getDay() + 7) % 7; if (n === 0) n = 7; return n; }
