'use strict';
/* MainQuest UI: views, sheets, onboarding, parent zone. */

const UI = {
  tab: 'now',
  quizStep: 0,
  quizAns: {},

  go(tab) { this.tab = tab; this.render(); $('#view').scrollTop = 0; },

  render() {
    document.body.className = [
      (THEMES.find(t => t.id === S.profile.theme) || {}).cls || '',
      S.settings.light ? 'light' : '', S.settings.calm ? 'calm' : '', S.settings.bigtext ? 'bigtext' : '', S.settings.dyslexic ? 'dyslexic' : '',
    ].join(' ');
    if (!S.profile.onboarded) { $('#tabs').hidden = true; $('#orient').innerHTML = ''; this.onboarding(); return; }
    $('#tabs').hidden = false;
    $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === this.tab));
    $('#tab-buddy').textContent = buddyEmoji();
    this.orient();
    const v = $('#view');
    v.innerHTML = this['view_' + this.tab]();
    if (S.focus && $('#overlay').hidden) Focus.render();
  },

  /* ---------- Orientation bar: time, day, what's next + time until it */
  orient() {
    const now = new Date();
    const ev = upcomingEvents(now, 18)[0];
    let next = '';
    if (ev) {
      const mins = (ev.at - now) / 60e3;
      const frac = clamp(1 - mins / 180, 0.03, 1);  // bar fills over the last 3 hours
      next = `<div class="o-next"><span>Next: <b>${esc(ev.emoji)} ${esc(ev.title)}</b> in ${fmtDur(mins)}</span><div class="o-bar"><i style="width:${(frac * 100).toFixed(0)}%"></i></div></div>`;
    }
    $('#orient').innerHTML = `<div class="o-row"><span class="o-time">${fmtTime(now)}</span><span class="o-day">${now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>${next}`;
  },

  /* ================================================================ NOW */
  view_now() {
    const q = todayQueue();
    const r = routineActive();
    let main = '';
    if (S.focus) {
      const t = Focus.task();
      main = `<div class="now-card"><div class="now-label">In progress</div><div class="now-title"><span class="em">${esc(t ? t.emoji : '🎯')}</span><span>${esc(t ? t.title : '')}</span></div>
        <button class="btn primary big" data-a="resumeFocus">🎯 Jump back in</button></div>`;
    } else if (r) {
      const done = r.log[today()] || []; const item = r.items.find(i => !done.includes(i.id));
      main = `<div class="now-card"><div class="now-label">${esc(r.emoji)} ${esc(r.name)} · ${done.length}/${r.items.length}</div>
        <div class="now-title"><span class="em">${esc(item.emoji)}</span><span>${esc(item.text)}</span></div>
        <div class="bar" style="margin:8px 0 14px"><i style="width:${done.length / r.items.length * 100}%"></i></div>
        <button class="btn primary big" data-a="rtItem" data-r="${r.id}" data-i="${item.id}">✅ Done</button>
        <div class="btn-row"><button class="btn small" data-a="openRoutine" data-r="${r.id}">See all steps</button><button class="btn small ghost" data-a="skipRoutine" data-r="${r.id}">Not now</button></div></div>`;
    } else if (q.length) {
      const t = q[0];
      const firstStep = (t.steps || []).find(s => !s.done);
      const carry = carriedDays(t);
      main = `<div class="now-card ${t.size === 'boss' ? 'boss' : ''}">
        <div class="now-label">${t.size === 'boss' ? '👹 Boss mission' : 'Your mission'}${t.time ? ' · ' + fmtHM(t.time) : ''}</div>
        <div class="now-title"><span class="em">${esc(t.emoji)}</span><span>${esc(t.title)}</span></div>
        ${t.anchor ? `<div class="sub">${esc(anchorText(t.anchor))} → then this.</div>` : ''}
        <div class="now-step">${firstStep ? `First tiny step: <b>${esc(firstStep.text)}</b>` : `<button class="chip" data-a="chop" data-id="${t.id}">🔪 Chop into tiny steps</button>`}
          ${carry ? ` <span class="pill">Carried over</span>` : ''}</div>
        <button class="btn primary big" data-a="start" data-id="${t.id}">▶ Start</button>
        <div class="btn-row">
          <button class="btn small" data-a="quickDone" data-id="${t.id}">✅ Done</button>
          <button class="btn small" data-a="notNow" data-id="${t.id}">⏭ Not now</button>
          ${S.profile.style.start === 'spin' && q.length > 1 ? `<button class="btn small" data-a="spin">🎲 Spin</button>` : `<button class="btn small" data-a="stuckNow" data-id="${t.id}">😵 Stuck</button>`}
        </div></div>`;
    } else {
      main = `<div class="now-card now-empty"><div class="big">${buddyEmoji()}</div>
        <div class="now-title" style="justify-content:center">No missions right now</div>
        <p class="sub">${esc(pick(BUDDY_LINES.hello))}</p>
        <div class="quickadd"><input id="qa-now" placeholder="Add a mission…" enterkeyhint="done" autocomplete="off"><button class="iconbtn" data-a="qaNow">＋</button></div>
        <button class="btn ghost block" data-a="plan">🗺️ Plan my day</button></div>`;
    }
    const nextUp = !S.focus && q.length > (r ? 0 : 1) ? q[r ? 0 : 1] : null;
    const note = S.notes.find(n => !n.read);
    const tip = this.dailyTip();
    const insights = this.insights();
    const wk = goodDaysThisWeek(), goal = S.settings.weekGoal;
    const lvl = levelFor(S.stats.xp), [lo, hi] = levelBounds(lvl);
    return `
      ${main}
      ${nextUp ? `<div class="task" data-a="openTask" data-id="${nextUp.id}"><span class="em">${esc(nextUp.emoji)}</span><div class="grow"><div class="faint">Next up</div><div class="t">${esc(nextUp.title)}</div></div><span class="faint">${q.length - (r ? 0 : 1) > 1 ? `+${q.length - (r ? 1 : 2)} more` : ''}</span></div>` : ''}
      ${note ? `<div class="card" style="border:2px solid var(--accent2)"><div class="faint">💌 Message from ${esc(note.from || 'Dad')}</div><div style="font-size:19px;font-weight:700;margin:6px 0 10px">${esc(note.text)}</div><button class="btn small gold" data-a="readNote" data-id="${note.id}">❤️ Got it</button></div>` : ''}
      <div class="card buddy-card" data-a="tab" data-t="me">
        <div class="buddy-mini">${buddyEmoji()}</div>
        <div class="grow"><div class="row" style="justify-content:space-between"><b>${esc(S.profile.buddyName)} · Lvl ${lvl}</b><span class="pill gold">🪙 ${S.stats.coins}</span></div>
          <div class="bar" style="margin:6px 0"><i style="width:${((S.stats.xp - lo) / (hi - lo) * 100).toFixed(0)}%"></i></div>
          <div class="row" style="justify-content:space-between"><span class="faint">Good days this week</span><div class="dots">${Array.from({ length: Math.max(goal, wk) }, (_, i) => `<i class="${i < wk ? 'on' : ''}">${i < wk ? '★' : ''}</i>`).join('')}</div></div></div>
      </div>
      ${this.timeBudget(q)}
      ${insights.slice(0, 1).map(i => `<div class="card soft"><div class="faint">💡 Noticed something</div><div style="margin:6px 0 10px">${esc(i.text)}</div>${i.btn ? `<button class="btn small" data-a="insight" data-k="${i.id}">${esc(i.btn)}</button>` : ''}</div>`).join('')}
      ${tip ? `<div class="card tip"><div class="faint">🧭 Coach tip</div><b style="font-size:18px">${esc(tip.t)}</b><p class="sub" style="margin:6px 0 10px">${esc(tip.d)}</p>
        <div class="row">${tip.task ? `<button class="btn small" data-a="tipTask" data-k="${tip.id}">＋ Make it a mission</button>` : `<button class="btn small" data-a="tipLike" data-k="${tip.id}">👍 I’ll try it</button>`}<button class="btn small ghost" data-a="tipHide" data-k="${tip.id}">Not for me</button></div></div>` : ''}
      ${S.parking.length ? `<button class="list-btn" data-a="parking"><span class="em">🅿️</span>Parking Lot · ${S.parking.length} thought${S.parking.length > 1 ? 's' : ''}<span class="chev">›</span></button>` : ''}
    `;
  },

  timeBudget(q) {
    const now = new Date(); const bed = atTime(S.settings.bedtime);
    if (now.getHours() < 12 || now >= bed || inSchoolQuiet(now)) return '';
    const left = (bed - now) / 60e3;
    const sizeMin = { tiny: 5, small: 15, big: 30, boss: 45 };
    const missions = q.reduce((s, t) => s + (t.est || sizeMin[t.size] || 15), 0);
    const routines = S.routines.filter(r => r.days.includes(now.getDay()) && atTime(r.time) > now && (r.log[today()] || []).length < r.items.length).reduce((s, r) => s + r.items.length * 3, 0);
    const free = Math.max(0, left - missions - routines);
    const pct = x => (x / left * 100).toFixed(1);
    return `<div class="card"><div class="row" style="justify-content:space-between"><b>⏳ Time until bed: ${fmtDur(left)}</b></div>
      <div style="display:flex;height:16px;border-radius:99px;overflow:hidden;margin:10px 0 8px;background:var(--bg2)">
        <i style="width:${pct(missions)}%;background:var(--accent)"></i><i style="width:${pct(routines)}%;background:var(--soft)"></i><i style="width:${pct(free)}%;background:var(--accent2)"></i></div>
      <div class="row wrap faint" style="gap:14px"><span>🟩 Missions ~${fmtDur(missions)}</span><span>🟦 Routines ~${fmtDur(routines)}</span><span>🟨 Free time ~${fmtDur(free)}</span></div></div>`;
  },

  /* ================================================================ MISSIONS */
  view_missions() {
    const q = todayQueue();
    const later = S.tasks.filter(t => !t.done && (t.when === 'later' || (t.date && t.date > today())));
    const done = S.tasks.filter(t => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === today());
    const speech = ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    const row = (t, i) => {
      const carry = carriedDays(t);
      const meta = [t.time && `⏰ ${fmtHM(t.time)}`, t.anchor && anchorText(t.anchor), (t.steps || []).length && `${t.steps.filter(s => s.done).length}/${t.steps.length} steps`,
        carry && 'Carried over', t.date && t.date > today() && (t.date === dayKey(addDays(new Date(), 1)) ? 'Tomorrow' : new Date(t.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))].filter(Boolean).join(' · ');
      return `<div class="task ${carry ? 'carry' : ''} ${t.done ? 'done' : ''} ${t.size === 'boss' ? 'boss' : ''}">
        <button class="check ${t.done ? 'on' : ''}" data-a="${t.done ? 'undo' : 'quickDone'}" data-id="${t.id}" aria-label="Done">${t.done ? '✓' : ''}</button>
        <div class="grow" data-a="openTask" data-id="${t.id}"><div class="t">${i !== undefined && i < 3 ? `<span class="pill">${i + 1}</span> ` : ''}${esc(t.emoji)} ${esc(t.title)}</div>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</div>
        ${!t.done && i !== undefined ? `<button class="iconbtn" data-a="start" data-id="${t.id}" aria-label="Start">▶</button>` : ''}</div>`;
    };
    return `
      <h1>Missions</h1>
      <div class="quickadd"><input id="qa" placeholder="What do you need to do?" enterkeyhint="done" autocomplete="off">
        ${speech ? `<button class="iconbtn" data-a="mic" aria-label="Say it">🎤</button>` : ''}<button class="iconbtn" data-a="qa" aria-label="Add">＋</button></div>
      <p class="faint" style="margin:-4px 4px 10px">Tip: type “math at 4pm” or “science project tomorrow”.</p>
      <div class="row"><h2 class="grow" style="margin:12px 4px 10px">Today ${q.length ? `· ${q.length}` : ''}</h2><button class="btn small" data-a="plan">🗺️ Plan</button></div>
      ${q.length ? q.map((t, i) => row(t, i)).join('') : `<div class="card soft center sub">Nothing for today yet. Add one above 👆</div>`}
      ${q.length > 3 ? `<p class="faint center">Top 3 are numbered. Three done beats ten started.</p>` : ''}
      ${later.length ? `<details class="fold"><summary>Later · ${later.length}</summary>${later.map(t => row(t)).join('')}</details>` : ''}
      ${done.length ? `<details class="fold"><summary>Done today · ${done.length} 🎉</summary>${done.map(t => row(t)).join('')}</details>` : ''}
    `;
  },

  /* ================================================================ ROUTINES */
  view_routines() {
    const wd = new Date().getDay();
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return `<h1>Routines</h1><p class="sub" style="margin:-4px 4px 12px">Same steps, same order, every time — so your brain doesn’t have to remember.</p>
      ${S.routines.map(r => {
        const done = (r.log[today()] || []).length; const todayOn = r.days.includes(wd);
        return `<div class="card" data-a="openRoutine" data-r="${r.id}"><div class="row"><span style="font-size:34px">${esc(r.emoji)}</span>
          <div class="grow"><b style="font-size:19px">${esc(r.name)}</b><div class="faint">${fmtHM(r.time)} · ${r.days.length === 7 ? 'Every day' : r.days.map(d => dayNames[d]).join(' ')}${r.remind ? ' · 🔔' : ''}</div></div>
          ${todayOn ? `<span class="pill ${done >= r.items.length ? 'gold' : ''}">${done >= r.items.length ? '✓ done' : `${done}/${r.items.length}`}</span>` : `<span class="faint">not today</span>`}</div>
          ${todayOn ? `<div class="bar" style="margin-top:10px"><i style="width:${done / r.items.length * 100}%"></i></div>` : ''}</div>`;
      }).join('')}
      <button class="btn ghost block" data-a="newRoutine">＋ New routine</button>`;
  },

  openRoutine(id) {
    const r = S.routines.find(x => x.id === id); if (!r) return;
    const dk = today(); const done = r.log[dk] || [];
    const allDone = done.length >= r.items.length;
    this.sheet(`<div class="grab"></div>
      <div class="row"><h3 class="grow">${esc(r.emoji)} ${esc(r.name)}</h3><button class="btn small" data-x="edit">✏️ Edit</button></div>
      <div class="bar" style="margin-bottom:10px"><i style="width:${done.length / r.items.length * 100}%"></i></div>
      ${r.items.map(i => `<div class="rt-item ${done.includes(i.id) ? 'done' : ''}" data-x="toggle" data-i="${i.id}"><button class="check ${done.includes(i.id) ? 'on' : ''}">${done.includes(i.id) ? '✓' : ''}</button><span class="em">${esc(i.emoji)}</span><span class="tx grow">${esc(i.text)}</span></div>`).join('')}
      ${allDone ? `<div class="card center" style="margin-top:12px"><div style="font-size:40px">🏆</div><b>Routine complete!</b></div>` : ''}
      <div class="spacer"></div><button class="btn primary block" data-x="close">${allDone ? 'Nice! Close' : 'Close'}</button>`, root => {
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 'toggle') { this.toggleRoutineItem(r, b.dataset.i); this.openRoutine(id); }
        if (b.dataset.x === 'edit') this.editRoutine(id);
        if (b.dataset.x === 'close') { this.closeSheet(); this.render(); }
      };
    });
  },

  toggleRoutineItem(r, itemId) {
    const dk = today(); r.log[dk] = r.log[dk] || [];
    const arr = r.log[dk];
    if (arr.includes(itemId)) { arr.splice(arr.indexOf(itemId), 1); save(); return; }
    arr.push(itemId); award(XP.routineItem); markGoodDay(); Sfx.play('step'); buzz();
    if (arr.length >= r.items.length) { award(XP.routineAll); Sfx.play('done'); confetti(0.7); buzz('success'); this.toast(`${r.emoji} ${r.name} complete! +${XP.routineAll + XP.routineItem} XP`); }
    // keep logs for 30 days
    const cutoff = dayKey(addDays(new Date(), -30)); Object.keys(r.log).forEach(k => { if (k < cutoff) delete r.log[k]; });
    save();
  },

  editRoutine(id) {
    const isNew = !id;
    const r = isNew ? { id: 'r-' + uid(), name: '', emoji: '⭐', time: '16:00', days: [1, 2, 3, 4, 5], remind: true, items: [], log: {} } : JSON.parse(JSON.stringify(S.routines.find(x => x.id === id)));
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const draw = () => this.sheet(`<div class="grab"></div><h3>${isNew ? 'New routine' : 'Edit routine'}</h3>
      <div class="row"><input class="field" id="re-emoji" value="${esc(r.emoji)}" style="width:70px;text-align:center;font-size:24px"><input class="field grow" id="re-name" value="${esc(r.name)}" placeholder="Routine name"></div>
      <label class="lbl">Time</label><input class="field" type="time" id="re-time" value="${r.time}">
      <label class="lbl">Days</label><div class="chips">${dayNames.map((d, i) => `<button class="chip ${r.days.includes(i) ? 'on' : ''}" data-x="day" data-d="${i}">${d}</button>`).join('')}</div>
      <div class="row" style="margin-top:14px"><span class="grow"><b>🔔 Remind me</b></span><button class="switch ${r.remind ? 'on' : ''}" data-x="remind" aria-label="Remind"></button></div>
      <label class="lbl">Steps (in order)</label>
      ${r.items.map((it, i) => `<div class="row" style="margin-bottom:8px"><input class="field" data-ie="${i}" value="${esc(it.emoji)}" style="width:64px;text-align:center"><input class="field grow" data-it="${i}" value="${esc(it.text)}">
        <button class="iconbtn" data-x="up" data-i="${i}">↑</button><button class="iconbtn" data-x="del" data-i="${i}">🗑️</button></div>`).join('')}
      <div class="row"><input class="field grow" id="re-new" placeholder="Add a step…"><button class="iconbtn" data-x="add">＋</button></div>
      <div class="spacer"></div>
      <button class="btn primary block" data-x="save">Save</button>
      ${!isNew ? `<div class="btn-row"><button class="btn ghost" data-x="delete">Delete routine</button></div>` : ''}`, root => {
      const pull = () => {
        r.emoji = $('#re-emoji', root).value || '⭐'; r.name = $('#re-name', root).value; r.time = $('#re-time', root).value || r.time;
        $$('[data-it]', root).forEach(inp => { r.items[+inp.dataset.it].text = inp.value; });
        $$('[data-ie]', root).forEach(inp => { r.items[+inp.dataset.ie].emoji = inp.value || '•'; });
      };
      root.onclick = async e => {
        const b = e.target.closest('[data-x]'); if (!b) return; pull();
        const x = b.dataset.x;
        if (x === 'day') { const d = +b.dataset.d; r.days = r.days.includes(d) ? r.days.filter(v => v !== d) : [...r.days, d].sort(); draw(); }
        if (x === 'remind') { r.remind = !r.remind; draw(); }
        if (x === 'add') { const v = $('#re-new', root).value.trim(); if (v) { r.items.push({ id: r.id + '-' + uid(), emoji: autoEmoji(v), text: v }); draw(); } }
        if (x === 'del') { r.items.splice(+b.dataset.i, 1); draw(); }
        if (x === 'up') { const i = +b.dataset.i; if (i > 0) { [r.items[i - 1], r.items[i]] = [r.items[i], r.items[i - 1]]; draw(); } }
        if (x === 'save') {
          if (!r.name.trim() || !r.items.length) { this.toast('Give it a name and at least one step'); return; }
          const idx = S.routines.findIndex(v => v.id === r.id);
          if (idx >= 0) S.routines[idx] = r; else S.routines.push(r);
          save(); this.closeSheet(); this.render(); this.toast('Routine saved');
        }
        if (x === 'delete') { if (await ask('Delete this routine?', { ok: 'Delete' })) { S.routines = S.routines.filter(v => v.id !== r.id); save(); this.closeSheet(); this.render(); } }
      };
    });
    draw();
  },

  /* ================================================================ ME */
  view_me() {
    const lvl = levelFor(S.stats.xp), [lo, hi] = levelBounds(lvl);
    const stage = buddyStage(lvl); const nextStageLvl = STAGE_LEVELS[stage + 1];
    const st = S.profile.style;
    const ins = this.statsSummary();
    const pending = S.redemptions.filter(r => r.status === 'pending');
    return `
      <div class="card center" style="padding-top:20px">
        <div class="buddy">${buddyEmoji()}</div>
        <div style="font-size:22px;font-weight:800;margin-top:8px">${esc(S.profile.buddyName)}</div>
        <div class="faint">${STAGE_NAMES[stage]} ${esc((BUDDIES[S.profile.buddy] || BUDDIES.dragon).name)} · Level ${lvl}${nextStageLvl ? ` · evolves at level ${nextStageLvl}` : ' · fully evolved!'}</div>
        <div class="bar" style="margin:12px 0 4px"><i style="width:${((S.stats.xp - lo) / (hi - lo) * 100).toFixed(0)}%"></i></div>
        <div class="faint">${S.stats.xp - lo} / ${hi - lo} XP to level ${lvl + 1}</div>
      </div>
      <div class="grid3">
        <div class="card stat"><b>${S.stats.missions}</b><span class="faint">missions</span></div>
        <div class="card stat"><b>${totalGoodDays()}</b><span class="faint">good days</span></div>
        <div class="card stat"><b>${fmtDur(S.stats.focusMin)}</b><span class="faint">focused</span></div>
      </div>

      <h2>🎁 Reward shop <span class="pill gold">🪙 ${S.stats.coins}</span></h2>
      ${S.rewards.map(r => `<div class="task"><span class="em">${esc(r.emoji)}</span><div class="grow"><div class="t">${esc(r.name)}</div><div class="meta">🪙 ${r.cost}</div></div>
        <button class="btn small ${S.stats.coins >= r.cost ? 'gold' : ''}" data-a="redeem" data-id="${r.id}" ${S.stats.coins >= r.cost ? '' : 'disabled'}>${S.stats.coins >= r.cost ? 'Get it' : `${r.cost - S.stats.coins} to go`}</button></div>`).join('')}
      ${pending.length ? `<p class="faint">⏳ Waiting for a grown-up: ${pending.map(p => esc(p.name)).join(', ')}</p>` : ''}
      <button class="btn ghost block" data-a="wish">💭 Wish for a new reward</button>

      <h2>🧩 Sticker collection · ${S.stickers.length}/${STICKERS.length}</h2>
      <div class="card"><div class="stickers">${STICKERS.map(s => S.stickers.includes(s) ? `<span>${s}</span>` : `<span class="locked">?</span>`).join('')}</div>
        <p class="faint" style="margin:10px 0 0">Stickers come from surprise chests 🎁 when you finish missions.</p></div>

      <h2>🎨 Themes</h2>
      <div class="chips">${THEMES.map(t => S.unlockedThemes.includes(t.id) ? `<button class="chip ${S.profile.theme === t.id ? 'on' : ''}" data-a="theme" data-id="${t.id}">${esc(t.name)}</button>` : `<span class="chip" style="opacity:.5">🔒 ${esc(t.name)} · Lvl ${t.level}</span>`).join('')}</div>

      <h2>🧠 My style</h2>
      <div class="card">
        <div class="row wrap" style="gap:8px">
          <span class="pill">${{ morning: '🌅 Morning brain', afterschool: '🏫 After-school brain', evening: '🌙 Evening brain', unsure: '🤷 Still figuring out my best time' }[st.peak]}</span>
          <span class="pill">⏱️ ${st.sprint}-min sprints</span>
          <span class="pill">${{ easy: '🍰 Warm-up first', hard: '🐸 Hardest first', spin: '🎲 Spin to pick' }[st.start]}</span>
          ${(st.helpers || []).map(h => `<span class="pill">${{ music: '🎧 Music', quiet: '🤫 Quiet', someone: '🧍 Company', move: '🤸 Move first', fidget: '🧸 Fidget' }[h]}</span>`).join('')}
          <span class="pill">${{ hype: '📣 Hype', chill: '😎 Chill', coach: '🏈 Coach', funny: '🤪 Funny' }[st.voice]} reminders</span>
        </div>
        ${ins.length ? `<div style="margin-top:12px">${ins.map(i => `<div class="sub" style="margin:6px 0">• ${esc(i)}</div>`).join('')}</div>` : `<p class="faint">Finish a few missions and I’ll learn what works for you.</p>`}
        <button class="btn small" data-a="retake" style="margin-top:8px">Retake the style quiz</button>
      </div>

      <h2>⚙️ Settings</h2>
      ${[['sound', '🔊 Sounds'], ['haptics', '📳 Vibration'], ['calm', '🧘 Calm mode (no animations)'], ['light', '☀️ Light mode'], ['bigtext', '🔠 Bigger text'], ['dyslexic', '🔤 Easy-read font']].map(([k, l]) =>
        `<div class="list-btn" data-a="toggle" data-k="${k}">${l}<span class="switch ${S.settings[k] ? 'on' : ''}" style="margin-left:auto"></span></div>`).join('')}
      <button class="list-btn" data-a="checkins"><span class="em">👀</span>Focus check-ins: <b>${{ off: 'Off', gentle: 'Once per sprint', normal: 'Every few minutes' }[S.settings.checkins]}</b><span class="chev">›</span></button>
      <button class="list-btn" data-a="notifs"><span class="em">🔔</span>Reminders &amp; notifications<span class="chev">›</span></button>
      <button class="list-btn" data-a="parent"><span class="em">🔒</span>Grown-up zone<span class="chev">›</span></button>
      <p class="faint center" style="margin-top:20px">MainQuest · everything stays on this phone</p>`;
  },

  statsSummary() {
    const out = [];
    const est = S.stats.estimates.slice(-8);
    if (est.length >= 3) {
      const ratio = est.reduce((s, e) => s + e.act / e.est, 0) / est.length;
      if (ratio > 1.3) out.push(`Time Detective: things usually take you about ${Math.round((ratio - 1) * 100)}% longer than you guess. Add a little buffer!`);
      else if (ratio < 0.75) out.push('Time Detective: you finish faster than you guess. Nice!');
      else out.push('Time Detective: your time guesses are getting really accurate 🕵️');
    }
    const b = this.bestTime(); if (b) out.push(`You finish the most missions in the ${b.label}.`);
    const ss = S.stats.sessions.filter(s => s.at > Date.now() - 7 * 864e5);
    if (ss.length) out.push(`This week: ${ss.length} focus sprints, ${fmtDur(ss.reduce((s, x) => s + x.actual, 0))} locked in.`);
    if (S.stats.bestWeek) out.push(`Best week so far: ${S.stats.bestWeek} good days.`);
    return out;
  },

  bestTime() {
    const hours = S.tasks.filter(t => t.done && t.doneAt).map(t => new Date(t.doneAt).getHours()).concat(S.stats.sessions.map(s => s.hour));
    if (hours.length < 8) return null;
    const buckets = { morning: 0, afterschool: 0, evening: 0 };
    hours.forEach(h => { if (h < 12) buckets.morning++; else if (h < 17) buckets.afterschool++; else buckets.evening++; });
    const [k, n] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    if (n / hours.length < 0.5) return null;
    return { key: k, label: { morning: 'morning', afterschool: 'afternoon (after school)', evening: 'evening' }[k] };
  },

  /* Style alignment from real behaviour: suggest, never force. */
  insights() {
    const out = []; const st = S.profile.style;
    const recent = S.stats.sessions.filter(s => s.planned === st.sprint).slice(-8);
    if (recent.length >= 5 && !S.tips.seen['ins-sprint-' + st.sprint]) {
      const clean = recent.filter(s => s.completed && !s.drifts).length / recent.length;
      if (clean >= 0.8 && st.sprint < 20) out.push({ id: 'sprint-up', text: `You crushed ${Math.round(clean * 100)}% of your ${st.sprint}-minute sprints without drifting. Want to try ${st.sprint + 5}-minute sprints?`, btn: `Try ${st.sprint + 5} min` });
      if (clean <= 0.35 && st.sprint > 5) out.push({ id: 'sprint-down', text: `${st.sprint}-minute sprints have been tough lately — that’s just data, not a problem. Shorter sprints might feel better.`, btn: `Switch to ${st.sprint - 5} min` });
    }
    const b = this.bestTime();
    if (b && b.key !== st.peak && !S.tips.seen['ins-peak-' + b.key]) out.push({ id: 'peak', key: b.key, text: `You actually get the most done in the ${b.label}. Make that your power hour for big missions?`, btn: 'Make it my power hour' });
    if (S.parking.length >= 5 && !S.tips.seen['ins-park-' + today()]) out.push({ id: 'park', text: `Your Parking Lot has ${S.parking.length} thoughts. Turn the important ones into missions and clear the rest?`, btn: 'Open Parking Lot' });
    const later = S.tasks.filter(t => t.parkedAuto && !t.done && !t.parkSeen);
    if (later.length) out.push({ id: 'parked', text: `${later.length} mission${later.length > 1 ? 's' : ''} moved to Later so Today stays clean. Check if any still matter.`, btn: 'Look at Later' });
    return out;
  },

  dailyTip() {
    const t = S.tips; const d = today();
    if (t.day === d) return t.current ? TIPS.find(x => x.id === t.current) : null;
    const st = S.profile.style; const pref = new Set([st.start === 'hard' ? 'hard' : 'easy', ...(st.helpers || [])]);
    if (st.peak !== 'unsure') pref.add('peak');
    const avoid = new Set([st.start === 'hard' ? 'easy' : 'hard']);
    const pool = TIPS.filter(x => !t.hidden.includes(x.id) && !avoid.has(x.tag));
    if (!pool.length) { t.day = d; t.current = ''; return null; }
    const scored = pool.map(x => ({ x, s: (t.seen[x.id] ? 0 : 5) + (pref.has(x.tag) ? 3 : 0) + (new Date().getDay() === 0 && x.id === 'sunday' ? 10 : 0) + Math.random() * 2 }));
    scored.sort((a, b) => b.s - a.s);
    const tip = scored[0].x; t.day = d; t.current = tip.id; t.seen[tip.id] = Date.now();
    save({ noSchedule: true });
    return tip;
  },

  /* ================================================================ Sheets & toasts */
  sheet(html, bind) {
    const w = $('#sheet-wrap'), s = $('#sheet');
    s.innerHTML = html; w.hidden = false;
    w.onclick = e => { if (e.target === w) this.closeSheet(); };
    bind && bind(s);
    const first = s.querySelector('input:not([type=time]):not([type=date])'); if (first && first.dataset.autofocus) first.focus();
  },
  closeSheet() { $('#sheet-wrap').hidden = true; $('#sheet').innerHTML = ''; },
  toast(msg, action, fn, ms = 2600) {
    const el = $('#toast'); el.innerHTML = esc(msg) + (action ? ` <button>${esc(action)}</button>` : ''); el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; fn(); };
    clearTimeout(this._tt); this._tt = setTimeout(() => { el.hidden = true; }, action ? 6000 : ms);
  },
  banner(o) {
    // In-app reminder (web fallback): one clear action.
    const t = o.taskId && S.tasks.find(x => x.id === o.taskId);
    if (S.focus) { this.toast(`${o.title}: ${o.body}`); return; }
    this.sheet(`<div class="grab"></div><div class="big-emoji">🔔</div><h3 class="center">${esc(o.title)}</h3><p class="center sub">${esc(o.body)}</p>
      ${t ? `<button class="btn primary big" data-x="start">▶ Start now</button><div class="btn-row"><button class="btn" data-x="snooze">⏰ 10 min</button><button class="btn" data-x="done">✅ Already done</button></div>`
        : o.routineId ? `<button class="btn primary big" data-x="routine">👉 Let’s go</button>` : `<button class="btn primary big" data-x="ok">OK</button>`}`, root => {
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return; this.closeSheet();
        const x = b.dataset.x;
        if (x === 'start') Focus.preflight(t.id);
        if (x === 'snooze') Reminders.onAction('snooze', { taskId: t.id });
        if (x === 'done') this.finishQuick(t);
        if (x === 'routine') this.openRoutine(o.routineId);
      };
    });
  },

  levelUp(lvl, evolved, themes) {
    if (S.focus) { this._pendingLevel = [lvl, evolved || (this._pendingLevel || [])[1], themes.concat((this._pendingLevel || [])[2] || [])]; return; }
    Sfx.play('level'); buzz('success'); confetti(1.5);
    this.sheet(`<div class="grab"></div><div class="buddy pop">${buddyEmoji()}</div>
      <h3 class="center">${evolved ? `${esc(S.profile.buddyName)} evolved! ✨` : `Level ${lvl}!`}</h3>
      <p class="center sub">${evolved ? `Now a ${STAGE_NAMES[buddyStage(lvl)]}. All because you kept showing up.` : 'You leveled up. Keep stacking missions!'}</p>
      ${themes.length ? `<p class="center">🎨 New theme: <b>${themes.map(t => esc(t.name)).join(', ')}</b></p>` : ''}
      <button class="btn primary block" data-x="ok">Awesome!</button>`, root => { root.onclick = e => { if (e.target.closest('[data-x]')) { this.closeSheet(); this.render(); } }; });
  },

  finishQuick(t) {
    const res = completeTask(t);
    if (!res) return;
    Sfx.play('done'); buzz('success'); confetti(0.8);
    this.render();
    this.toast(`${pick(BUDDY_LINES.done)} +${res.total} XP${res.chest ? ' · 🎁 ' + res.chest.text : ''}`, 'Undo', () => {
      t.done = false; t.doneAt = null; S.stats.missions--; S.stats.xp = Math.max(0, S.stats.xp - res.total); S.stats.coins = Math.max(0, S.stats.coins - res.total); save(); this.render();
    });
  },

  parkSheet(cb) {
    this.sheet(`<div class="grab"></div><h3>🅿️ Park a thought</h3><p class="sub">Write it down so your brain can let go. You’ll come back to it later.</p>
      <input class="field" id="park-in" data-autofocus="1" placeholder="e.g. ask Dad about Saturday" enterkeyhint="done">
      <div class="spacer"></div><button class="btn primary block" data-x="park">Park it</button>
      ${S.parking.length ? `<h2>Parked</h2>${S.parking.map(p => `<div class="task"><span class="em">💭</span><div class="grow t" style="font-size:16px">${esc(p.text)}</div>
        <button class="iconbtn" data-x="promote" data-id="${p.id}" aria-label="Make mission">＋</button><button class="iconbtn" data-x="drop" data-id="${p.id}" aria-label="Clear">✓</button></div>`).join('')}` : ''}`, root => {
      const input = $('#park-in', root); setTimeout(() => input.focus(), 50);
      const park = () => { const v = input.value.trim(); if (!v) { this.closeSheet(); cb && cb(); return; } S.parking.unshift({ id: uid(), text: v, at: Date.now() }); save({ noSchedule: true }); this.closeSheet(); this.toast('Parked 🅿️ Back to it!'); cb && cb(); if (!S.focus) this.render(); };
      input.onkeydown = e => { if (e.key === 'Enter') park(); };
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 'park') park();
        if (b.dataset.x === 'promote') { const p = S.parking.find(x => x.id === b.dataset.id); S.tasks.push(newTask(p.text.replace(/^🙋 Need help with: /, 'Ask for help: '))); S.parking = S.parking.filter(x => x !== p); save(); this.toast('Turned into a mission'); this.parkSheet(cb); }
        if (b.dataset.x === 'drop') { S.parking = S.parking.filter(x => x.id !== b.dataset.id); save({ noSchedule: true }); this.parkSheet(cb); }
      };
    });
  },

  /* ---------- Task details */
  taskSheet(t) {
    const anchors = [['', 'No plan'], ['afterschool', '🏫 After school'], ['aftersnack', '🍎 After snack'], ['afterdinner', '🍽️ After dinner'], ['beforebed', '🌙 Before bed']];
    const sizes = [['tiny', '🐭 Tiny'], ['small', '🐶 Medium'], ['big', '🐘 Big'], ['boss', '👹 Boss']];
    const tomorrow = dayKey(addDays(new Date(), 1));
    const whenNow = t.when === 'later' ? 'later' : (t.date === tomorrow ? 'tomorrow' : (t.date && t.date > tomorrow ? 'date' : 'today'));
    const draw = () => this.sheet(`<div class="grab"></div>
      <div class="row"><input class="field" id="ts-emoji" value="${esc(t.emoji)}" style="width:70px;text-align:center;font-size:24px"><input class="field grow" id="ts-title" value="${esc(t.title)}"></div>
      <label class="lbl">When</label>
      <div class="chips">${[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['later', 'Later'], ['date', '📅 Pick day']].map(([k, l]) => `<button class="chip ${whenNow === k ? 'on' : ''}" data-x="when" data-k="${k}">${l}</button>`).join('')}</div>
      ${whenNow === 'date' ? `<input class="field" type="date" id="ts-date" value="${t.date || tomorrow}" style="margin-top:8px">` : ''}
      <label class="lbl">When → Then plan <span class="faint">(plans with a “when” happen way more)</span></label>
      <div class="chips">${anchors.map(([k, l]) => `<button class="chip ${t.anchor === k ? 'on' : ''}" data-x="anchor" data-k="${k}">${l}</button>`).join('')}</div>
      <label class="lbl">⏰ Reminder time <span class="faint">(optional)</span></label>
      <div class="row"><input class="field grow" type="time" id="ts-time" value="${t.time || ''}"><button class="btn small ghost" data-x="notime">Clear</button></div>
      <label class="lbl">How big is it?</label>
      <div class="chips">${sizes.map(([k, l]) => `<button class="chip ${t.size === k ? 'on' : ''}" data-x="size" data-k="${k}">${l}</button>`).join('')}</div>
      <label class="lbl">Steps ${t.steps.length ? `· ${t.steps.filter(s => s.done).length}/${t.steps.length}` : ''}</label>
      ${t.steps.map((s, i) => `<div class="row" style="margin-bottom:6px"><button class="check ${s.done ? 'on' : ''}" data-x="stepdone" data-i="${i}">${s.done ? '✓' : ''}</button><input class="field grow" data-step="${i}" value="${esc(s.text)}"><button class="iconbtn" data-x="stepdel" data-i="${i}">🗑️</button></div>`).join('')}
      <div class="row"><input class="field grow" id="ts-step" placeholder="Add a step…"><button class="iconbtn" data-x="stepadd">＋</button></div>
      <div class="chips" style="margin-top:8px"><button class="chip" data-x="chop" data-k="0">🔪 Chop it (3 steps)</button><button class="chip" data-x="chop" data-k="1">🔪🔪 Super tiny steps</button></div>
      <label class="lbl">🎒 Gear needed</label>
      <div class="chips">${(t.gear || []).map((g, i) => `<button class="chip" data-x="geardel" data-i="${i}">${esc(g)} ✕</button>`).join('')}<button class="chip" data-x="gearadd">＋ add</button>${!(t.gear || []).length ? `<button class="chip" data-x="gearsuggest">✨ Suggest</button>` : ''}</div>
      <div class="spacer"></div>
      <button class="btn primary big" data-x="start">▶ Start now</button>
      <div class="btn-row"><button class="btn" data-x="save">💾 Save</button><button class="btn" data-x="next">⬆️ Do this next</button></div>
      <div class="btn-row"><button class="btn ghost" data-x="delete">🗑️ Delete</button></div>`, root => {
      const pull = () => {
        t.title = $('#ts-title', root).value.trim() || t.title; t.emoji = $('#ts-emoji', root).value.trim() || autoEmoji(t.title);
        t.time = $('#ts-time', root).value || '';
        const di = $('#ts-date', root); if (di && di.value) t.date = di.value;
        $$('[data-step]', root).forEach(inp => { t.steps[+inp.dataset.step].text = inp.value; });
      };
      root.onclick = async e => {
        const b = e.target.closest('[data-x]'); if (!b) return; pull();
        const x = b.dataset.x, k = b.dataset.k;
        if (x === 'when') {
          if (k === 'today') { t.when = 'today'; t.date = today(); }
          if (k === 'tomorrow') { t.when = 'today'; t.date = tomorrow; }
          if (k === 'later') { t.when = 'later'; t.date = null; t.time = ''; }
          if (k === 'date') { t.when = 'today'; t.date = t.date && t.date > today() ? t.date : dayKey(addDays(new Date(), 2)); }
          t.parkedAuto = false;
          return this.taskSheet(t);
        }
        if (x === 'anchor') { t.anchor = k; if (k) { const a = S.settings.anchors[k]; t.time = a || (k === 'beforebed' ? fmt24(new Date(+atTime(S.settings.bedtime) - 75 * 60e3)) : t.time); } return draw(); }
        if (x === 'notime') { t.time = ''; t.anchor = ''; return draw(); }
        if (x === 'size') { t.size = k; return draw(); }
        if (x === 'stepdone') { const s = t.steps[+b.dataset.i]; s.done = !s.done; if (s.done) { award(XP.step); Sfx.play('step'); markGoodDay(); } return draw(); }
        if (x === 'stepdel') { t.steps.splice(+b.dataset.i, 1); return draw(); }
        if (x === 'stepadd') { const v = $('#ts-step', root).value.trim(); if (v) t.steps.push({ id: uid(), text: v, done: false }); return draw(); }
        if (x === 'chop') { t.steps = t.steps.filter(s => s.done).concat(suggestSteps(t.title, k === '1').map(text => ({ id: uid(), text, done: false }))); if (t.steps.length >= 5 && t.size === 'small') t.size = 'big'; return draw(); }
        if (x === 'gearadd') { const g = await ask('What do you need for this?', { input: true, placeholder: 'e.g. calculator', ok: 'Add' }); if (g) { t.gear = t.gear || []; t.gear.push(g); } return draw(); }
        if (x === 'gearsuggest') { t.gear = suggestGear(t.title); return draw(); }
        if (x === 'geardel') { t.gear.splice(+b.dataset.i, 1); return draw(); }
        if (x === 'save') { t.parkSeen = true; this.saveTask(t); this.closeSheet(); this.render(); this.toast('Saved'); }
        if (x === 'next') { t.when = 'today'; t.date = today(); S.tasks.forEach(o => { o.pin = 0; }); t.pin = 1; this.saveTask(t); this.closeSheet(); this.render(); this.toast('Up next ⬆️'); }
        if (x === 'start') { if (t.when === 'later' || (t.date && t.date > today())) { t.when = 'today'; t.date = today(); } this.saveTask(t); this.closeSheet(); Focus.preflight(t.id); }
        if (x === 'delete') { const copy = { ...t }; S.tasks = S.tasks.filter(o => o.id !== t.id); save(); this.closeSheet(); this.render(); this.toast('Deleted', 'Undo', () => { S.tasks.push(copy); save(); this.render(); }); }
      };
    });
    draw();
  },
  saveTask(t) { if (!S.tasks.includes(t)) S.tasks.push(t); save(); },

  /* ---------- Plan my day: pick ≤3, give each a When → Then */
  planSheet() {
    const all = S.tasks.filter(t => !t.done);
    const chosen = new Set(todayQueue().slice(0, 3).map(t => t.id));
    const draw = () => this.sheet(`<div class="grab"></div><h3>🗺️ Plan my day</h3>
      <p class="sub">Pick up to <b>3 missions</b> for today. Everything else waits in Later — that’s fine!</p>
      ${S.profile.style.peak !== 'unsure' ? `<p class="faint">Your power time: ${{ morning: 'morning 🌅', afterschool: 'right after school 🏫', evening: 'evening 🌙' }[S.profile.style.peak]} — put the big one there.</p>` : ''}
      ${all.length ? all.map(t => `<div class="task plan-row" data-x="pick" data-id="${t.id}"><span class="check ${chosen.has(t.id) ? 'on' : ''}">${chosen.has(t.id) ? '✓' : ''}</span><span class="em">${esc(t.emoji)}</span><div class="grow"><div class="t">${esc(t.title)}</div>
        ${chosen.has(t.id) ? `<div class="anchor-grid">${[['afterschool', '🏫 After school'], ['aftersnack', '🍎 After snack'], ['afterdinner', '🍽️ After dinner'], ['beforebed', '🌙 Before bed']].map(([k, l]) => `<button class="chip ${t.anchor === k ? 'on' : ''}" data-x="anchor" data-id="${t.id}" data-k="${k}">${l}</button>`).join('')}</div>` : ''}</div></div>`).join('')
        : `<div class="card soft center sub">No missions yet — add some on the Missions tab first.</div>`}
      <div class="spacer"></div><button class="btn primary block" data-x="done">Lock in my plan</button>`, root => {
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return;
        const t = S.tasks.find(x => x.id === b.dataset.id);
        if (b.dataset.x === 'anchor') { e.stopPropagation(); t.anchor = t.anchor === b.dataset.k ? '' : b.dataset.k; if (t.anchor) t.time = S.settings.anchors[t.anchor] || fmt24(new Date(+atTime(S.settings.bedtime) - 75 * 60e3)); else t.time = ''; return draw(); }
        if (b.dataset.x === 'pick') {
          if (chosen.has(t.id)) chosen.delete(t.id); else { if (chosen.size >= 3) { this.toast('3 is the max — finish those first!'); return; } chosen.add(t.id); }
          Sfx.play('tap'); return draw();
        }
        if (b.dataset.x === 'done') {
          all.forEach(t => {
            if (chosen.has(t.id)) { t.when = 'today'; t.date = today(); t.parkedAuto = false; }
            else if (isToday(t)) { t.when = 'later'; t.date = null; t.time = ''; }
          });
          save(); this.closeSheet(); this.go('now'); this.toast('Plan locked in 🔒 One at a time!');
        }
      };
    });
    draw();
  },

  /* ---------- Quick add with tiny natural-language parsing */
  quickAdd(text) {
    text = (text || '').trim(); if (!text) return;
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
    const t = newTask(text.charAt(0).toUpperCase() + text.slice(1), extra);
    S.tasks.push(t); save(); Sfx.play('coin'); buzz();
    this.render();
    this.toast(`Added ${t.emoji} ${t.title}${t.time ? ' · ⏰ ' + fmtHM(t.time) : ''}`, 'Details', () => this.taskSheet(t));
  },

  mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    this.toast('🎤 Listening… say your mission');
    rec.onresult = e => { const txt = e.results[0][0].transcript; this.quickAdd(txt); };
    rec.onerror = () => this.toast('Didn’t catch that — try typing it');
    rec.start();
  },

  /* ================================================================ Onboarding (< 2 minutes) */
  onboarding() {
    const v = $('#view'); const step = this.quizStep; const A = this.quizAns;
    const total = QUIZ.length + 4;
    const prog = `<div class="q-progress">${Array.from({ length: total }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
    let html = '';
    if (step === 0) {
      html = `<div class="big-emoji">🎯</div><h1 class="center">Welcome to MainQuest</h1>
        <p class="center sub">One mission at a time. Reminders that actually help. A buddy that levels up with you.</p>
        <label class="lbl">What should I call you?</label><input class="field" id="ob-name" value="${esc(A.name || '')}" placeholder="Your name" autocomplete="off">
        <div class="spacer"></div><button class="btn primary big" data-o="next">Let’s go →</button>
        <p class="faint center">6 quick questions so the app fits how YOUR brain works.</p>`;
    } else if (step <= QUIZ.length) {
      const q = QUIZ[step - 1]; const cur = A[q.k];
      html = `${prog}<h1>${esc(q.q)}</h1>${q.opts.map(([val, em, label], i) => {
        const on = q.multi ? (cur || []).includes(val) : cur === val && A[q.k + '_i'] === i;
        return `<button class="q-opt ${on ? 'on' : ''}" data-o="opt" data-i="${i}"><span class="em">${em}</span>${esc(label)}</button>`; }).join('')}
        ${q.multi ? `<button class="btn primary big" data-o="next">Next →</button>` : ''}
        <button class="btn ghost block" data-o="back" style="margin-top:8px">← Back</button>`;
    } else if (step === QUIZ.length + 1) {
      html = `${prog}<h1>Pick your buddy</h1><p class="sub">It grows every time you finish stuff. It never gets sad or hungry — it’s just happy you’re here.</p>
        <div class="grid2">${Object.entries(BUDDIES).map(([k, b]) => `<button class="q-opt ${A.buddy === k ? 'on' : ''}" data-o="buddy" data-k="${k}" style="flex-direction:column;justify-content:center"><span class="em" style="font-size:44px">${b.stages[0]}→${b.stages[4]}</span>${esc(b.name)}</button>`).join('')}</div>
        <label class="lbl">Name your buddy</label><input class="field" id="ob-buddy" value="${esc(A.buddyName || '')}" placeholder="e.g. Sparky" autocomplete="off">
        <div class="spacer"></div><button class="btn primary big" data-o="next">Next →</button><button class="btn ghost block" data-o="back" style="margin-top:8px">← Back</button>`;
    } else if (step === QUIZ.length + 2) {
      html = `${prog}<div class="big-emoji">🔔</div><h1 class="center">Turn on reminders?</h1>
        <p class="center sub">MainQuest gives a heads-up 5 minutes before things, a nudge when it’s time, and helps you get back on track. No spam — promise.</p>
        <div class="spacer"></div><button class="btn primary big" data-o="notif">Yes, remind me</button>
        <button class="btn ghost block" data-o="next" style="margin-top:8px">Maybe later</button>`;
    } else {
      html = `${prog}<div class="big-emoji">${(BUDDIES[A.buddy || 'dragon']).stages[0]}</div><h1 class="center">First missions</h1>
        <p class="center sub">What do you need to do today or tomorrow? Add 1–3 things (you can skip this).</p>
        <div class="quickadd"><input id="ob-task" placeholder="e.g. math worksheet at 4pm" enterkeyhint="done" autocomplete="off"><button class="iconbtn" data-o="addtask">＋</button></div>
        <div id="ob-list">${(A.tasks || []).map(t => `<div class="task"><span class="em">${autoEmoji(t)}</span><div class="t">${esc(t)}</div></div>`).join('')}</div>
        <div class="spacer"></div><button class="btn primary big" data-o="finish">Start my quest 🚀</button>`;
    }
    v.innerHTML = html;
    v.onclick = null;
    const keep = () => { const n = $('#ob-name'); if (n) A.name = n.value.trim(); const b = $('#ob-buddy'); if (b) A.buddyName = b.value.trim(); };
    v.querySelectorAll('[data-o]').forEach(btn => btn.onclick = async () => {
      keep(); const o = btn.dataset.o;
      if (o === 'next') { this.quizStep++; return this.onboarding(); }
      if (o === 'back') { this.quizStep = Math.max(0, this.quizStep - 1); return this.onboarding(); }
      if (o === 'opt') {
        const q = QUIZ[step - 1]; const [val] = q.opts[+btn.dataset.i]; Sfx.play('tap'); buzz();
        if (q.multi) { const arr = A[q.k] || []; A[q.k] = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; return this.onboarding(); }
        A[q.k] = val; A[q.k + '_i'] = +btn.dataset.i; setTimeout(() => { this.quizStep++; this.onboarding(); }, 220); btn.classList.add('on'); return;
      }
      if (o === 'buddy') { A.buddy = btn.dataset.k; return this.onboarding(); }
      if (o === 'notif') { await Reminders.ask(); this.quizStep++; return this.onboarding(); }
      if (o === 'addtask') { const i = $('#ob-task'); if (i.value.trim()) { A.tasks = A.tasks || []; A.tasks.push(i.value.trim()); } return this.onboarding(); }
      if (o === 'finish') {
        const i = $('#ob-task'); if (i && i.value.trim()) { A.tasks = A.tasks || []; A.tasks.push(i.value.trim()); }
        const st = S.profile.style;
        QUIZ.forEach(q => { if (A[q.k] !== undefined) st[q.k] = A[q.k]; });
        S.profile.name = A.name || ''; S.profile.buddy = A.buddy || 'dragon'; S.profile.buddyName = A.buddyName || 'Sparky';
        S.profile.onboarded = true;
        if (st.peak === 'unsure') S.profile.style.peak = 'unsure';
        (A.tasks || []).forEach(t => { this.quickAddSilent(t); });
        const wasRetake = this._retake; this._retake = false;
        if (!wasRetake) award(10); // welcome bonus — fast early wins
        save(); this.tab = wasRetake ? 'me' : 'now'; this.render();
        this.toast(wasRetake ? 'Style updated ✨' : `Welcome${S.profile.name ? ', ' + S.profile.name : ''}! +10 XP to start 🎉`); Sfx.play('done'); confetti(1);
      }
    });
    const ti = $('#ob-task'); if (ti) { ti.onkeydown = e => { if (e.key === 'Enter') v.querySelector('[data-o=addtask]').click(); }; }
  },
  quickAddSilent(text) { const r = this.toast; this.toast = () => {}; try { this.quickAdd(text); } finally { this.toast = r; } },

  /* ================================================================ Grown-up zone */
  parentGate() {
    let entered = '';
    const setting = !S.settings.pin;
    const draw = () => this.sheet(`<div class="grab"></div><h3 class="center">🔒 Grown-up zone</h3>
      <p class="center sub">${setting ? 'Create a 4-digit grown-up PIN' : 'Enter the grown-up PIN'}</p>
      <div class="pindots">${[0, 1, 2, 3].map(i => `<i class="${i < entered.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(n => n === '' ? '<span></span>' : `<button data-n="${n}">${n}</button>`).join('')}</div>`, root => {
      root.onclick = e => {
        const b = e.target.closest('[data-n]'); if (!b) return;
        const n = b.dataset.n;
        if (n === '⌫') entered = entered.slice(0, -1); else if (entered.length < 4) entered += n;
        if (entered.length === 4) {
          if (setting) { S.settings.pin = entered; save({ noSchedule: true }); this.toast('PIN set'); return this.parentZone(); }
          if (entered === S.settings.pin) return this.parentZone();
          entered = ''; this.toast('Wrong PIN'); buzz('heavy');
        }
        draw();
      };
    });
    draw();
  },

  async parentZone() {
    const st = S.settings;
    const pending = S.redemptions.filter(r => r.status === 'pending');
    const wishes = S.wishes.filter(w => w.status === 'new');
    const wk = S.stats.sessions.filter(s => s.at > Date.now() - 7 * 864e5);
    const weekDone = S.tasks.filter(t => t.done && t.doneAt > Date.now() - 7 * 864e5).length;
    const stale = Date.now() - S.rewardsUpdated > 18 * 864e5;
    const perm = await Reminders.permission(); const exact = await Reminders.exactStatus();
    const later = S.tasks.filter(t => !t.done && t.when === 'later');
    this.sheet(`<div class="grab"></div><h3>🔒 Grown-up zone</h3>
      <div class="card soft"><b>This week</b>
        <div class="grid3" style="margin-top:8px"><div class="stat"><b>${weekDone}</b><span class="faint">missions</span></div><div class="stat"><b>${goodDaysThisWeek()}</b><span class="faint">good days</span></div><div class="stat"><b>${fmtDur(wk.reduce((s, x) => s + x.actual, 0))}</b><span class="faint">focus</span></div></div>
        ${this.statsSummary().map(s => `<div class="sub" style="margin-top:6px">• ${esc(s)}</div>`).join('')}
        <p class="faint" style="margin-top:8px">He can see this same summary on his Me tab. Praise effort and specific wins (“you started math without a reminder!”) — that builds motivation more than rewards do.</p></div>

      <h2>💌 Send a note</h2>
      <div class="row"><input class="field grow" id="pz-note" placeholder="e.g. Proud of how you started homework today!"><button class="btn small gold" data-x="note">Send</button></div>

      ${pending.length ? `<h2>🎁 Rewards to give</h2>${pending.map(p => `<div class="task"><span class="em">${esc(p.emoji)}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="meta">${new Date(p.at).toLocaleDateString()}</div></div><button class="btn small gold" data-x="given" data-id="${p.id}">Given ✓</button></div>`).join('')}` : ''}
      ${wishes.length ? `<h2>💭 Reward wishes</h2>${wishes.map(w => `<div class="task"><div class="grow t">${esc(w.text)}</div><button class="btn small" data-x="wishok" data-id="${w.id}">Add</button><button class="iconbtn" data-x="wishno" data-id="${w.id}">✕</button></div>`).join('')}` : ''}

      <h2>🛍️ Reward menu</h2>
      ${stale ? `<p class="sub">⚡ It’s been a few weeks — kids with ADHD get used to rewards fast. Swap in 1–2 new ones (ideally chosen together).</p>` : ''}
      ${S.rewards.map(r => `<div class="row" style="margin-bottom:6px"><input class="field" data-re="${r.id}" value="${esc(r.emoji)}" style="width:60px;text-align:center"><input class="field grow" data-rn="${r.id}" value="${esc(r.name)}"><input class="field" data-rc="${r.id}" type="number" value="${r.cost}" style="width:84px"><button class="iconbtn" data-x="rdel" data-id="${r.id}">🗑️</button></div>`).join('')}
      <div class="btn-row"><button class="btn small" data-x="radd">＋ Add reward</button><button class="btn small" data-x="rsave">💾 Save menu</button></div>
      <p class="faint">Roughly 10–20 coins per mission. Mix small daily rewards with bigger weekly ones; favor privileges and experiences.</p>

      <h2>⏰ Schedule</h2>
      <label class="lbl">Bedtime</label><input class="field" type="time" id="pz-bed" value="${st.bedtime}">
      <div class="list-btn" data-x="tschool">🏫 Quiet during school hours<span class="switch ${st.schoolQuiet ? 'on' : ''}" style="margin-left:auto"></span></div>
      <div class="row"><input class="field" type="time" id="pz-ss" value="${st.schoolStart}"><span>to</span><input class="field" type="time" id="pz-se" value="${st.schoolEnd}"></div>
      <label class="lbl">When → Then anchor times</label>
      <div class="grid3"><div><div class="faint">After school</div><input class="field" type="time" id="pz-a1" value="${st.anchors.afterschool}"></div><div><div class="faint">After snack</div><input class="field" type="time" id="pz-a2" value="${st.anchors.aftersnack}"></div><div><div class="faint">After dinner</div><input class="field" type="time" id="pz-a3" value="${st.anchors.afterdinner}"></div></div>
      <label class="lbl">Weekly goal (good days)</label>
      <div class="chips">${[3, 4, 5, 6].map(n => `<button class="chip ${st.weekGoal === n ? 'on' : ''}" data-x="goal" data-k="${n}">${n} days</button>`).join('')}</div>
      <button class="btn primary block" data-x="ssave" style="margin-top:12px">💾 Save schedule</button>

      ${later.length ? `<h2>🗂️ In “Later” (${later.length})</h2><p class="faint">Old items move here quietly so his Today list never becomes a guilt pile. Delete what no longer matters.</p>
        ${later.map(t => `<div class="task"><span class="em">${esc(t.emoji)}</span><div class="grow t" style="font-size:16px">${esc(t.title)}</div><button class="iconbtn" data-x="tdel" data-id="${t.id}">🗑️</button></div>`).join('')}` : ''}

      <h2>🔔 Notifications</h2>
      <div class="card soft sub">Permission: <b>${perm}</b>${exact !== null ? ` · Exact timing: <b>${exact}</b>` : ''}<br>${Native.ok ? 'Running as an installed Android app — reminders fire even when it’s closed.' : 'Running as a web app — reminders show while the app is open or recently used. Install the Android build for always-on reminders.'}</div>
      <div class="btn-row"><button class="btn small" data-x="perm">Ask permission</button>${exact === 'denied' || exact === 'prompt' ? `<button class="btn small" data-x="exact">Allow exact alarms</button>` : ''}<button class="btn small" data-x="test">Send test</button></div>

      <h2>💾 Backup</h2>
      <div class="btn-row"><button class="btn small" data-x="export">⬇️ Export</button><button class="btn small" data-x="import">⬆️ Import</button></div>
      <input type="file" id="pz-file" accept="application/json" hidden>
      <div class="btn-row"><button class="btn small ghost" data-x="pin">Change PIN</button><button class="btn small ghost" data-x="reset">Reset everything</button></div>
      <div class="spacer"></div><button class="btn primary block" data-x="close">Done</button>`, root => {
      root.onclick = async e => {
        const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x, id = b.dataset.id;
        if (x === 'note') { const v = $('#pz-note', root).value.trim(); if (v) { S.notes.unshift({ id: uid(), text: v, from: 'Dad', at: Date.now(), read: false }); S.notes = S.notes.slice(0, 20); save({ noSchedule: true }); this.toast('Note sent 💌'); $('#pz-note', root).value = ''; } }
        if (x === 'given') { const r = S.redemptions.find(r => r.id === id); r.status = 'given'; r.givenAt = Date.now(); save({ noSchedule: true }); this.parentZone(); }
        if (x === 'wishok') { const w = S.wishes.find(w => w.id === id); const c = +(await ask(`Coin price for “${w.text}”?`, { input: true, value: '100', type: 'number', ok: 'Add reward' })); if (c > 0) { S.rewards.push({ id: uid(), emoji: '⭐', name: w.text, cost: c }); w.status = 'added'; S.rewardsUpdated = Date.now(); save({ noSchedule: true }); } this.parentZone(); }
        if (x === 'wishno') { S.wishes.find(w => w.id === id).status = 'no'; save({ noSchedule: true }); this.parentZone(); }
        if (x === 'rdel') { S.rewards = S.rewards.filter(r => r.id !== id); S.rewardsUpdated = Date.now(); save({ noSchedule: true }); this.parentZone(); }
        if (x === 'radd' || x === 'rsave') {
          S.rewards.forEach(r => { r.emoji = $(`[data-re="${r.id}"]`, root).value || '⭐'; r.name = $(`[data-rn="${r.id}"]`, root).value; r.cost = Math.max(1, +$(`[data-rc="${r.id}"]`, root).value || 50); });
          if (x === 'radd') S.rewards.push({ id: uid(), emoji: '🎁', name: 'New reward', cost: 80 });
          S.rewardsUpdated = Date.now(); save({ noSchedule: true }); if (x === 'rsave') this.toast('Reward menu saved'); this.parentZone();
        }
        if (x === 'tschool') { st.schoolQuiet = !st.schoolQuiet; b.querySelector('.switch').classList.toggle('on', st.schoolQuiet); }
        if (x === 'goal') { st.weekGoal = +b.dataset.k; $$('[data-x=goal]', root).forEach(c => c.classList.toggle('on', c === b)); }
        if (x === 'ssave') {
          st.bedtime = $('#pz-bed', root).value || st.bedtime; st.schoolStart = $('#pz-ss', root).value || st.schoolStart; st.schoolEnd = $('#pz-se', root).value || st.schoolEnd;
          st.anchors = { afterschool: $('#pz-a1', root).value || st.anchors.afterschool, aftersnack: $('#pz-a2', root).value || st.anchors.aftersnack, afterdinner: $('#pz-a3', root).value || st.anchors.afterdinner };
          save(); this.toast('Schedule saved');
        }
        if (x === 'tdel') { S.tasks = S.tasks.filter(t => t.id !== id); save(); this.parentZone(); }
        if (x === 'perm') { const r = await Reminders.ask(); this.toast('Permission: ' + r); this.parentZone(); }
        if (x === 'exact') Reminders.fixExact();
        if (x === 'test') { const at = new Date(Date.now() + 5000); if (Native.ok) { await Reminders.focusNotify(900099, at, '🔔 Test reminder', 'If you see this, reminders work!'); } else { setTimeout(() => Reminders.webShow('🔔 Test reminder', 'If you see this, reminders work!') || this.toast('🔔 Test reminder (in-app)'), 5000); } this.toast('Test reminder in 5 seconds…'); }
        if (x === 'export') this.exportData();
        if (x === 'import') { const f = $('#pz-file', root); f.onchange = () => { const file = f.files[0]; if (!file) return; file.text().then(txt => { try { const data = JSON.parse(txt); if (!data.profile || !data.tasks) throw 0; S = migrate(data); save(); this.closeSheet(); this.render(); this.toast('Backup restored'); } catch (err) { this.toast('That file didn’t look like a MainQuest backup'); } }); }; f.click(); }
        if (x === 'pin') { S.settings.pin = ''; save({ noSchedule: true }); this.parentGate(); }
        if (x === 'reset') { if (await ask('Erase ALL MainQuest data on this phone? This cannot be undone.', { ok: 'Erase' }) && await ask('Really erase everything?', { ok: 'Yes, erase' })) { localStorage.removeItem(KEY); if (Native.ok) { const P = Native.plugin('Preferences'); P && await P.remove({ key: KEY }); } S = freshState(); this.quizStep = 0; this.quizAns = {}; this.closeSheet(); this.render(); } }
        if (x === 'close') { this.closeSheet(); this.render(); }
      };
    });
  },

  async exportData() {
    const json = JSON.stringify(S, null, 1); const name = `mainquest-backup-${today()}.json`;
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'MainQuest backup' }); return; }
    } catch (e) { }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  },

  /* ================================================================ Global click router */
  async onClick(e) {
    const el = e.target.closest('[data-a],[data-tab]'); if (!el) return;
    if (el.dataset.tab) { Sfx.play('tap'); return this.go(el.dataset.tab); }
    const a = el.dataset.a, id = el.dataset.id;
    const t = id && S.tasks.find(x => x.id === id);
    switch (a) {
      case 'tab': return this.go(el.dataset.t);
      case 'start': return Focus.preflight(id);
      case 'resumeFocus': return Focus.render();
      case 'quickDone': return this.finishQuick(t);
      case 'undo': t.done = false; t.doneAt = null; save(); return this.render();
      case 'notNow': { this.closeSheet(); t.pin = 0; t.defer = today(); t.deferAt = Date.now(); save(); this.render(); return this.toast('No problem — moved it back. Next one!'); }
      case 'spin': { const q = todayQueue(); const p = pick(q.slice(0, Math.min(3, q.length))); S.tasks.forEach(o => o.pin = 0); p.pin = 1; save(); Sfx.play('coin'); this.render(); return this.toast(`🎲 The wheel picked: ${p.title}`); }
      case 'stuckNow': return this.sheet(`<div class="grab"></div><h3>😵 Stuck on “${esc(t.title)}”?</h3>
          <button class="list-btn" data-a="chop" data-id="${t.id}"><span class="em">🔪</span>Chop it into tiny steps<span class="chev">›</span></button>
          <button class="list-btn" data-a="two" data-id="${t.id}"><span class="em">⏱️</span>Just do 2 minutes<span class="chev">›</span></button>
          <button class="list-btn" data-a="notNow" data-id="${t.id}"><span class="em">⏭</span>Do a different one first<span class="chev">›</span></button>
          <button class="list-btn" data-a="park" ><span class="em">🙋</span>Write down what I need help with<span class="chev">›</span></button>`, root => root.onclick = ev => { this.closeSheet(); this.onClick(ev); });
      case 'two': this.closeSheet(); return Focus.start(id, 2, 'mini');
      case 'chop': t.steps = (t.steps || []).filter(s => s.done).concat(suggestSteps(t.title, false).map(text => ({ id: uid(), text, done: false }))); save(); this.render(); return this.toast('Chopped! Tap a mission to edit the steps.');
      case 'openTask': return this.taskSheet(t);
      case 'qa': { const i = $('#qa'); this.quickAdd(i.value); return; }
      case 'qaNow': { const i = $('#qa-now'); this.quickAdd(i.value); return; }
      case 'mic': return this.mic();
      case 'plan': return this.planSheet();
      case 'rtItem': { const r = S.routines.find(x => x.id === el.dataset.r); this.toggleRoutineItem(r, el.dataset.i); return this.render(); }
      case 'openRoutine': return this.openRoutine(el.dataset.r);
      case 'skipRoutine': { const r = S.routines.find(x => x.id === el.dataset.r); r.skipped = today(); save({ noSchedule: true }); return this.render(); }
      case 'newRoutine': return this.editRoutine(null);
      case 'readNote': { const n = S.notes.find(x => x.id === id); n.read = true; save({ noSchedule: true }); Sfx.play('coin'); return this.render(); }
      case 'tipLike': S.tips.liked.push(el.dataset.k); S.tips.current = ''; save({ noSchedule: true }); this.toast('Nice — give it a try today 👍'); return this.render();
      case 'tipHide': S.tips.hidden.push(el.dataset.k); S.tips.current = ''; save({ noSchedule: true }); this.toast('Got it — I’ll show you different tips'); return this.render();
      case 'tipTask': { const tip = TIPS.find(x => x.id === el.dataset.k); S.tasks.push(newTask(tip.task)); S.tips.liked.push(tip.id); S.tips.current = ''; save(); this.toast('Added as a mission'); return this.render(); }
      case 'insight': {
        const ins = this.insights().find(i => i.id === el.dataset.k); if (!ins) return;
        const st = S.profile.style;
        if (ins.id === 'sprint-up') { S.tips.seen['ins-sprint-' + st.sprint] = 1; st.sprint += 5; this.toast(`Sprints are now ${st.sprint} min. You can always change back.`); }
        if (ins.id === 'sprint-down') { S.tips.seen['ins-sprint-' + st.sprint] = 1; st.sprint -= 5; this.toast(`Sprints are now ${st.sprint} min. Short + done beats long + stuck.`); }
        if (ins.id === 'peak') { S.tips.seen['ins-peak-' + ins.key] = 1; st.peak = ins.key; this.toast('Power hour updated ⚡'); }
        if (ins.id === 'park') { S.tips.seen['ins-park-' + today()] = 1; save({ noSchedule: true }); return this.parkSheet(); }
        if (ins.id === 'parked') { S.tasks.forEach(x => { if (x.parkedAuto) x.parkSeen = true; }); save(); return this.go('missions'); }
        save({ noSchedule: true }); return this.render();
      }
      case 'parking': case 'park': return this.parkSheet();
      case 'redeem': {
        const r = S.rewards.find(x => x.id === id); if (S.stats.coins < r.cost) return;
        if (!(await ask(`Spend ${r.cost} coins on “${r.name}”?`, { ok: 'Spend 🪙' }))) return;
        S.stats.coins -= r.cost; S.redemptions.unshift({ id: uid(), rewardId: r.id, name: r.name, emoji: r.emoji, cost: r.cost, at: Date.now(), status: 'pending' });
        save({ noSchedule: true }); Sfx.play('level'); confetti(1); this.render(); return this.toast('🎉 Requested! Show a grown-up to get it.');
      }
      case 'wish': { const w = await ask('What reward would you love? A grown-up will set the price.', { input: true, placeholder: 'e.g. trip to the trampoline park', ok: 'Send wish' }); if (w && w.trim()) { S.wishes.push({ id: uid(), text: w.trim(), at: Date.now(), status: 'new' }); save({ noSchedule: true }); this.toast('Wish sent 💭'); } return; }
      case 'theme': S.profile.theme = id; save({ noSchedule: true }); return this.render();
      case 'retake': S.profile.onboarded = false; this.quizStep = 1; this.quizAns = { name: S.profile.name, buddy: S.profile.buddy, buddyName: S.profile.buddyName, tasks: [] }; this._retake = true; return this.render();
      case 'toggle': S.settings[el.dataset.k] = !S.settings[el.dataset.k]; save({ noSchedule: true }); return this.render();
      case 'checkins': { const order = ['gentle', 'normal', 'off']; S.settings.checkins = order[(order.indexOf(S.settings.checkins) + 1) % 3]; save({ noSchedule: true }); return this.render(); }
      case 'notifs': { const p = await Reminders.ask(); this.toast(p === 'granted' ? '🔔 Reminders are on' : 'Reminders are off — a grown-up can turn them on in phone Settings'); return; }
      case 'parent': return this.parentGate();
    }
  },
};

function fmt24(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
