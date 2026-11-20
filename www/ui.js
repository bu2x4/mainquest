'use strict';
/* MainQuest UI: views, sheets, onboarding, parent zone. */

const UI = {
  tab: 'home',
  quizStep: 0,
  quizAns: {},
  go(tab) { this.tab = tab; this.render(); $('#view').scrollTop = 0; },

  render() {
    const th = THEMES.find(t => t.id === S.player.theme) || THEMES[0];
    document.documentElement.style.setProperty('--accent', th.accent);
    document.documentElement.style.setProperty('--accent-ink', th.ink);
    document.body.className = [S.settings.light ? 'light' : '', S.settings.calm ? 'calm' : '', S.settings.bigtext ? 'bigtext' : '', S.settings.dyslexic ? 'dyslexic' : ''].join(' ');
    if (!S.profile.onboarded) { $('#tabs').hidden = true; $('#orient').innerHTML = ''; this.onboarding(); return; }
    ensureSeason(); ensureWeekly();
    $('#tabs').hidden = false;
    $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === this.tab));
    this.orient();
    const v = $('#view');
    v.innerHTML = this.tab === 'calendar' ? Cal.view() : this.tab === 'school' ? School.view() : this['view_' + this.tab]();
    School.loadThumbs(v);
    if (S.focus && $('#overlay').hidden) Focus.render();
  },

  /* ---------- HUD: time, day, what's next, player chip */
  orient() {
    const now = new Date();
    const ev = upcomingEvents(now, 18)[0];
    const lvl = levelFor(S.stats.xp), rk = rankFor(lvl), [lo, hi] = levelBounds(lvl);
    let next = '';
    if (ev) {
      const mins = (ev.at - now) / 60e3; const frac = clamp(1 - mins / 180, 0.03, 1);
      next = `<div class="o-next"><span>Next: <b>${esc(ev.title)}</b> in ${fmtDur(mins)}</span><div class="o-bar"><i style="width:${(frac * 100).toFixed(0)}%"></i></div></div>`;
    }
    $('#orient').innerHTML = `<div class="o-row"><div><span class="o-time">${fmtTime(now)}</span> <span class="o-day">${now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
      <button class="pchip" data-tab="me" aria-label="Profile">${emblemSVG(S.player.emblem, S.player.color, 30)}<span><b>Lv ${lvl}</b><small style="color:${rk.color}">${rk.name} ${rk.div}</small></span><i class="pbar"><i style="width:${((S.stats.xp - lo) / (hi - lo) * 100).toFixed(0)}%"></i></i></button></div>${next}`;
    $('#orient .pchip').onclick = () => this.go('me');
  },

  /* ================================================================ HOME */  timeBudget(q) {
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

  /* ================================================================ MISSIONS */  view_routines() {
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
        if (b.dataset.x === 'toggle') { const it = r.items.find(i => i.id === b.dataset.i); if (it && it.action === 'scan' && !(r.log[today()] || []).includes(it.id)) { this.closeSheet(); return School.scan(); } this.toggleRoutineItem(r, b.dataset.i); this.openRoutine(id); }
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
    if (itemId === 'r-bed-0') S.stats.loadout++;
    if (arr.length >= r.items.length) { track('routine:' + r.id); if (r.id === 'r-sunday') unlockAch('gameplan'); award(XP.routineAll); Sfx.play('done'); confetti(0.7); buzz('success'); this.toast(`${r.name}: cleared. +${XP.routineAll + XP.routineItem} XP`); }
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
    const lvl = levelFor(S.stats.xp), rk = rankFor(lvl), [lo, hi] = levelBounds(lvl);
    const P = S.player; const banner = BANNERS.find(b => b.id === P.banner) || BANNERS[0];
    const title = TITLES.find(t => t.id === P.title) || TITLES[0];
    const tier = seasonTier(); const ins = this.statsSummary();
    const pending = S.redemptions.filter(r => r.status === 'pending');
    const daysLeft = Math.max(0, Math.ceil((seasonEnds() - Date.now()) / 864e5));
    return `
      <div class="pcard" style="background:${banner.css}">
        <div class="row">${emblemSVG(P.emblem, P.color, 64)}<div class="grow"><div class="ptag">${esc(P.tag || 'Player')}</div><div class="ptitle">${esc(title.name)}</div></div>
          <div class="rank" style="--rc:${rk.color}"><b>${rk.name}</b><small>${rk.div}</small></div></div>
        <div class="row" style="margin-top:14px;justify-content:space-between"><span class="faint">Level ${lvl}</span><span class="faint">${S.stats.xp - lo}/${hi - lo} XP</span></div>
        <div class="bar"><i style="width:${((S.stats.xp - lo) / (hi - lo) * 100).toFixed(0)}%"></i></div>
        <div class="row" style="margin-top:10px;gap:8px">${S.boosts ? `<span class="pill gold">${S.boosts}× 2XP boost</span>` : ''}<span class="pill">🪙 ${S.stats.coins}</span><button class="btn small ghost" data-a="customize" style="margin-left:auto">Customize</button></div>
      </div>
      <div class="grid3">
        <div class="card stat"><b>${S.stats.missions}</b><span class="faint">cleared</span></div>
        <div class="card stat"><b>${S.stats.bossesDown}</b><span class="faint">bosses</span></div>
        <div class="card stat"><b>${fmtDur(S.stats.focusMin)}</b><span class="faint">focused</span></div>
      </div>

      <h2>Season ${S.season.id} <span class="faint">· ${daysLeft} days left · tier ${tier}/${SEASON_TRACK.length - 1}</span></h2>
      <div class="card"><div class="bar"><i style="width:${Math.min(100, (S.season.xp % SEASON_TIER_XP) / SEASON_TIER_XP * 100)}%"></i></div>
        <div class="faint" style="margin:6px 0 10px">${S.season.xp} season XP · next tier at ${(tier + 1) * SEASON_TIER_XP}</div>
        <div class="track">${SEASON_TRACK.map((r, i) => { if (!r) return ''; const got = S.season.claimed.includes(i), can = i <= tier && !got;
          const label = r.banner ? 'Banner' : r.theme ? 'Theme' : r.color ? 'Color' : r.title ? 'Title' : r.boost ? `${r.boost}× 2XP` : '';
          return `<button class="tier ${got ? 'got' : can ? 'can' : ''}" data-a="claim" data-k="${i}" ${can ? '' : 'disabled'}><small>${i}</small><span>${got ? '✓' : can ? '🎁' : '🔒'}</span><em>${label}</em></button>`; }).join('')}</div>
        <p class="faint" style="margin:8px 0 0">Free track. Anything you unlock is yours forever.</p></div>

      <h2>Achievements · ${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length}</h2>
      <div class="ach-grid">${ACHIEVEMENTS.map(a => `<div class="ach ${S.achievements[a.id] ? 'on' : ''}" title="${esc(a.desc)}"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join('')}</div>

      <h2>Rewards <span class="pill gold">🪙 ${S.stats.coins}</span></h2>
      ${S.rewards.map(r => `<div class="task"><span class="em">${esc(r.emoji)}</span><div class="grow"><div class="t">${esc(r.name)}</div><div class="meta">🪙 ${r.cost}</div></div>
        <button class="btn small ${S.stats.coins >= r.cost ? 'gold' : ''}" data-a="redeem" data-id="${r.id}" ${S.stats.coins >= r.cost ? '' : 'disabled'}>${S.stats.coins >= r.cost ? 'Redeem' : `${r.cost - S.stats.coins} to go`}</button></div>`).join('')}
      ${pending.length ? `<p class="faint">Waiting on a grown-up: ${pending.map(p => esc(p.name)).join(', ')}</p>` : ''}
      <button class="btn ghost block" data-a="wish">Suggest a reward</button>

      <h2>My style</h2>
      <div class="card">
        <div class="row wrap" style="gap:8px">
          <span class="pill">${{ morning: 'Morning brain', afterschool: 'After-school brain', evening: 'Evening brain', unsure: 'Best time: TBD' }[S.profile.style.peak]}</span>
          <span class="pill">${S.profile.style.sprint}-min sprints</span>
          <span class="pill">${{ easy: 'Warm-up first', hard: 'Hardest first', spin: 'Spin to pick' }[S.profile.style.start]}</span>
          <span class="pill">Grade ${P.grade}</span>
        </div>
        ${ins.length ? `<div style="margin-top:12px">${ins.map(i => `<div class="sub" style="margin:6px 0">• ${esc(i)}</div>`).join('')}</div>` : `<p class="faint">Clear a few missions and the app learns what works for you.</p>`}
        <button class="btn small" data-a="retake" style="margin-top:8px">Retake style quiz</button>
      </div>

      <h2>Settings</h2>
      ${[['sound', 'Sounds'], ['haptics', 'Vibration'], ['calm', 'Calm mode (no animations)'], ['light', 'Light mode'], ['bigtext', 'Bigger text'], ['dyslexic', 'Extra letter spacing']].map(([k, l]) =>
        `<div class="list-btn" data-a="toggle" data-k="${k}">${l}<span class="switch ${S.settings[k] ? 'on' : ''}" style="margin-left:auto"></span></div>`).join('')}
      <button class="list-btn" data-a="checkins">Focus check-ins: <b style="margin-left:6px">${{ off: 'Off', gentle: 'Once per sprint', normal: 'Every few minutes' }[S.settings.checkins]}</b><span class="chev">›</span></button>
      <button class="list-btn" data-a="notifs">Reminders &amp; notifications<span class="chev">›</span></button>
      <button class="list-btn" data-a="parent">Grown-up zone<span class="chev">›</span></button>
      <p class="faint center" style="margin-top:16px">Grown-ups see: missions cleared, what’s due, focus minutes. Not your parking lot.${S.settings.parentSeen ? `<br>Last grown-up check: ${new Date(S.settings.parentSeen).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</p>`;
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

  /* Style alignment from real behaviour: suggest, never force. */  insights() {
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

  /* ================================================================ Sheets & toasts */  sheet(html, bind) {
    const w = $('#sheet-wrap'), s = $('#sheet');
    s.innerHTML = html; w.hidden = false;
    w.onclick = e => { if (e.target === w) this.closeSheet(); };
    bind && bind(s);
    const first = s.querySelector('input:not([type=time]):not([type=date])'); if (first && first.dataset.autofocus) first.focus();
  },  closeSheet() { $('#sheet-wrap').hidden = true; $('#sheet').innerHTML = ''; const r = this._ret; if (r) { this._ret = null; setTimeout(r, 0); } },  toast(msg, action, fn, ms = 2600) {
    const el = $('#toast'); el.innerHTML = esc(msg) + (action ? ` <button>${esc(action)}</button>` : ''); el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; fn(); };
    clearTimeout(this._tt); this._tt = setTimeout(() => { el.hidden = true; }, action ? 6000 : ms);
  },  banner(o) {
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

  levelUp(lvl, rankUp, fresh) {
    if (S.focus) { this._pendingLevel = [lvl, rankUp || (this._pendingLevel || [])[1], (fresh || []).concat((this._pendingLevel || [])[2] || [])]; return; }
    const rk = rankFor(lvl);
    Sfx.play('level'); buzz('success'); confetti(1.4);
    this.sheet(`<div class="grab"></div><div class="center pop">${emblemSVG(S.player.emblem, S.player.color, 84)}</div>
      <h3 class="center">${rankUp ? `Rank up: ${rk.name} ${rk.div}` : `Level ${lvl}`}</h3>
      <p class="center sub">${rankUp ? 'Earned, not given.' : 'Keep stacking.'}</p>
      ${fresh && fresh.length ? `<p class="center">Unlocked: <b>${fresh.map(esc).join(', ')}</b></p>` : ''}
      <button class="btn primary block" data-x="ok">Nice</button>`, root => { root.onclick = e => { if (e.target.closest('[data-x]')) { this.closeSheet(); this.render(); } }; });
  },

  finishQuick(t) {
    const res = completeTask(t);
    if (!res) return;
    Sfx.play('done'); buzz('success'); confetti(0.8);
    this.render();
    const left = todayQueue().length;
    this.toast(`${pick(LINES.done)} +${res.total} XP${res.bossMsg ? ' · ' + res.bossMsg : ''}${res.drop ? ' · ' + res.drop.text : ''}${left ? ` · ${left} left` : ''}`, 'Undo', () => {
      t.done = false; t.doneAt = null; S.stats.missions--; S.stats.xp = Math.max(0, S.stats.xp - res.total); S.stats.coins = Math.max(0, S.stats.coins - res.total); save(); this.render();
    });
  },

  /* ================================================================ Onboarding (~2 min) */  parkSheet(cb) {
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

  /* ---------- Task details */  taskSheet(t) {
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
        if (x === 'delete') { const copy = { ...t }; if (t.gcalId) { S.gdeletes.push(t.gcalId); GSync.soon(); } S.tasks = S.tasks.filter(o => o.id !== t.id); save(); this.closeSheet(); this.render(); this.toast('Deleted', 'Undo', () => { S.tasks.push(copy); save(); this.render(); }); }
      };
    });
    draw();
  },  saveTask(t) { if (!S.tasks.includes(t)) S.tasks.push(t); save(); },

  /* ---------- Rolling 7-day planner: plan any of the next 7 days without opening the calendar */
  planSheet(dk = null) {
    const N = APP_CONFIG.planDays || 7;
    const days = Array.from({ length: N }, (_, i) => dayKey(addDays(new Date(), i)));
    if (!dk || !days.includes(dk)) dk = this._planDay && days.includes(this._planDay) ? this._planDay : days[0];
    this._planDay = dk;
    const idx = days.indexOf(dk);
    const d = new Date(dk + 'T12:00');
    const wd = d.getDay();
    const it = itemsOn(dk);
    const planned = S.tasks.filter(t => !t.done && t.date === dk && t.when !== 'later').sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
    const pullable = S.tasks.filter(t => !t.done && (t.when === 'later' || (t.date && t.date < today())) && !t.assignmentId);
    const routines = S.routines.filter(r => r.days.includes(wd));
    const anchors = ['', 'afterschool', 'aftersnack', 'afterdinner', 'beforebed'];
    const short = { '': 'Any time', afterschool: 'After school', aftersnack: 'After snack', afterdinner: 'After dinner', beforebed: 'Before bed' };
    const load = k => S.tasks.filter(t => !t.done && t.date === k && t.when !== 'later').length + S.assignments.filter(a => a.due === k && a.status !== 'done').length + S.events.filter(e => e.date === k).length;
    const dayName = dk === today() ? 'Today' : idx === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long' });
    this.sheet(`<div class="grab"></div>
      <div class="row" style="justify-content:space-between"><h3 style="margin:0">Plan ahead</h3><span class="faint">next ${N} days</span></div>
      <div class="plan-strip">${days.map((k, i) => { const dd = new Date(k + 'T12:00'); const n = load(k);
        return `<button class="pday ${k === dk ? 'on' : ''}" data-x="day" data-k="${k}"><small>${i === 0 ? 'Today' : dd.toLocaleDateString(undefined, { weekday: 'short' })}</small><b>${dd.getDate()}</b><span class="pdots">${Array.from({ length: Math.min(n, 4) }, () => '<i></i>').join('')}</span></button>`; }).join('')}</div>
      <div class="plan-nav"><button class="iconbtn" data-x="prev" aria-label="Previous day">‹</button>
        <div class="grow center"><div class="plan-day">${esc(dayName)}</div><div class="faint">${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</div></div>
        <button class="iconbtn" data-x="next" aria-label="Next day">›</button></div>

      ${it.events.length || it.google.length || it.due.length || routines.length ? `<div class="card soft plan-fixed">
        ${it.events.map(e => `<div class="pf"><span class="pf-t">${e.time ? fmtHM(e.time) : 'All day'}</span>${esc(e.title)}</div>`).join('')}
        ${it.google.map(g => `<div class="pf"><span class="pf-t" style="color:${g.color}">${g.time ? fmtHM(g.time) : 'All day'}</span>${esc(g.title)}${g.selfStatus === 'invited' && !g.isOrganizer ? ' · invite' : ''}</div>`).join('')}
        ${it.due.map(a => `<div class="pf"><span class="pf-t" style="color:${subj(a.subject).color}">${a.type === 'test' || a.type === 'quiz' ? atype(a.type).name : 'Due'}</span>${esc(a.title)}${a.status === 'done' ? ' ✓' : ''}</div>`).join('')}
        ${routines.length ? `<div class="pf faint"><span class="pf-t">Routines</span>${routines.map(r => esc(r.name)).join(' · ')}</div>` : ''}
      </div>` : ''}

      <label class="lbl">Missions for ${esc(dayName.toLowerCase() === 'today' ? 'today' : dayName)} · ${planned.length}${planned.length > 3 ? ' <span class="faint">— heavy day; consider moving one</span>' : ''}</label>
      ${planned.length ? planned.map(t => `<div class="task plan-task">
        <span class="em">${esc(t.emoji)}</span>
        <div class="grow"><div class="t" style="font-size:16px">${esc(t.title)}</div>
          <button class="chip anchor-chip" data-x="anchor" data-id="${t.id}">${t.time && !t.anchor ? fmtHM(t.time) : esc(short[t.anchor || ''])}</button></div>
        <button class="iconbtn sm" data-x="mv" data-id="${t.id}" data-k="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Move earlier">‹</button>
        <button class="iconbtn sm" data-x="mv" data-id="${t.id}" data-k="1" aria-label="Move later">›</button>
        <button class="iconbtn sm" data-x="park" data-id="${t.id}" aria-label="Move to Later">✕</button></div>`).join('')
        : `<div class="card soft center sub" style="margin-bottom:8px">Nothing planned yet.</div>`}

      <div class="quickadd" style="margin-top:6px"><input id="pl-add" placeholder="Add to ${esc(dayName === 'Today' ? 'today' : dayName)} — e.g. “read at 7pm”" enterkeyhint="done" autocomplete="off"><button class="iconbtn" data-x="add" aria-label="Add">＋</button></div>
      <div class="add-grid three"><button class="btn small" data-x="due">📌 Due / test</button><button class="btn small" data-x="study">📚 Study block</button><button class="btn small" data-x="event">📅 Event</button></div>

      ${pullable.length ? `<label class="lbl">Pull in from Later</label>${pullable.slice(0, 8).map(t => `<button class="list-btn" data-x="pull" data-id="${t.id}"><span class="em">${esc(t.emoji)}</span><span class="grow">${esc(t.title)}</span><span class="faint">＋ ${esc(dayName === 'Today' ? 'today' : dayName.slice(0, 3))}</span></button>`).join('')}` : ''}
      <div class="spacer"></div><button class="btn primary block" data-x="done">Done</button>`, root => {
      const input = $('#pl-add', root);
      const addTyped = () => { const v = input.value.trim(); if (!v) return; const { title, extra } = parseQuick(v); delete extra.when; const t = newTask(title, { ...extra, date: dk }); S.tasks.push(t); save(); Sfx.play('coin'); this.planSheet(dk); setTimeout(() => { const i = $('#pl-add'); i && i.focus(); }, 30); };
      input.onkeydown = e => { if (e.key === 'Enter') addTyped(); };
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x; const t = b.dataset.id && S.tasks.find(y => y.id === b.dataset.id);
        if (x === 'day') { Sfx.play('tap'); return this.planSheet(b.dataset.k); }
        if (x === 'prev' || x === 'next') { const n = (idx + (x === 'next' ? 1 : -1) + N) % N; Sfx.play('tap'); return this.planSheet(days[n]); }
        if (x === 'add') return addTyped();
        if (x === 'anchor') { const i = anchors.indexOf(t.anchor || ''); const nx = anchors[(i + 1) % anchors.length]; t.anchor = nx; t.time = nx ? anchorTime(nx) : ''; save(); return this.planSheet(dk); }
        if (x === 'mv') { const ni = idx + +b.dataset.k; t.date = dayKey(addDays(new Date(dk + 'T12:00'), +b.dataset.k)); t.when = 'today'; save(); this.toast(`Moved to ${ni === 0 ? 'today' : ni === 1 ? 'tomorrow' : new Date(t.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long' })}`); return this.planSheet(dk); }
        if (x === 'park') { t.when = 'later'; t.date = null; t.time = ''; t.anchor = ''; save(); this.toast('Moved to Later'); return this.planSheet(dk); }
        if (x === 'pull') { t.when = 'today'; t.date = dk; t.parkedAuto = false; save(); Sfx.play('coin'); return this.planSheet(dk); }
        if (x === 'due') { this._ret = () => this.planSheet(dk); return School.assignmentSheet(null, { due: dk === today() ? dayKey(addDays(new Date(), 1)) : dk }); }
        if (x === 'study') { this._ret = () => this.planSheet(dk); return Cal.studySheet(dk); }
        if (x === 'event') { this._ret = () => this.planSheet(dk); return Cal.eventSheet(null, dk); }
        if (x === 'done') { track('plan'); this._planDay = null; this.closeSheet(); this.render(); this.toast('Plan locked. One at a time.'); }
      };
    });
  },

  /* ---------- Quick add with tiny natural-language parsing */  quickAdd(text) {
    text = (text || '').trim(); if (!text) return;
    const { title, extra } = parseQuick(text);
    const t = newTask(title, extra);
    S.tasks.push(t); save(); Sfx.play('coin'); buzz();
    this.render();
    this.toast(`Added ${t.title}${t.date && t.date !== today() ? ' · ' + dueLabel(t.date) : ''}${t.time ? ' · ' + fmtHM(t.time) : ''}`, 'Details', () => this.taskSheet(t));
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
      A.emblem = A.emblem || 'bolt'; A.color = A.color || '#7dff8a';
      html = `<div class="center" style="margin-top:20px">${emblemSVG(A.emblem, A.color, 72)}</div><h1 class="center">MainQuest</h1>
        <p class="center sub">Your planner, built like a game. One mission at a time.</p>
        <label class="lbl">Gamertag</label><input class="field" id="ob-name" value="${esc(A.name || '')}" placeholder="What should we call you?" autocomplete="off" maxlength="18">
        <label class="lbl">Grade</label><div class="chips">${[5, 6, 7, 8, 9].map(g => `<button class="chip ${A.grade === g ? 'on' : ''}" data-o="grade" data-k="${g}">${g}th</button>`).join('')}</div>
        <label class="lbl">Emblem</label><div class="emb-grid">${Object.keys(EMBLEMS).map(k => `<button class="emb ${A.emblem === k ? 'on' : ''}" data-o="emb" data-k="${k}">${emblemSVG(k, A.color, 36, false)}</button>`).join('')}</div>
        <div class="chips" style="margin-top:10px">${EMBLEM_COLORS.slice(0, 6).map(c => `<button class="swatch-btn ${A.color === c ? 'on' : ''}" data-o="col" data-k="${c}" style="background:${c}" aria-label="color"></button>`).join('')}</div>
        <div class="spacer"></div><button class="btn primary big" data-o="next">Next →</button>
        <p class="faint center">6 quick questions so it fits how your brain works.</p>`;
    } else if (step <= QUIZ.length) {
      const q = QUIZ[step - 1]; const cur = A[q.k];
      html = `${prog}<h1>${esc(q.q)}</h1>${q.opts.map(([val, em, label], i) => {
        const on = q.multi ? (cur || []).includes(val) : cur === val && A[q.k + '_i'] === i;
        return `<button class="q-opt ${on ? 'on' : ''}" data-o="opt" data-i="${i}"><span class="em">${em}</span>${esc(label)}</button>`; }).join('')}
        ${q.multi ? `<button class="btn primary big" data-o="next">Next →</button>` : ''}
        <button class="btn ghost block" data-o="back" style="margin-top:8px">← Back</button>`;
    } else if (step === QUIZ.length + 1) {
      html = `${prog}<h1 class="center">Turn on reminders?</h1>
        <p class="center sub">A heads-up before things start, what’s due tomorrow, and a nudge if you drift. No spam.</p>
        <div class="spacer"></div><button class="btn primary big" data-o="notif">Turn on</button>
        <button class="btn ghost block" data-o="next" style="margin-top:8px">Later</button>`;
    } else if (step === QUIZ.length + 2) {
      html = `${prog}<h1>Anything due soon?</h1><p class="sub">Add homework, a test, or a project. Tests and projects become boss fights with a study plan on your calendar.</p>
        <button class="btn primary big block" data-o="assign">＋ Add something due</button>
        <div id="ob-list">${(S.assignments || []).map(a => `<div class="task"><span class="em">${atype(a.type).icon}</span><div class="grow"><div class="t">${esc(a.title)}</div><div class="meta">${dueLabel(a.due)}</div></div></div>`).join('')}</div>
        <div class="spacer"></div><button class="btn big block" data-o="next">${S.assignments.length ? 'Next →' : 'Skip for now'}</button>`;
    } else {
      html = `${prog}<div class="center" style="margin-top:20px">${emblemSVG(A.emblem, A.color, 72)}</div><h1 class="center">You’re set, ${esc(A.name || 'player')}</h1>
        <p class="center sub">Tip: after school, scan your papers in the School tab. MainQuest finds due dates and builds flashcards from them.</p>
        <div class="spacer"></div><button class="btn primary big block" data-o="finish">Start</button>`;
    }
    v.innerHTML = html; v.onclick = null;
    const keep = () => { const n = $('#ob-name'); if (n) A.name = n.value.trim(); };
    v.querySelectorAll('[data-o]').forEach(btn => btn.onclick = async () => {
      keep(); const o = btn.dataset.o;
      if (o === 'grade') { A.grade = +btn.dataset.k; return this.onboarding(); }
      if (o === 'emb') { A.emblem = btn.dataset.k; return this.onboarding(); }
      if (o === 'col') { A.color = btn.dataset.k; return this.onboarding(); }
      if (o === 'next') { if (step === 0 && !A.grade) A.grade = S.player.grade || 5; this.quizStep++; return this.onboarding(); }
      if (o === 'back') { this.quizStep = Math.max(0, this.quizStep - 1); return this.onboarding(); }
      if (o === 'opt') {
        const q = QUIZ[step - 1]; const [val] = q.opts[+btn.dataset.i]; Sfx.play('tap'); buzz();
        if (q.multi) { const arr = A[q.k] || []; A[q.k] = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; return this.onboarding(); }
        A[q.k] = val; A[q.k + '_i'] = +btn.dataset.i; btn.classList.add('on'); setTimeout(() => { this.quizStep++; this.onboarding(); }, 220); return;
      }
      if (o === 'notif') { await Reminders.ask(); this.quizStep++; return this.onboarding(); }
      if (o === 'assign') { S.player.grade = A.grade || 5; School.assignmentSheet(); const obs = new MutationObserver(() => { if ($('#sheet-wrap').hidden) { obs.disconnect(); if (!S.profile.onboarded) this.onboarding(); } }); obs.observe($('#sheet-wrap'), { attributes: true }); return; }
      if (o === 'finish') {
        const st = S.profile.style; QUIZ.forEach(q => { if (A[q.k] !== undefined) st[q.k] = A[q.k]; });
        Object.assign(S.player, { tag: A.name || S.player.tag || 'Player', grade: A.grade || S.player.grade || 5, emblem: A.emblem, color: A.color });
        S.profile.onboarded = true;
        const wasRetake = this._retake; this._retake = false;
        if (!wasRetake) award(15);
        save(); this.tab = wasRetake ? 'me' : 'home'; this.render();
        this.toast(wasRetake ? 'Style updated' : 'Welcome in. +15 XP'); Sfx.play('done'); confetti(1);
      }
    });
  },
  quickAddSilent(text) { const r = this.toast; this.toast = () => {}; try { this.quickAdd(text); } finally { this.toast = r; } },

  /* ================================================================ Grown-up zone */  parentGate() {
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
    const st = S.settings; st.parentSeen = Date.now(); save({ noSchedule: true });
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
        <p class="faint" style="margin-top:8px">He sees this same summary — and when a grown-up last checked. Praise effort and specific wins (“you started math without a reminder!”) — that builds motivation more than rewards do.</p></div>

      <h2>💌 Send a note</h2>
      <div class="row"><input class="field grow" id="pz-note" placeholder="e.g. Proud of how you started homework today!"><button class="btn small gold" data-x="note">Send</button></div>

      ${pending.length ? `<h2>🎁 Rewards to give</h2>${pending.map(p => `<div class="task"><span class="em">${esc(p.emoji)}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="meta">${new Date(p.at).toLocaleDateString()}</div></div><button class="btn small gold" data-x="given" data-id="${p.id}">Given ✓</button></div>`).join('')}` : ''}
      ${wishes.length ? `<h2>💭 Reward wishes</h2>${wishes.map(w => `<div class="task"><div class="grow t">${esc(w.text)}</div><button class="btn small" data-x="wishok" data-id="${w.id}">Add</button><button class="iconbtn" data-x="wishno" data-id="${w.id}">✕</button></div>`).join('')}` : ''}

      <h2>🛍️ Reward menu</h2>
      ${stale ? `<p class="sub">⚡ It’s been a few weeks — kids with ADHD get used to rewards fast. Swap in 1–2 new ones (ideally chosen together).</p>` : ''}
      ${S.rewards.map(r => `<div class="row" style="margin-bottom:6px"><input class="field" data-re="${r.id}" value="${esc(r.emoji)}" style="width:60px;text-align:center"><input class="field grow" data-rn="${r.id}" value="${esc(r.name)}"><input class="field" data-rc="${r.id}" type="number" value="${r.cost}" style="width:84px"><button class="iconbtn" data-x="rdel" data-id="${r.id}">🗑️</button></div>`).join('')}
      <div class="btn-row"><button class="btn small" data-x="radd">＋ Add reward</button><button class="btn small" data-x="rsave">💾 Save menu</button></div>
      <p class="faint">Roughly 10–20 coins per mission. Mix small daily rewards with bigger weekly ones; favor privileges and experiences.</p>

      <h2>🎓 School</h2>
      <label class="lbl">Grade (used for TEKS alignment)</label>
      <div class="chips">${[5, 6, 7, 8, 9].map(g => `<button class="chip ${S.player.grade === g ? 'on' : ''}" data-x="grade" data-k="${g}">${g}th</button>`).join('')}</div>
      <h2>✨ Study AI connection</h2>
      ${(() => { const ai = st.ai; const stt = aiStatus(); const u = aiUsage(); const custom = !APP_CONFIG.ai.models.some(([m]) => m === ai.model);
        return `<div class="card ai-card">
        <div class="row"><div class="grow"><b>Status</b><div class="faint">${esc(stt.label)}</div></div><span class="pill ${stt.ready ? 'gold' : ''}">${stt.ready ? 'LIVE' : ai.on ? 'ON' : 'OFF'}</span></div>
        <div class="list-btn" data-x="aion" style="margin-top:10px">Connection ${ai.on ? 'on' : 'off'}<span class="switch ${ai.on ? 'on' : ''}" style="margin-left:auto"></span></div>
        <p class="faint" style="margin:2px 2px 0">Off = no network calls and no AI anywhere in his app. He can still scan papers and make his own flashcards. Settings below are kept while it's off.</p>
        <label class="lbl">API key <span class="faint">(console.anthropic.com → API keys)</span></label>
        <div class="row"><input class="field grow" id="ai-key" type="password" value="${esc(ai.key)}" placeholder="sk-ant-…" autocomplete="off" spellcheck="false"><button class="btn small" data-x="aishow">Show</button></div>
        <label class="lbl">Model</label>
        <div class="chips">${APP_CONFIG.ai.models.map(([m, l]) => `<button class="chip ${ai.model === m ? 'on' : ''}" data-x="aimodel" data-k="${m}">${esc(l)}</button>`).join('')}<button class="chip ${custom ? 'on' : ''}" data-x="aimodel" data-k="__custom">Custom</button></div>
        <input class="field" id="ai-model" value="${esc(ai.model)}" placeholder="model ID, e.g. claude-sonnet-5-5" style="margin-top:8px;${custom ? '' : 'display:none'}" spellcheck="false">
        <div class="grid2" style="margin-top:12px">
          <div><div class="faint">Max pages per paper</div><input class="field" id="ai-pages" type="number" min="1" max="10" value="${ai.maxPages || 6}"></div>
          <div><div class="faint">Monthly limit (0 = none)</div><input class="field" id="ai-limit" type="number" min="0" value="${ai.monthlyLimit ?? 100}"></div>
        </div>
        <div class="faint" style="margin-top:8px">Used this month: <b>${u.builds}</b>${ai.monthlyLimit ? ` of ${ai.monthlyLimit}` : ''} study packs · <button class="linkish" data-x="aireset">reset</button></div>
        <details class="fold"><summary>Advanced</summary>
          <div class="faint">Endpoint URL (point at your own proxy later to keep the key off the phone)</div>
          <input class="field" id="ai-endpoint" value="${esc(ai.endpoint || APP_CONFIG.ai.endpoint)}" spellcheck="false">
          <div class="faint" style="margin-top:8px">API version header</div>
          <input class="field" id="ai-ver" value="${esc(ai.apiVersion || APP_CONFIG.ai.apiVersion)}" spellcheck="false">
          <button class="btn small ghost" data-x="aidefaults" style="margin-top:8px">Restore build defaults</button>
        </details>
        <div class="btn-row"><button class="btn small primary" data-x="aisave">Save AI settings</button><button class="btn small" data-x="aitest">Test connection</button></div>
        ${ai.lastTest ? `<div class="faint" style="margin-top:8px">Last test: ${ai.lastTest.ok ? '✓ connected' : '✕ ' + esc(ai.lastTest.msg)} · ${new Date(ai.lastTest.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>` : ''}
        <details class="fold"><summary>What gets sent</summary><p class="sub" style="margin:0">Only the photos of a paper, his grade, and the TEKS list for that grade — and only when he taps “Build study pack.” No name or account. Instructions tell the AI never to answer the actual homework; it teaches the ideas and writes similar practice. Typical cost is a few cents per paper. The key is stored only on this phone.</p></details>
      </div>`; })()}

      <h2>📆 Google Calendar sync</h2>
      ${GSync.adminHTML()}

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
      const pullAI = () => {
        const v = sel => { const el = $(sel, root); return el ? el.value.trim() : null; };
        const key = v('#ai-key'); if (key !== null) st.ai.key = key;
        const m = $('#ai-model', root); if (m && m.style.display !== 'none' && m.value.trim()) st.ai.model = m.value.trim();
        const pg = +v('#ai-pages'); if (pg) st.ai.maxPages = clamp(pg, 1, 10);
        const lim = v('#ai-limit'); if (lim !== null && lim !== '') st.ai.monthlyLimit = Math.max(0, +lim || 0);
        const ep = v('#ai-endpoint'); if (ep) st.ai.endpoint = ep;
        const ver = v('#ai-ver'); if (ver) st.ai.apiVersion = ver;
      };
      root.onclick = async e => {
        const b = e.target.closest('[data-x]'); if (!b) return; const x = b.dataset.x, id = b.dataset.id;
        if (['gconnect', 'gon', 'gread', 'gwrite', 'gtog', 'ginv', 'gcadd', 'gcdel', 'gsync', 'grefresh', 'gtest', 'gdisconnect'].includes(x)) { const sc = $('#sheet').scrollTop; if (await GSync.adminClick(x, b, root) !== false) { await this.parentZone(); $('#sheet').scrollTop = sc; } return; }
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
        if (x === 'grade') { S.player.grade = +b.dataset.k; save({ noSchedule: true }); $$('[data-x=grade]', root).forEach(c => c.classList.toggle('on', c === b)); }
        if (x === 'aion') { pullAI(); st.ai.on = !st.ai.on; save({ noSchedule: true }); this.toast(st.ai.on ? 'Study AI connection on' : 'Study AI connection off'); return this.parentZone(); }
        if (x === 'aishow') { const k = $('#ai-key', root); k.type = k.type === 'password' ? 'text' : 'password'; b.textContent = k.type === 'password' ? 'Show' : 'Hide'; }
        if (x === 'aimodel') { pullAI(); if (b.dataset.k !== '__custom') st.ai.model = b.dataset.k; else { const m = $('#ai-model', root); m.style.display = ''; m.focus(); $$('[data-x=aimodel]', root).forEach(c => c.classList.toggle('on', c === b)); return; } save({ noSchedule: true }); return this.parentZone(); }
        if (x === 'aireset') { aiUsage().builds = 0; save({ noSchedule: true }); return this.parentZone(); }
        if (x === 'aidefaults') { Object.assign(st.ai, { endpoint: APP_CONFIG.ai.endpoint, apiVersion: APP_CONFIG.ai.apiVersion, model: APP_CONFIG.ai.model, maxPages: APP_CONFIG.ai.maxPages, monthlyLimit: APP_CONFIG.ai.monthlyLimit }); save({ noSchedule: true }); this.toast('Defaults restored (key kept)'); return this.parentZone(); }
        if (x === 'aisave') { pullAI(); save({ noSchedule: true }); this.toast('AI settings saved'); return this.parentZone(); }
        if (x === 'aitest') {
          pullAI(); save({ noSchedule: true });
          if (!st.ai.key && /anthropic\.com/.test(st.ai.endpoint)) return this.toast('Paste a key first');
          this.toast('Testing…');
          let ok = false, msg = '';
          try { const r = await fetch(st.ai.endpoint, { method: 'POST', headers: aiHeaders(), body: JSON.stringify({ model: st.ai.model, max_tokens: 10, messages: [{ role: 'user', content: 'Reply OK' }] }) });
            ok = r.ok; msg = r.ok ? 'connected' : r.status === 401 ? 'key rejected (401)' : r.status === 404 ? 'model or URL not found (404)' : r.status === 429 ? 'rate limited (429)' : 'error ' + r.status; }
          catch (err) { msg = 'no connection'; }
          st.ai.lastTest = { ok, msg, at: Date.now() }; save({ noSchedule: true });
          this.toast(ok ? 'Connected ✓' + (st.ai.on ? '' : ' — switch the connection on when you’re ready') : 'Test failed: ' + msg);
          return this.parentZone();
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
  view_home() {
    const q = todayQueue();
    const r = routineActive();
    let main = '';
    if (S.focus) {
      const t = Focus.task();
      main = `<div class="now-card"><div class="now-label">In progress</div><div class="now-title"><span class="em">${esc(t ? t.emoji : '🎯')}</span><span>${esc(t ? t.title : '')}</span></div>
        <button class="btn primary big" data-a="resumeFocus">Jump back in</button></div>`;
    } else if (r) {
      const done = r.log[today()] || []; const item = r.items.find(i => !done.includes(i.id));
      main = `<div class="now-card"><div class="now-label">${esc(r.name)} · ${done.length}/${r.items.length}</div>
        <div class="now-title"><span class="em">${esc(item.emoji)}</span><span>${esc(item.text)}</span></div>
        <div class="bar" style="margin:8px 0 14px"><i style="width:${done.length / r.items.length * 100}%"></i></div>
        <button class="btn primary big" data-a="rtItem" data-r="${r.id}" data-i="${item.id}">${item.action === 'scan' ? '📸 Scan now' : 'Done'}</button>
        <div class="btn-row"><button class="btn small" data-a="openRoutine" data-r="${r.id}">All steps</button><button class="btn small ghost" data-a="skipRoutine" data-r="${r.id}">Not now</button></div></div>`;
    } else if (q.length) {
      const t = q[0];
      const firstStep = (t.steps || []).find(s => !s.done);
      const a = t.assignmentId && S.assignments.find(x => x.id === t.assignmentId);
      main = `<div class="now-card ${a && a.maxHp ? 'boss' : ''}">
        <div class="now-label">${a && a.maxHp ? `⚔️ vs ${esc(a.boss)}` : t.kind === 'study' ? 'Study' : 'Your mission'}${t.time ? ' · ' + fmtHM(t.time) : ''}${a ? ` · due ${dueLc(a.due)}` : ''}</div>
        <div class="now-title"><span class="em">${esc(t.emoji)}</span><span>${esc(t.title)}</span></div>
        ${a && a.maxHp ? `<div class="hp" style="margin:4px 0 8px"><i style="width:${(a.hp / a.maxHp * 100).toFixed(0)}%"></i></div>` : ''}
        ${t.anchor ? `<div class="sub">${esc(anchorText(t.anchor))} → then this.</div>` : ''}
        <div class="now-step">${firstStep ? `First step: <b>${esc(firstStep.text)}</b>` : `<button class="chip" data-a="chop" data-id="${t.id}">Break it into steps</button>`}${carriedDays(t) ? ` <span class="pill">Carried over</span>` : ''}</div>
        <button class="btn primary big" data-a="start" data-id="${t.id}">▶ Start</button>
        <div class="btn-row">
          <button class="btn small" data-a="quickDone" data-id="${t.id}">Done</button>
          <button class="btn small" data-a="notNow" data-id="${t.id}">Not now</button>
          ${S.profile.style.start === 'spin' && q.length > 1 ? `<button class="btn small" data-a="spin">🎲 Spin</button>` : `<button class="btn small" data-a="stuckNow" data-id="${t.id}">Stuck</button>`}
        </div></div>`;
    } else {
      main = `<div class="now-card now-empty"><div class="now-title" style="justify-content:center">All clear</div>
        <p class="sub">${esc(pick(LINES.hello))}</p>
        <div class="quickadd"><input id="qa-now" placeholder="Add a mission…" enterkeyhint="done" autocomplete="off"><button class="iconbtn" data-a="qaNow" aria-label="Add">＋</button></div>
        <div class="btn-row"><button class="btn small" data-a="plan">Plan ahead</button><button class="btn small" data-a="tab" data-t="calendar">Calendar</button></div></div>`;
    }
    const rest = q.slice(r || S.focus ? 0 : 1, (r || S.focus ? 0 : 1) + 3);
    const note = S.notes.find(n => !n.read);
    const tip = this.dailyTip();
    const insights = this.insights();
    const later = S.tasks.filter(t => !t.done && t.when === 'later').length;
    return `
      ${main}
      ${rest.length ? `<div class="list-head"><span>Up next</span>${q.length > rest.length + 1 ? `<span class="faint">+${q.length - rest.length - 1} more</span>` : ''}</div>${rest.map(t => `<div class="task" data-a="openTask" data-id="${t.id}"><span class="em">${esc(t.emoji)}</span><div class="grow"><div class="t">${esc(t.title)}</div>${t.time ? `<div class="meta">${fmtHM(t.time)}</div>` : ''}</div><button class="iconbtn" data-a="start" data-id="${t.id}" aria-label="Start">▶</button></div>`).join('')}` : ''}
      ${q.length || r || S.focus ? `<div class="quickadd" style="margin-top:10px"><input id="qa" placeholder="Add a mission — “math at 4pm”" enterkeyhint="done" autocomplete="off"><button class="iconbtn" data-a="qa" aria-label="Add">＋</button></div>` : ''}
      ${!S.player.tag ? `<div class="card" style="border-color:var(--accent)"><b>Set up your player card</b><div class="faint" style="margin:4px 0 10px">Gamertag, emblem, banner. Takes 20 seconds.</div><button class="btn small primary" data-a="customize">Customize</button></div>` : ''}
      ${GSync.invitesCard()}
      ${School.dueSoonHTML()}
      ${note ? `<div class="card" style="border-color:var(--gold)"><div class="faint">Message from ${esc(note.from || 'Dad')}</div><div style="font-size:18px;font-weight:600;margin:6px 0 10px">${esc(note.text)}</div><button class="btn small gold" data-a="readNote" data-id="${note.id}">Got it</button></div>` : ''}
      ${this.challengesCard()}
      ${openAssignments().filter(a => a.maxHp && !a.defeated).slice(0, 2).map(a => School.bossCard(a)).join('')}
      ${this.timeBudget(q)}
      ${insights.slice(0, 1).map(i => `<div class="card soft"><div class="faint">Noticed something</div><div style="margin:6px 0 10px">${esc(i.text)}</div>${i.btn ? `<button class="btn small" data-a="insight" data-k="${i.id}">${esc(i.btn)}</button>` : ''}</div>`).join('')}
      ${tip ? `<div class="card tip"><div class="faint">Pro tip</div><b style="font-size:17px">${esc(tip.t)}</b><p class="sub" style="margin:6px 0 10px">${esc(tip.d)}</p>
        <div class="row">${tip.task ? `<button class="btn small" data-a="tipTask" data-k="${tip.id}">＋ Make it a mission</button>` : `<button class="btn small" data-a="tipLike" data-k="${tip.id}">I’ll try it</button>`}<button class="btn small ghost" data-a="tipHide" data-k="${tip.id}">Not for me</button></div></div>` : ''}
      <div class="row wrap" style="gap:8px;margin-top:6px">
        ${S.parking.length ? `<button class="btn small ghost" data-a="parking">🅿️ Parking lot · ${S.parking.length}</button>` : ''}
        ${later ? `<button class="btn small ghost" data-a="backlog">Later · ${later}</button>` : ''}
        <button class="btn small ghost" data-a="plan">Plan ahead</button>
      </div>`;
  },

  challengesCard() {
    const w = S.weekly;
    if (!w.picked.length) return `<div class="card chall"><div class="row"><div class="grow"><b>Weekly challenges</b><div class="faint">Pick 3 of 5. Each one = +100 season XP.</div></div><button class="btn small primary" data-a="pickChallenges">Pick</button></div></div>`;
    return `<div class="card chall"><div class="row" style="justify-content:space-between"><b>This week</b><span class="faint">resets Monday</span></div>
      ${w.picked.map(id => { const c = CHALLENGE_POOL.find(x => x.id === id); if (!c) return ''; const p = Math.min(c.goal, Math.round(w.progress[id] || 0)); const done = w.done.includes(id);
        return `<div class="ch-row ${done ? 'done' : ''}"><span class="grow">${done ? '✓ ' : ''}${esc(c.name)}</span><span class="faint">${p}/${c.goal}</span></div><div class="bar thin"><i style="width:${p / c.goal * 100}%"></i></div>`; }).join('')}</div>`;
  },

  pickChallenges() {
    ensureWeekly(); const sel = new Set(S.weekly.picked);
    const draw = () => this.sheet(`<div class="grab"></div><h3>Pick 3 challenges</h3><p class="sub">Your call. Pick ones that fit your week.</p>
      ${S.weekly.offered.map(id => { const c = CHALLENGE_POOL.find(x => x.id === id); return `<button class="list-btn ${sel.has(id) ? 'on' : ''}" data-x="t" data-k="${id}"><span class="check ${sel.has(id) ? 'on' : ''}">${sel.has(id) ? '✓' : ''}</span>${esc(c.name)}</button>`; }).join('')}
      <div class="spacer"></div><button class="btn primary block" data-x="ok" ${sel.size === 3 ? '' : 'disabled'}>Lock in (${sel.size}/3)</button>`, root => {
      root.onclick = e => { const b = e.target.closest('[data-x]'); if (!b) return;
        if (b.dataset.x === 't') { const k = b.dataset.k; if (sel.has(k)) sel.delete(k); else if (sel.size < 3) sel.add(k); return draw(); }
        if (b.dataset.x === 'ok') { S.weekly.picked = [...sel]; save({ noSchedule: true }); this.closeSheet(); this.render(); this.toast('Challenges locked in'); } };
    });
    draw();
  },

  /* ================================================================ PROFILE */
  customize() {
    const P = S.player;
    const draw = () => this.sheet(`<div class="grab"></div><h3>Customize</h3>
      <label class="lbl">Gamertag</label><input class="field" id="cz-tag" value="${esc(P.tag)}" maxlength="18">
      <label class="lbl">Emblem</label><div class="emb-grid">${Object.keys(EMBLEMS).map(k => `<button class="emb ${P.emblem === k ? 'on' : ''}" data-x="emb" data-k="${k}">${emblemSVG(k, P.color, 40, false)}</button>`).join('')}</div>
      <label class="lbl">Color</label><div class="chips">${S.unlocked.colors.map(c => `<button class="swatch-btn ${P.color === c ? 'on' : ''}" data-x="col" data-k="${c}" style="background:${c}" aria-label="color"></button>`).join('')}${EMBLEM_COLORS.filter(c => !S.unlocked.colors.includes(c)).map(() => `<span class="swatch-btn locked">🔒</span>`).join('')}</div>
      <label class="lbl">Banner</label><div class="ban-grid">${BANNERS.map(b => { const has = S.unlocked.banners.includes(b.id); return `<button class="ban ${P.banner === b.id ? 'on' : ''}" data-x="ban" data-k="${b.id}" style="background:${b.css}" ${has ? '' : 'disabled'}><span>${has ? esc(b.name) : '🔒 ' + (b.season ? 'Season tier ' + b.season : 'Level ' + b.level)}</span></button>`; }).join('')}</div>
      <label class="lbl">Title</label><div class="chips">${TITLES.map(t => S.unlocked.titles.includes(t.id) ? `<button class="chip ${P.title === t.id ? 'on' : ''}" data-x="title" data-k="${t.id}">${esc(t.name)}</button>` : `<span class="chip" style="opacity:.45">🔒 ${esc(t.name)}</span>`).join('')}</div>
      <label class="lbl">App theme</label><div class="chips">${THEMES.map(t => S.unlocked.themes.includes(t.id) ? `<button class="chip ${P.theme === t.id ? 'on' : ''}" data-x="theme" data-k="${t.id}"><i class="swatch" style="background:${t.accent}"></i>${t.name}</button>` : `<span class="chip" style="opacity:.45">🔒 ${t.name} · ${t.level ? 'Lv ' + t.level : 'Season'}</span>`).join('')}</div>
      <div class="spacer"></div><button class="btn primary block" data-x="done">Done</button>`, root => {
      root.onclick = e => {
        const b = e.target.closest('[data-x]'); if (!b) return; const k = b.dataset.k; P.tag = $('#cz-tag', root).value.trim() || P.tag;
        if (b.dataset.x === 'emb') P.emblem = k; if (b.dataset.x === 'col') P.color = k; if (b.dataset.x === 'ban') P.banner = k; if (b.dataset.x === 'title') P.title = k; if (b.dataset.x === 'theme') P.theme = k;
        save({ noSchedule: true });
        if (b.dataset.x === 'done') { this.closeSheet(); this.render(); return; }
        this.render(); draw();
      };
    });
    draw();
  },

  achievement(a, t) {
    if (!a) return;
    Sfx.play('level'); buzz('success');
    this.toast(`Achievement: ${a.name}${t ? ` · title “${t.name}” unlocked` : ''}`, null, null, 3800);
  },

  backlogSheet() {
    const later = S.tasks.filter(t => !t.done && t.when === 'later');
    this.sheet(`<div class="grab"></div><h3>Later</h3><p class="sub">Parked so Today stays clean. Pull back what still matters.</p>
      ${later.map(t => `<div class="task"><span class="em">${esc(t.emoji)}</span><div class="grow t" style="font-size:16px">${esc(t.title)}</div><button class="btn small" data-x="today" data-id="${t.id}">Today</button><button class="iconbtn" data-x="del" data-id="${t.id}" aria-label="Delete">🗑️</button></div>`).join('')}
      <div class="spacer"></div><button class="btn block" data-x="close">Close</button>`, root => root.onclick = e => {
      const b = e.target.closest('[data-x]'); if (!b) return; const t = S.tasks.find(x => x.id === b.dataset.id);
      if (b.dataset.x === 'today') { t.when = 'today'; t.date = today(); t.parkedAuto = false; save(); }
      if (b.dataset.x === 'del') { S.tasks = S.tasks.filter(x => x !== t); save(); }
      if (b.dataset.x === 'close') { this.closeSheet(); this.render(); return; }
      this.backlogSheet();
    });
  },
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
      case 'notNow': { this.closeSheet(); t.pin = 0; t.defer = today(); t.deferAt = Date.now(); save(); this.render(); return this.toast('Moved back. Next one.'); }
      case 'spin': { const q = todayQueue(); const p = pick(q.slice(0, Math.min(3, q.length))); S.tasks.forEach(o => o.pin = 0); p.pin = 1; save(); Sfx.play('coin'); this.render(); return this.toast(`🎲 Picked: ${p.title}`); }
      case 'stuckNow': return this.sheet(`<div class="grab"></div><h3>Stuck on “${esc(t.title)}”?</h3>
          <button class="list-btn" data-a="chop" data-id="${t.id}"><span class="em">🔪</span>Break it into small steps<span class="chev">›</span></button>
          <button class="list-btn" data-a="two" data-id="${t.id}"><span class="em">⏱️</span>Just do 2 minutes<span class="chev">›</span></button>
          <button class="list-btn" data-a="notNow" data-id="${t.id}"><span class="em">⏭</span>Do a different one first<span class="chev">›</span></button>
          <button class="list-btn" data-a="park"><span class="em">🙋</span>Write down what I need help with<span class="chev">›</span></button>`, root => root.onclick = ev => { this.closeSheet(); this.onClick(ev); });
      case 'two': this.closeSheet(); return Focus.start(id, 2, 'mini');
      case 'chop': t.steps = (t.steps || []).filter(s => s.done).concat(suggestSteps(t.title, false).map(text => ({ id: uid(), text, done: false }))); save(); this.render(); return this.toast('Broken into steps. Tap the mission to edit them.');
      case 'openTask': return this.taskSheet(t);
      case 'qa': return this.quickAdd($('#qa').value);
      case 'qaNow': return this.quickAdd($('#qa-now').value);
      case 'mic': return this.mic();
      case 'plan': track('plan'); return this.planSheet();
      case 'backlog': return this.backlogSheet();
      case 'rtItem': { const r = S.routines.find(x => x.id === el.dataset.r); const it = r.items.find(i => i.id === el.dataset.i); if (it && it.action === 'scan') return School.scan(); this.toggleRoutineItem(r, el.dataset.i); return this.render(); }
      case 'openRoutine': return this.openRoutine(el.dataset.r);
      case 'skipRoutine': { const r = S.routines.find(x => x.id === el.dataset.r); r.skipped = today(); save({ noSchedule: true }); return this.render(); }
      case 'newRoutine': return this.editRoutine(null);
      case 'readNote': { const n = S.notes.find(x => x.id === id); n.read = true; save({ noSchedule: true }); Sfx.play('coin'); return this.render(); }
      case 'tipLike': S.tips.liked.push(el.dataset.k); S.tips.current = ''; save({ noSchedule: true }); this.toast('Try it today'); return this.render();
      case 'tipHide': S.tips.hidden.push(el.dataset.k); S.tips.current = ''; save({ noSchedule: true }); this.toast('Got it — different tips from now on'); return this.render();
      case 'tipTask': { const tip = TIPS.find(x => x.id === el.dataset.k); S.tasks.push(newTask(tip.task)); S.tips.liked.push(tip.id); S.tips.current = ''; save(); this.toast('Added as a mission'); return this.render(); }
      case 'insight': {
        const ins = this.insights().find(i => i.id === el.dataset.k); if (!ins) return;
        const st = S.profile.style;
        if (ins.id === 'sprint-up') { S.tips.seen['ins-sprint-' + st.sprint] = 1; st.sprint += 5; this.toast(`Sprints are now ${st.sprint} min.`); }
        if (ins.id === 'sprint-down') { S.tips.seen['ins-sprint-' + st.sprint] = 1; st.sprint -= 5; this.toast(`Sprints are now ${st.sprint} min. Short + done beats long + stuck.`); }
        if (ins.id === 'peak') { S.tips.seen['ins-peak-' + ins.key] = 1; st.peak = ins.key; this.toast('Power hour updated'); }
        if (ins.id === 'park') { S.tips.seen['ins-park-' + today()] = 1; save({ noSchedule: true }); return this.parkSheet(); }
        if (ins.id === 'parked') { S.tasks.forEach(x => { if (x.parkedAuto) x.parkSeen = true; }); save(); return this.backlogSheet(); }
        save({ noSchedule: true }); return this.render();
      }
      case 'parking': case 'park': return this.parkSheet();
      case 'pickChallenges': return this.pickChallenges();
      case 'claim': { const msg = claimSeasonTier(+el.dataset.k); if (msg) { Sfx.play('level'); confetti(1); this.toast('Unlocked: ' + msg); this.render(); } return; }
      case 'customize': return this.customize();
      case 'redeem': {
        const r = S.rewards.find(x => x.id === id); if (S.stats.coins < r.cost) return;
        if (!(await ask(`Spend ${r.cost} coins on “${r.name}”?`, { ok: 'Redeem' }))) return;
        S.stats.coins -= r.cost; S.redemptions.unshift({ id: uid(), rewardId: r.id, name: r.name, emoji: r.emoji, cost: r.cost, at: Date.now(), status: 'pending' });
        save({ noSchedule: true }); Sfx.play('level'); confetti(1); this.render(); return this.toast('Requested. Show a grown-up to collect.');
      }
      case 'wish': { const w = await ask('What reward would you want? A grown-up sets the price.', { input: true, placeholder: 'e.g. trampoline park trip', ok: 'Send' }); if (w && w.trim()) { S.wishes.push({ id: uid(), text: w.trim(), at: Date.now(), status: 'new' }); save({ noSchedule: true }); this.toast('Sent'); } return; }
      case 'retake': S.profile.onboarded = false; this.quizStep = 1; this.quizAns = { name: S.player.tag, grade: S.player.grade, emblem: S.player.emblem, color: S.player.color }; this._retake = true; return this.render();
      case 'toggle': S.settings[el.dataset.k] = !S.settings[el.dataset.k]; save({ noSchedule: true }); return this.render();
      case 'checkins': { const order = ['gentle', 'normal', 'off']; S.settings.checkins = order[(order.indexOf(S.settings.checkins) + 1) % 3]; save({ noSchedule: true }); return this.render(); }
      case 'notifs': { const p = await Reminders.ask(); this.toast(p === 'granted' ? 'Reminders are on' : 'Reminders are off — turn them on in phone Settings'); return; }
      case 'parent': return this.parentGate();
      // School + calendar
      case 'seg': School.seg = el.dataset.k; return this.render();
      case 'scan': return School.scan();
      case 'newAssignment': return School.assignmentSheet();
      case 'openAssignment': { const as = S.assignments.find(x => x.id === id); return as && School.assignmentDetail(as); }
      case 'openPaper': { const p = S.papers.find(x => x.id === id); return p && School.paperSheet(p); }
      case 'cards': return School.flashcards(S.papers.find(x => x.id === id));
      case 'quiz': return School.quiz(S.papers.find(x => x.id === id));
      case 'calDay': Cal.sel = el.dataset.k; Sfx.play('tap'); return this.render();
      case 'calNav': Cal.month = new Date(Cal.month.getFullYear(), Cal.month.getMonth() + +el.dataset.k, 1); return this.render();
      case 'calToday': { const d = new Date(); Cal.month = new Date(d.getFullYear(), d.getMonth(), 1); Cal.sel = today(); return this.render(); }
      case 'calAdd': return Cal.add(el.dataset.k, Cal.sel);
      case 'editEvent': return Cal.eventSheet(S.events.find(x => x.id === id));
      case 'gevent': { const g = (S.gevents || []).find(x => x.key === el.dataset.k); return g && GSync.detail(g); }
      case 'rsvp': { const g = (S.gevents || []).find(x => x.key === el.dataset.k); if (g) { await GSync.rsvp(g, el.dataset.s); this.render(); } return; }
    }
  },
};

