'use strict';
/* Calendar: month view of school due dates, study sessions, personal events and to-dos. */

const Cal = {
  month: null,   // first day of shown month
  sel: null,     // selected day key

  view() {
    if (!this.month) { const d = new Date(); this.month = new Date(d.getFullYear(), d.getMonth(), 1); }
    if (!this.sel) this.sel = today();
    const m = this.month; const y = m.getFullYear(), mo = m.getMonth();
    const first = new Date(y, mo, 1); const startOff = first.getDay();
    const days = new Date(y, mo + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(y, mo, 1 - startOff + i);
      if (i >= 35 && d.getMonth() !== mo) break;
      cells.push(d);
    }
    const dk0 = today();
    const cell = d => {
      const dk = dayKey(d); const it = itemsOn(dk);
      const dots = [];
      it.due.forEach(a => dots.push(`<i class="${['test', 'quiz', 'project'].includes(a.type) ? 'sq' : ''}" style="background:${subj(a.subject).color}"></i>`));
      it.tasks.filter(t => !t.done).forEach(t => dots.push(`<i class="sm" style="background:${t.kind === 'study' ? 'var(--accent)' : 'var(--muted)'}"></i>`));
      it.events.forEach(e => dots.push(`<i style="background:${(EVENT_CATS.find(c => c.id === e.cat) || EVENT_CATS[0]).color}"></i>`));
      it.google.forEach(g => dots.push(`<i class="${g.selfStatus === 'invited' ? 'ring' : ''}" style="background:${g.color}"></i>`));
      const cls = ['cal-cell', d.getMonth() !== mo ? 'out' : '', dk === dk0 ? 'today' : '', dk === this.sel ? 'sel' : '', S.stats.days[dk] ? 'good' : ''].join(' ');
      return `<button class="${cls}" data-a="calDay" data-k="${dk}"><span class="n">${d.getDate()}</span><span class="dots">${dots.slice(0, 4).join('')}${dots.length > 4 ? '<b>+</b>' : ''}</span></button>`;
    };
    return `<div class="cal-head">
        <button class="iconbtn" data-a="calNav" data-k="-1" aria-label="Previous month">‹</button>
        <h1 style="margin:0">${m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h1>
        <button class="iconbtn" data-a="calNav" data-k="1" aria-label="Next month">›</button></div>
      <div class="row" style="justify-content:space-between;margin:4px 2px 8px"><div class="legend"><span><i style="background:var(--accent)"></i>Study</span><span><i class="sq" style="background:#ffb84d"></i>Test/project</span><span><i style="background:#c99bff"></i>Event</span></div>
        ${this.sel !== dk0 || m.getMonth() !== new Date().getMonth() ? `<button class="btn small ghost" data-a="calToday">Today</button>` : ''}</div>
      <div class="cal-grid">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(w => `<span class="wd">${w}</span>`).join('')}${cells.map(cell).join('')}</div>
      ${this.dayPanel(this.sel)}`;
  },

  dayPanel(dk) {
    const it = itemsOn(dk); const d = new Date(dk + 'T12:00');
    const isPast = dk < today();
    const rows = [];
    it.events.forEach(e => rows.push(`<button class="arow" data-a="editEvent" data-id="${e.id}" style="--sc:${(EVENT_CATS.find(c => c.id === e.cat) || EVENT_CATS[0]).color}">
      <span class="arow-ic">${esc(e.emoji || '📅')}</span><span class="grow"><span class="arow-t">${esc(e.title)}</span><span class="arow-m">${e.time ? fmtHM(e.time) : 'All day'}${e.where ? ' · ' + esc(e.where) : ''}</span></span></button>`));
    it.google.forEach(g => rows.push(`<button class="arow" data-a="gevent" data-k="${esc(g.key)}" style="--sc:${g.color}">
      <span class="arow-ic">📅</span><span class="grow"><span class="arow-t">${esc(g.title)}${g.selfStatus === 'invited' && !g.isOrganizer ? ' <span class="pill gold">Invite</span>' : ''}</span><span class="arow-m">${g.time ? fmtHM(g.time) + '–' + fmtHM(g.endTime) : 'All day'}${g.location ? ' · ' + esc(g.location) : ''} · ${esc(g.calName || 'Google')}</span></span></button>`));
    it.due.forEach(a => rows.push(`<button class="arow ${a.status === 'done' ? 'done' : ''}" data-a="openAssignment" data-id="${a.id}" style="--sc:${subj(a.subject).color}">
      <span class="arow-ic">${atype(a.type).icon}</span><span class="grow"><span class="arow-t">${a.type === 'test' || a.type === 'quiz' ? atype(a.type).name + ': ' : 'Due: '}${esc(a.title)}</span><span class="arow-m">${esc(subj(a.subject).name)}${a.status === 'done' ? ' · cleared' : ''}</span>
      ${a.maxHp && !a.defeated ? `<span class="hp"><i style="width:${(a.hp / a.maxHp * 100).toFixed(0)}%"></i></span>` : ''}</span></button>`));
    it.tasks.forEach(t => rows.push(`<div class="task ${t.done ? 'done' : ''}"><button class="check ${t.done ? 'on' : ''}" data-a="${t.done ? 'undo' : 'quickDone'}" data-id="${t.id}">${t.done ? '✓' : ''}</button>
      <div class="grow" data-a="openTask" data-id="${t.id}"><div class="t" style="font-size:16px">${esc(t.emoji)} ${esc(t.title)}</div><div class="meta">${t.time ? fmtHM(t.time) : 'Anytime'}${t.kind === 'study' ? ' · study' : ''}</div></div>
      ${!t.done && !isPast ? `<button class="iconbtn" data-a="start" data-id="${t.id}" aria-label="Start">▶</button>` : ''}</div>`));
    return `<div class="day-panel">
      <div class="row" style="justify-content:space-between"><h2 style="margin:6px 2px">${dk === today() ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2><span class="faint">${rows.length ? rows.length + ' item' + (rows.length > 1 ? 's' : '') : ''}</span></div>
      ${rows.length ? rows.join('') : `<div class="card soft center sub">${isPast ? 'Nothing logged.' : 'Open day.'}</div>`}
      ${!isPast ? `<div class="add-grid">
        <button class="btn small" data-a="calAdd" data-k="assignment">📌 Due</button>
        <button class="btn small" data-a="calAdd" data-k="study">📚 Study</button>
        <button class="btn small" data-a="calAdd" data-k="event">📅 Event</button>
        <button class="btn small" data-a="calAdd" data-k="todo">✅ To-do</button></div>` : ''}</div>`;
  },

  add(kind, dk) {
    if (kind === 'assignment') return School.assignmentSheet(null, { due: dk });
    if (kind === 'event') return this.eventSheet(null, dk);
    if (kind === 'study') return this.studySheet(dk);
    if (kind === 'todo') return this.todoSheet(dk);
  },

  eventSheet(e, dk) {
    const isNew = !e;
    const f = e ? { ...e, attendees: [...(e.attendees || [])] } : { title: '', cat: 'personal', date: dk || today(), time: '', endTime: '', where: '', emoji: '', attendees: [] };
    const g = S.settings.gcal; const canInv = typeof GSync !== 'undefined' && GSync.canInvite();
    const draw = () => UI.sheet(`<div class="grab"></div><h3>${isNew ? 'New event' : 'Edit event'}</h3>
      <input class="field" id="ev-title" value="${esc(f.title)}" placeholder="e.g. Soccer practice, dentist, field trip" autocomplete="off">
      <label class="lbl">Type</label><div class="chips">${EVENT_CATS.map(c => `<button class="chip ${f.cat === c.id ? 'on' : ''}" data-x="cat" data-k="${c.id}"><i class="swatch" style="background:${c.color}"></i>${c.name}</button>`).join('')}</div>
      <div class="grid2" style="margin-top:12px"><div><div class="faint">Date</div><input class="field" type="date" id="ev-date" value="${f.date}"></div><div><div class="faint">Start (optional)</div><input class="field" type="time" id="ev-time" value="${f.time || ''}"></div></div>
      <div class="grid2" style="margin-top:8px"><div></div><div><div class="faint">End (optional)</div><input class="field" type="time" id="ev-end" value="${f.endTime || ''}"></div></div>
      <label class="lbl">Where (optional)</label><input class="field" id="ev-where" value="${esc(f.where || '')}">
      ${canInv ? `<label class="lbl">Invite people <span class="faint">(sends a Google Calendar invite)</span></label>
        <div class="chips">${(g.invites === 'approved' ? g.contacts : g.contacts.concat(f.attendees.filter(a => !g.contacts.some(c => c.email === a)).map(a => ({ name: a, email: a })))).map(c => `<button class="chip ${f.attendees.includes(c.email) ? 'on' : ''}" data-x="guest" data-k="${esc(c.email)}">${f.attendees.includes(c.email) ? '✓ ' : ''}${esc(c.name)}</button>`).join('') || (g.invites === 'approved' ? '<span class="faint">No approved contacts yet — a grown-up can add them.</span>' : '')}</div>
        ${g.invites === 'anyone' ? `<div class="row" style="margin-top:8px"><input class="field grow" id="ev-guest" type="email" placeholder="friend@example.com"><button class="btn small" data-x="addguest">Add</button></div>` : ''}
        ${(e && e.guestStatus || []).length ? `<div class="faint" style="margin-top:6px">${e.guestStatus.map(x => esc(x.email.split('@')[0]) + ': ' + ({ accepted: 'going', declined: 'not going', tentative: 'maybe', invited: 'no answer yet' }[x.status] || x.status)).join(' · ')}</div>` : ''}` : ''}
      <p class="faint">You’ll get a heads-up 30 minutes before (if it has a time).${g.on && g.writeId && g.pushEvents ? ' Syncs to Google Calendar.' : ''}</p>
      <button class="btn primary big block" data-x="save">${isNew ? 'Add event' : 'Save'}</button>
      ${!isNew ? `<div class="btn-row"><button class="btn ghost" data-x="delete">Delete</button></div>` : ''}`, root => {
      const pull = () => { f.title = $('#ev-title', root).value.trim(); f.date = $('#ev-date', root).value || f.date; f.time = $('#ev-time', root).value; f.endTime = f.time ? $('#ev-end', root).value : ''; f.where = $('#ev-where', root).value.trim(); };
      root.onclick = async ev => {
        const b = ev.target.closest('[data-x]'); if (!b) return; pull();
        if (b.dataset.x === 'cat') { f.cat = b.dataset.k; return draw(); }
        if (b.dataset.x === 'guest') { const k = b.dataset.k; f.attendees = f.attendees.includes(k) ? f.attendees.filter(x => x !== k) : [...f.attendees, k]; return draw(); }
        if (b.dataset.x === 'addguest') { const v = ($('#ev-guest', root).value || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return UI.toast('Enter a valid email'); if (!f.attendees.includes(v)) f.attendees.push(v); return draw(); }
        if (b.dataset.x === 'save') {
          if (!f.title) return UI.toast('Give it a name');
          f.emoji = autoEmoji(f.title) === '⭐' ? '📅' : autoEmoji(f.title);
          const invited = f.attendees.length && (!e || f.attendees.some(a => !(e.attendees || []).includes(a)));
          if (invited) T.log('invite_sent', { n: f.attendees.length });
          if (isNew) S.events.push({ id: uid(), ...f, gdirty: true }); else Object.assign(S.events.find(x => x.id === e.id), f, { gdirty: true });
          this.sel = f.date; save(); if (typeof GSync !== 'undefined') GSync.soon(); UI.closeSheet(); UI.render(); UI.toast(invited && GSync.canInvite() ? 'Saved — invites go out when Google syncs' : isNew ? 'Event added' : 'Saved');
        }
        if (b.dataset.x === 'delete' && await ask(e.attendees && e.attendees.length ? 'Delete this event? Guests will get a cancellation from Google.' : 'Delete this event?', { ok: 'Delete' })) { if (e.gcalId) { S.gdeletes.push(e.gcalId); GSync.soon(); } S.events = S.events.filter(x => x.id !== e.id); save(); UI.closeSheet(); UI.render(); }
      };
    });
    draw();
  },

  studySheet(dk) {
    const open = openAssignments();
    let link = (open.find(a => ['test', 'quiz', 'project'].includes(a.type)) || open[0] || {}).id || '';
    let mins = 20;
    const draw = () => UI.sheet(`<div class="grab"></div><h3>Study block · ${dk === today() ? 'today' : dueLabel(dk)}</h3>
      ${open.length ? `<label class="lbl">For</label>${open.map(a => `<button class="list-btn ${link === a.id ? 'on' : ''}" data-x="link" data-id="${a.id}"><span class="em">${atype(a.type).icon}</span>${esc(a.title)}<span class="faint" style="margin-left:auto">${dueLabel(a.due)}</span></button>`).join('')}
        <button class="list-btn ${!link ? 'on' : ''}" data-x="link" data-id=""><span class="em">📚</span>Something else</button>` : ''}
      ${!link ? `<input class="field" id="sb-title" placeholder="What are you studying?" style="margin-top:8px">` : ''}
      <label class="lbl">How long</label><div class="chips">${[10, 20, 30, 45].map(m => `<button class="chip ${mins === m ? 'on' : ''}" data-x="mins" data-k="${m}">${m} min</button>`).join('')}</div>
      <label class="lbl">Start time</label><input class="field" type="time" id="sb-time" value="${S.settings.anchors.afterschool}">
      <div class="spacer"></div><button class="btn primary big block" data-x="save">Add study block</button>`, root => {
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 'link') { link = b.dataset.id; return draw(); }
        if (b.dataset.x === 'mins') { mins = +b.dataset.k; return draw(); }
        if (b.dataset.x === 'save') {
          const a = link && S.assignments.find(x => x.id === link);
          const title = a ? `Study ${a.title}` : ($('#sb-title', root) || {}).value || 'Study block';
          const t = newTask(title, { date: dk, time: $('#sb-time', root).value || '', kind: 'study', est: mins, assignmentId: a ? a.id : undefined, emoji: a ? subj(a.subject).icon : '📚',
            steps: [{ id: uid(), text: 'Flashcards or notes for half the time', done: false }, { id: uid(), text: 'Quiz yourself on the rest', done: false }] });
          S.tasks.push(t);
          if (a && a.maxHp) { a.maxHp += 100; a.hp += 100; }
          this.sel = dk; save(); UI.closeSheet(); UI.render(); UI.toast('Study block added');
        }
      };
    });
    draw();
  },

  todoSheet(dk) {
    UI.sheet(`<div class="grab"></div><h3>To-do · ${dk === today() ? 'today' : dueLabel(dk)}</h3>
      <input class="field" id="td-title" placeholder="What needs doing?" autocomplete="off">
      <label class="lbl">Reminder time (optional)</label><input class="field" type="time" id="td-time">
      <div class="spacer"></div><button class="btn primary big block" data-x="save">Add</button>`, root => {
      setTimeout(() => $('#td-title', root).focus(), 50);
      root.onclick = e => {
        if (!e.target.closest('[data-x=save]')) return;
        const v = $('#td-title', root).value.trim(); if (!v) return UI.toast('Type something first');
        S.tasks.push(newTask(v, { date: dk, time: $('#td-time', root).value || '' }));
        this.sel = dk; save(); UI.closeSheet(); UI.render(); UI.toast('Added');
      };
    });
  },
};
