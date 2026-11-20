'use strict';
/* Focus mode: preflight (gear + guess) → sprint with visual timer → gentle check-ins → refocus / stuck / break → celebrate. */

const FOCUS_END_ID = 900001, FOCUS_DRIFT_ID = 900002;
const Focus = {
  timer: null,
  panel: null,          // 'checkin' | 'refocus' | 'stuck' | 'sprintEnd' | 'complete' | 'welcome' | null
  hiddenAt: 0,
  celebrate: null,

  task() { return S.focus && S.tasks.find(t => t.id === S.focus.taskId); },

  /* ---------- Preflight: one fast screen. Gear check (resources) + time guess (time sense) + style helpers. */
  preflight(taskId) {
    const t = S.tasks.find(x => x.id === taskId); if (!t) return;
    if (!t.gear || !t.gear.length) t.gear = suggestGear(t.title);
    const st = S.profile.style;
    const sprint = t.size === 'tiny' ? Math.min(5, st.sprint) : st.sprint;
    const helpers = st.helpers || [];
    const helperChips = [
      helpers.includes('music') && '🎧 Music (no words) on?',
      helpers.includes('quiet') && '🤫 Quiet spot?',
      helpers.includes('fidget') && '🧸 Fidget ready?',
      helpers.includes('someone') && '🧍 Ask someone to sit nearby?',
    ].filter(Boolean);
    UI.sheet(`
      <div class="grab"></div>
      <h3>${esc(t.emoji)} ${esc(t.title)}</h3>
      ${t.anchor ? `<p class="sub">Your plan: <b>${esc(anchorText(t.anchor))}</b> → then this.</p>` : ''}
      <label class="lbl">🎒 Gear check — tap what you have</label>
      <div class="chips" id="gear">${t.gear.map((g, i) => `<button class="chip" data-gear="${i}">${esc(g)}</button>`).join('')}
        <button class="chip" data-act="addgear">＋</button></div>
      ${helperChips.length ? `<label class="lbl">✨ Your focus helpers</label><div class="chips">${helperChips.map(h => `<span class="chip">${h}</span>`).join('')}</div>` : ''}
      <label class="lbl">🕵️ Time Detective: how long will the WHOLE mission take?</label>
      <div class="chips" id="est">${[5, 10, 15, 20, 30, 45, 60].map(m => `<button class="chip ${t.est === m ? 'on' : ''}" data-est="${m}">${m} min</button>`).join('')}</div>
      <label class="lbl">⏱️ Sprint length</label>
      <div class="chips" id="len">${[5, 10, 15, 20].map(m => `<button class="chip ${m === sprint ? 'on' : ''}" data-len="${m}">${m} min</button>`).join('')}</div>
      <div class="spacer"></div>
      <button class="btn primary big" data-act="go">▶ Start</button>
      ${helpers.includes('move') ? `<div class="btn-row"><button class="btn ghost" data-act="movefirst">🤸 Move first (2 min), then start</button></div>` : ''}
    `, root => {
      let len = sprint;
      root.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.gear !== undefined) { b.classList.toggle('on'); Sfx.play('tap'); buzz(); }
        if (b.dataset.est) { t.est = +b.dataset.est; $$('#est .chip', root).forEach(c => c.classList.toggle('on', c === b)); }
        if (b.dataset.len) { len = +b.dataset.len; $$('#len .chip', root).forEach(c => c.classList.toggle('on', c === b)); }
        if (b.dataset.act === 'addgear') { const g = await ask('What else do you need?', { input: true, placeholder: 'e.g. calculator', ok: 'Add' }); if (g) { t.gear.push(g); save(); UI.closeSheet(); Focus.preflight(t.id); } }
        if (b.dataset.act === 'go') { UI.closeSheet(); Focus.start(t.id, len); }
        if (b.dataset.act === 'movefirst') { UI.closeSheet(); Focus.start(t.id, len, 'move'); }
      });
    });
  },

  start(taskId, minutes, mode = 'sprint') {
    const t = S.tasks.find(x => x.id === taskId); if (!t) return;
    const now = Date.now();
    const dur = mode === 'move' ? 2 : minutes;
    S.focus = { taskId, mode, planned: minutes, startAt: now, endAt: now + dur * 60e3, pausedAt: 0,
      stepIdx: Math.max(0, (t.steps || []).findIndex(s => !s.done)), nextCheck: this.nextCheckAt(now, dur), checks: 0, drifts: 0, warned: false };
    if (!t.firstStart) t.firstStart = now;
    t.pin = 0;
    save({ noSchedule: true });
    this.panel = null;
    Sfx.play('step'); buzz();
    Reminders.focusNotify(FOCUS_END_ID, new Date(S.focus.endAt), mode === 'sprint' ? '⏰ Sprint done!' : '⏰ Time’s up', mode === 'sprint' ? `Nice work on ${t.title}. Tap to see what’s next.` : 'Back to your mission!');
    this.render();
  },

  nextCheckAt(from, durMin) {
    const mode = S.settings.checkins;
    if (mode === 'off' || durMin < 4) return 0;
    if (mode === 'gentle') return from + durMin * 60e3 * (0.5 + Math.random() * 0.2);     // one check, mid-sprint
    return from + (2 + Math.random() * 3) * 60e3;                                         // every 2–5 min
  },

  remainingMs() {
    const f = S.focus; if (!f) return 0;
    const ref = f.pausedAt || Date.now();
    return Math.max(0, f.endAt - ref);
  },

  close(save_ = true) {
    clearInterval(this.timer); this.timer = null;
    Reminders.focusCancel(FOCUS_END_ID); Reminders.focusCancel(FOCUS_DRIFT_ID);
    S.focus = null; this.panel = null;
    $('#overlay').hidden = true; $('#overlay').innerHTML = '';
    if (save_) save();
    UI.render();
    if (UI._pendingLevel) { const a = UI._pendingLevel; UI._pendingLevel = null; setTimeout(() => UI.levelUp(...a), 400); }
  },

  bankMinutes() {
    const f = S.focus; const t = this.task(); if (!f || !t || f.mode === 'break' || f.mode === 'move') return 0;
    const end = Math.min(f.pausedAt || Date.now(), f.endAt);
    const min = Math.max(0, (end - f.startAt) / 60e3);
    t.focusMin = (t.focusMin || 0) + min; S.stats.focusMin += min;
    S.stats.sessions.push({ at: f.startAt, planned: f.planned, actual: Math.round(min * 10) / 10, hour: new Date(f.startAt).getHours(), drifts: f.drifts, completed: end >= f.endAt - 1000 });
    if (S.stats.sessions.length > 300) S.stats.sessions = S.stats.sessions.slice(-300);
    f.startAt = Date.now(); // prevents double-banking
    return min;
  },

  /* ---------- Render overlay */
  render() {
    const f = S.focus; const t = this.task();
    const ov = $('#overlay');
    if (!f || !t) { ov.hidden = true; return; }
    ov.hidden = false;
    const steps = t.steps || [];
    const cur = steps[f.stepIdx] && !steps[f.stepIdx].done ? steps[f.stepIdx] : steps.find(s => !s.done);
    const isBreak = f.mode === 'break' || f.mode === 'move';
    const label = f.mode === 'move' ? 'Move first!' : f.mode === 'break' ? 'Break time' : f.mode === 'mini' ? 'Mini-sprint' : 'Focus sprint';

    if (this.panel) { ov.innerHTML = this.panelHTML(t, cur); this.bindPanel(ov, t); return; }

    ov.innerHTML = `
      <div class="focus-top">
        <button class="iconbtn" data-f="exit" aria-label="Leave focus">✕</button>
        <span class="pill">${label}</span>
        <button class="iconbtn" data-f="park" aria-label="Park a thought">🅿️</button>
      </div>
      <div class="focus-title">${esc(t.emoji)} ${esc(t.title)}</div>
      <div class="focus-step">${isBreak ? esc(f.move || '') : cur ? `Now: <b>${esc(cur.text)}</b>` : (steps.length ? 'All steps done — finish it!' : '')}</div>
      <div class="timer-wrap">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="47" fill="var(--card)"/>
          <path id="wedge" fill="${isBreak ? 'var(--soft)' : 'var(--accent)'}" d=""/>
          <circle cx="50" cy="50" r="9" fill="var(--bg)"/>
        </svg>
      </div>
      <div class="center"><div class="timer-min" id="tmin"></div><div class="timer-lbl" id="tlbl"></div></div>
      ${S.profile.style.helpers.includes('someone') || S.profile.style.reward === 'buddy' ? `<div class="row focus-buddy" style="justify-content:center;margin-top:8px"><span class="buddy-mini">${buddyEmoji()}</span><span class="faint">${esc(S.profile.buddyName)} is working with you</span></div>` : ''}
      <div class="focus-actions">
        ${isBreak ? `<button class="btn primary big" data-f="back">🎯 Back to mission</button>` : `
          ${cur ? `<button class="btn primary big" data-f="step">✅ Step done</button>` : `<button class="btn primary big" data-f="finish">🏁 I finished the mission!</button>`}
          <div class="btn-row">
            <button class="btn" data-f="pause">${f.pausedAt ? '▶ Resume' : '⏸ Pause'}</button>
            <button class="btn" data-f="more">＋5 min</button>
            <button class="btn" data-f="stuck">😵 Stuck</button>
          </div>
          ${cur ? `<button class="btn ghost block" data-f="finish">🏁 Whole mission done</button>` : ''}`}
      </div>`;
    ov.onclick = e => { const b = e.target.closest('[data-f]'); if (b) this.act(b.dataset.f); };
    this.tick();
    clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 1000);
  },

  tick() {
    const f = S.focus; if (!f) { clearInterval(this.timer); return; }
    const rem = this.remainingMs();
    const total = (f.mode === 'move' ? 2 : f.mode === 'break' ? (f.breakMin || 3) : f.planned) * 60e3 + (f.extra || 0);
    const frac = clamp(rem / total, 0, 1);
    const w = $('#wedge');
    if (w) {
      if (frac >= 0.999) w.setAttribute('d', 'M50,3 A47,47 0 1,1 49.99,3 Z');
      else {
        const a = frac * 2 * Math.PI; const x = 50 + 47 * Math.sin(a), y = 50 - 47 * Math.cos(a);
        w.setAttribute('d', frac <= 0 ? '' : `M50,50 L50,3 A47,47 0 ${frac > .5 ? 1 : 0},1 ${x.toFixed(2)},${y.toFixed(2)} Z`);
      }
      const m = Math.ceil(rem / 60e3);
      $('#tmin').textContent = rem <= 0 ? '0' : rem < 60e3 ? '<1' : m;
      $('#tlbl').textContent = f.pausedAt ? 'PAUSED' : rem < 60e3 && rem > 0 ? 'almost there' : 'minutes left';
    }
    if (f.pausedAt || this.panel) return;
    // Transition warning: 1 minute left on a break.
    if ((f.mode === 'break') && rem < 60e3 && !f.warned) { f.warned = true; Sfx.play('check'); buzz(); UI.toast('1 minute left — get ready to jump back in!'); }
    if (f.nextCheck && Date.now() >= f.nextCheck && f.mode !== 'break' && f.mode !== 'move' && rem > 30e3) {
      f.checks++; f.nextCheck = S.settings.checkins === 'normal' ? Date.now() + (2 + Math.random() * 3) * 60e3 : 0;
      Sfx.play('check'); buzz(); this.panel = 'checkin'; this.render(); return;
    }
    if (rem <= 0) {
      if (f.mode === 'move') { Sfx.play('step'); const t = this.task(); this.start(t.id, f.planned); return; }
      if (f.mode === 'break') { Sfx.play('chime'); buzz('heavy'); this.panel = 'welcome'; this.render(); return; }
      this.bankMinutes(); award(XP.sprint); save({ noSchedule: true });
      Sfx.play('chime'); buzz('success'); this.panel = 'sprintEnd'; this.render();
    }
  },

  act(a) {
    const f = S.focus; const t = this.task(); if (!f || !t) return;
    const steps = t.steps || [];
    if (a === 'exit') {
      this.bankMinutes();
      this.close();
      UI.toast('Mission saved. Come back anytime 👋');
    }
    if (a === 'park') UI.parkSheet();
    if (a === 'pause') { if (f.pausedAt) { const d = Date.now() - f.pausedAt; f.endAt += d; if (f.nextCheck) f.nextCheck += d; f.pausedAt = 0; Reminders.focusNotify(FOCUS_END_ID, new Date(f.endAt), '⏰ Sprint done!', `Nice work on ${t.title}.`); } else { f.pausedAt = Date.now(); Reminders.focusCancel(FOCUS_END_ID); } save({ noSchedule: true }); this.render(); }
    if (a === 'more') { f.endAt += 5 * 60e3; f.extra = (f.extra || 0) + 5 * 60e3; Reminders.focusNotify(FOCUS_END_ID, new Date(f.endAt), '⏰ Sprint done!', `Nice work on ${t.title}.`); UI.toast('+5 minutes'); this.tick(); }
    if (a === 'step') {
      const cur = steps[f.stepIdx] && !steps[f.stepIdx].done ? steps[f.stepIdx] : steps.find(s => !s.done);
      if (cur) { cur.done = true; award(XP.step); Sfx.play('step'); buzz(); f.stepIdx = steps.findIndex(s => !s.done); markGoodDay(); save({ noSchedule: true }); }
      this.render();
      const el = $('.focus-step'); el && el.classList.add('pop');
    }
    if (a === 'finish') this.finish();
    if (a === 'stuck') { this.panel = 'stuck'; this.render(); }
    if (a === 'back') { this.start(t.id, f.planned); }
  },

  finish() {
    const f = S.focus; const t = this.task();
    this.bankMinutes();
    const actual = Math.max(1, Math.round(t.focusMin || 0));
    const res = completeTask(t, { fromFocus: true, actualMin: actual });
    Reminders.focusCancel(FOCUS_END_ID);
    this.celebrate = res; this.panel = 'complete';
    Sfx.play('done'); buzz('success'); confetti(1.2);
    this.render();
  },

  startBreak(min = 3) {
    const f = S.focus; if (!f) return;
    const now = Date.now();
    Object.assign(f, { mode: 'break', breakMin: min, startAt: now, endAt: now + min * 60e3, pausedAt: 0, warned: false, move: '🤸 Try: ' + pick(MOVES), nextCheck: 0, extra: 0 });
    Reminders.focusNotify(FOCUS_END_ID, new Date(f.endAt), '🎯 Break’s over!', 'Jump back into your mission.');
    this.panel = null; save({ noSchedule: true }); this.render();
  },

  /* ---------- Panels */
  panelHTML(t, cur) {
    const name = esc(S.profile.buddyName);
    const step = cur ? esc(cur.text) : (t.steps || []).length ? 'Finish it up!' : 'Do the very first tiny part';
    switch (this.panel) {
      case 'checkin': return `
        <div class="big-emoji">👀</div>
        <h1 class="center">Quick check!</h1>
        <p class="center sub">Were you working on <b>${esc(t.title)}</b> just now?<br>Honest answers earn a point either way.</p>
        <div class="focus-actions">
          <button class="btn primary big" data-p="yes">👍 Yep, on it</button>
          <button class="btn big" data-p="drift">🌀 I drifted</button>
        </div>`;
      case 'welcome': return `
        <div class="big-emoji">${buddyEmoji()}</div>
        <h1 class="center">Welcome back!</h1>
        <p class="center sub">${esc(pick(BUDDY_LINES.drift))}</p>
        <div class="card center"><div class="faint">Your mission</div><div style="font-size:22px;font-weight:800">${esc(t.emoji)} ${esc(t.title)}</div>
          <div class="sub" style="margin-top:6px">Tiny next step: <b>${step}</b></div></div>
        <div class="focus-actions">
          <button class="btn primary big" data-p="resume">🎯 Jump back in</button>
          <button class="btn" data-p="mini">⚡ Restart with a 5-min mini-sprint</button>
        </div>`;
      case 'refocus': return `
        <div class="breathe">breathe</div>
        <h1 class="center">You noticed. That’s the skill. 🧠</h1>
        <p class="center sub">${esc(pick(BUDDY_LINES.drift))}</p>
        <div class="card center"><div class="faint">Your mission</div><div style="font-size:22px;font-weight:800">${esc(t.emoji)} ${esc(t.title)}</div>
          <div class="sub" style="margin-top:6px">Tiny next step: <b>${step}</b></div></div>
        <div class="focus-actions">
          <button class="btn primary big" data-p="resume">🎯 Back to it</button>
          <div class="btn-row"><button class="btn" data-p="mini">⚡ 5-min mini-sprint</button><button class="btn" data-p="park">🅿️ Park the distraction</button></div>
          <button class="btn ghost" data-p="stuck">😵 It’s too hard right now</button>
        </div>`;
      case 'stuck': return `
        <div class="big-emoji">🧩</div>
        <h1 class="center">Stuck? Totally normal.</h1>
        <p class="center sub">Pick one way to get unstuck:</p>
        <div class="focus-actions" style="margin-top:12px">
          <button class="list-btn" data-p="smaller"><span class="em">🔪</span>Chop it into tiny steps<span class="chev">›</span></button>
          <button class="list-btn" data-p="two"><span class="em">⏱️</span>Just do 2 minutes<span class="chev">›</span></button>
          <button class="list-btn" data-p="move"><span class="em">🤸</span>Move for 2 minutes, then retry<span class="chev">›</span></button>
          <button class="list-btn" data-p="help"><span class="em">🙋</span>Ask a grown-up for help<span class="chev">›</span></button>
          <button class="list-btn" data-p="swap"><span class="em">🔄</span>Swap for an easier mission<span class="chev">›</span></button>
          <button class="btn ghost" data-p="resume">← Back</button>
        </div>`;
      case 'sprintEnd': return `
        <div class="big-emoji pop">⏰</div>
        <h1 class="center">Sprint done! +${XP.sprint} XP</h1>
        <p class="center sub">You stuck with <b>${esc(t.title)}</b>. What now?</p>
        <div class="focus-actions">
          <button class="btn primary big" data-p="finish">🏁 Mission finished!</button>
          <button class="btn big" data-p="break">🧃 3-min break, then keep going</button>
          <div class="btn-row"><button class="btn" data-p="again">🔁 Another sprint</button><button class="btn" data-p="later">💾 Save for later</button></div>
        </div>`;
      case 'complete': {
        const r = this.celebrate || { total: 0, parts: [] };
        const nxt = todayQueue().find(x => x.id !== t.id);
        return `
        <div class="big-emoji pop">${buddyEmoji()}</div>
        <h1 class="center">${esc(pick(BUDDY_LINES.done))}</h1>
        <p class="center" style="font-size:22px;font-weight:800;color:var(--accent2)">+${r.total} XP</p>
        <p class="center faint">${r.parts.map(esc).join(' · ')}</p>
        ${r.estimateMsg ? `<div class="card soft center">${esc(r.estimateMsg)}</div>` : ''}
        ${r.chest ? `<div class="card center pop" style="border:2px solid var(--accent2)"><div style="font-size:40px">🎁</div><b>Surprise chest!</b><div>${esc(r.chest.text)}</div></div>` : ''}
        <div class="focus-actions">
          ${nxt ? `<div class="card soft"><div class="faint">Next up</div><b>${esc(nxt.emoji)} ${esc(nxt.title)}</b></div>
            <button class="btn primary big" data-p="next" data-id="${nxt.id}">▶ Start next</button>
            <button class="btn" data-p="breaknext">🧃 Short break first</button>` : ''}
          <button class="btn ${nxt ? 'ghost' : 'primary big'}" data-p="close">${nxt ? 'Done for now' : '🎉 All done — go have fun!'}</button>
        </div>`;
      }
    }
    return '';
  },

  bindPanel(ov, t) {
    ov.onclick = e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      const p = b.dataset.p; const f = S.focus;
      Sfx.play('tap');
      if (p === 'yes') { award(XP.checkin); this.panel = null; UI.toast('👍 Locked in! +1'); save({ noSchedule: true }); this.render(); }
      if (p === 'drift') { award(XP.checkin); f.drifts++; this.panel = 'refocus'; save({ noSchedule: true }); this.render(); }
      if (p === 'resume') { this.panel = null; if (f.mode === 'break') { this.start(t.id, f.planned); return; } this.render(); }
      if (p === 'mini') { this.bankMinutes(); this.start(t.id, 5, 'mini'); }
      if (p === 'park') UI.parkSheet(() => { this.panel = null; this.render(); });
      if (p === 'stuck') { this.panel = 'stuck'; this.render(); }
      if (p === 'smaller') {
        const fresh = suggestSteps(t.title, true).map(text => ({ id: uid(), text, done: false }));
        const old = (t.steps || []).filter(s => s.done);
        t.steps = old.concat(fresh); f.stepIdx = t.steps.findIndex(s => !s.done);
        save({ noSchedule: true }); this.panel = null; UI.toast('Chopped into tiny steps 🔪'); this.render();
      }
      if (p === 'two') { this.bankMinutes(); this.start(t.id, 2, 'mini'); UI.toast('Just 2 minutes. You can stop after — or keep going.'); }
      if (p === 'move') { this.bankMinutes(); f.planned = f.planned || 5; this.start(t.id, f.planned, 'move'); }
      if (p === 'help') { S.parking.unshift({ id: uid(), text: `🙋 Need help with: ${t.title}`, at: Date.now() }); save({ noSchedule: true }); this.panel = null; UI.toast('Added to your Parking Lot. Go ask a grown-up — that’s a pro move!'); this.render(); }
      if (p === 'swap') {
        const easier = todayQueue().filter(x => x.id !== t.id).sort((a, b) => ({ tiny: 0, small: 1, big: 2, boss: 3 }[a.size] - { tiny: 0, small: 1, big: 2, boss: 3 }[b.size]))[0];
        this.bankMinutes();
        if (easier) { this.start(easier.id, Math.min(S.profile.style.sprint, 10)); UI.toast(`Swapped to: ${easier.title}`); }
        else { this.close(); UI.toast('No other missions — try a 2-minute start instead!'); }
      }
      if (p === 'finish') this.finish();
      if (p === 'break') this.startBreak(3);
      if (p === 'breaknext') { const nxt = todayQueue()[0]; if (nxt) { S.focus.taskId = nxt.id; this.startBreak(3); } else this.close(); }
      if (p === 'again') this.start(t.id, f.planned);
      if (p === 'later') { this.close(); UI.toast('Saved. Your progress is kept 💾'); }
      if (p === 'next') { const id = b.dataset.id; this.close(false); save(); Focus.preflight(id); }
      if (p === 'close') this.close();
    };
  },

  /* Leaving the app mid-sprint: schedule a gentle "still there?" and greet on return. */
  onVisibility() {
    const f = S.focus; if (!f || f.pausedAt || f.mode === 'break') return;
    const t = this.task(); if (!t) return;
    if (document.hidden) {
      this.hiddenAt = Date.now();
      Reminders.focusNotify(FOCUS_DRIFT_ID, new Date(Date.now() + 90e3), `👀 Still on ${t.title}?`, 'Tap to jump back in. Your timer is still running.');
    } else {
      Reminders.focusCancel(FOCUS_DRIFT_ID);
      const away = Date.now() - this.hiddenAt;
      if (this.hiddenAt && away > 60e3 && this.remainingMs() > 0 && !this.panel) { f.drifts++; this.panel = 'welcome'; this.render(); }
      this.hiddenAt = 0;
    }
  },
};

function anchorText(a) {
  return { afterschool: 'When I get home from school', aftersnack: 'When I finish my snack', afterdinner: 'When dinner is done', beforebed: 'Before bedtime routine', morning: 'After breakfast' }[a] || a;
}
