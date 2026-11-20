'use strict';
/* Shared metric definitions — used by the phone app (today's targets) AND the parent dashboard / counselor report,
   so a target means exactly the same thing everywhere. Input: activity events {ts, type, data}. */

const MQM = (() => {
  const pad = n => String(n).padStart(2, '0');
  const dayOf = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const sum = a => a.reduce((x, y) => x + y, 0);
  const isSchoolDay = dk => { const wd = new Date(dk + 'T12:00').getDay(); return wd >= 1 && wd <= 5; };

  /* Tactics, named the way clinicians do, grouped by executive-function domain. */
  /* ev: evidence tier — 'pkg' = core component of RCT-tested programs (OST, HOPS, STAND, Safren CBT), 'mod' = meta-analytic/lab
     evidence in ADHD, 'gen' = strong in general learning research, little ADHD-specific data, 'lim' = limited. good/flag = what to look for over weeks. */
  const TACTICS = {
    chunk:      { name: 'Task chunking (task analysis)', domain: 'Task initiation', ev: 'pkg', good: 'He makes the steps himself; first step under 10 min', flag: 'Steps get made but not finished, or step-making becomes procrastination' },
    two_min:    { name: 'Graded task entry (2-minute start)', domain: 'Task initiation', ev: 'pkg', good: 'Time from cue to start shrinks; more starts run past 2 min', flag: 'Starts repeatedly stop at 2 min' },
    move_first: { name: 'Acute movement break', domain: 'Task initiation', ev: 'mod', good: 'Break is short and followed by a return to work', flag: 'Breaks lengthen, or no return to the task' },
    sprint:     { name: 'Timed work intervals (focus sprints)', domain: 'Sustained attention', ev: 'pkg', good: 'He lengthens sprints himself; high completion', flag: 'Sprints often abandoned, or length never grows' },
    checkin:    { name: 'Self-monitoring of attention', domain: 'Self-monitoring', ev: 'mod', good: 'Reports match adult spot checks; on-task holds as prompts thin', flag: 'Always "yes" (may be inaccurate), or on-task drops when prompts thin' },
    refocus:    { name: 'Self-redirection after drift', domain: 'Sustained attention', ev: 'pkg', good: 'More drifts end in a logged refocus', flag: 'Many drifts with no refocus' },
    park:       { name: 'Distraction log (distractibility delay)', domain: 'Inhibition', ev: 'pkg', good: 'Fewer exits mid-sprint', flag: 'Log never reviewed (contents stay private to him)' },
    help:       { name: 'Help-seeking / self-advocacy', domain: 'Frustration tolerance', ev: 'pkg', good: 'Asks come earlier and are more specific', flag: 'Never asks, or asks before trying' },
    swap:       { name: 'Easy-first warm-up (task switch)', domain: 'Frustration tolerance', ev: 'mod', good: 'Planned warm-up that leads back to the hard task', flag: 'Hard task never resumed (escape/avoidance)' },
    breaks:     { name: 'Scheduled breaks', domain: 'Sustained attention', ev: 'pkg', good: 'Breaks end on time', flag: 'Breaks end the session' },
    estimate:   { name: 'Time estimation training', domain: 'Time management', ev: 'pkg', good: 'Estimate error shrinks; plans adjust', flag: 'Same underestimate every time, plan never changes' },
    when_then:  { name: 'Implementation intentions (when–then)', domain: 'Planning', ev: 'mod', good: 'He writes them; trigger fires and he follows through', flag: 'Plan written but never acted on' },
    plan_ahead: { name: 'Daily prioritized task list', domain: 'Planning', ev: 'pkg', good: 'Done-to-planned ratio rises; plans without prompting', flag: 'Same task carried over day after day' },
    spaced:     { name: 'Distributed practice (spaced study)', domain: 'Study skills', ev: 'gen', good: 'First session ≥3 days before a test', flag: 'Everything bunched the night before' },
    retrieval:  { name: 'Retrieval practice (self-testing)', domain: 'Study skills', ev: 'gen', good: 'Quiz scores rise', flag: 'Flipping cards without testing himself' },
    routines:   { name: 'Materials checklists (Ready-to-Go)', domain: 'Organization of materials', ev: 'pkg', good: 'Done with fewer prompts; surprise checks pass', flag: 'Checked off but items missing — verify occasionally' },
    scan:       { name: 'Same-day paper capture', domain: 'Organization of materials', ev: 'pkg', good: 'Papers captured the day they come home', flag: 'Papers logged in batches days later' },
    reminders:  { name: 'External cues at point of performance', domain: 'Time management', ev: 'pkg', good: 'Fewer reminders needed per completed task', flag: 'Snoozed or ignored — the cue has gone stale; rotate it' },
  };
  const EVIDENCE = { pkg: 'Part of RCT-tested programs (OST, HOPS, STAND, CBT)', mod: 'Moderate evidence in ADHD', gen: 'Strong in general learning research', lim: 'Limited evidence' };
  // which event types count as use of a tactic
  const TACTIC_OF = {
    stuck_smaller: 'chunk', steps_added: 'chunk', stuck_two: 'two_min', stuck_move: 'move_first', move_first: 'move_first',
    focus_end: 'sprint', checkin: 'checkin', refocus: 'refocus', park: 'park', stuck_help: 'help', stuck_swap: 'swap', break: 'breaks',
    estimate: 'estimate', when_then: 'when_then', plan: 'plan_ahead', study_done: 'spaced', cards: 'retrieval', quiz: 'retrieval',
    routine_done: 'routines', paper_scanned: 'scan', reminder_action: 'reminders',
  };

  /* Daily metrics computed from that day's events. */
  function daily(events) {
    const by = {};
    events.forEach(e => { const dk = dayOf(e.ts); (by[dk] = by[dk] || []).push(e); });
    const out = {};
    Object.entries(by).forEach(([dk, evs]) => {
      const t = type => evs.filter(e => e.type === type);
      const checks = t('checkin');
      const lat = t('focus_start').map(e => e.data && e.data.latency).filter(v => typeof v === 'number');
      const est = t('estimate').map(e => e.data.act / e.data.est).filter(v => isFinite(v) && v > 0);
      const asg = t('assignment_done');
      out[dk] = {
        date: dk, schoolDay: isSchoolDay(dk), events: evs.length,
        missions_done: t('mission_done').length,
        focus_min: Math.round(sum(t('focus_end').map(e => +e.data.minutes || 0))),
        sprints: t('focus_end').length,
        sprints_completed: t('focus_end').filter(e => e.data.completed).length,
        checkins: checks.length, on_task: checks.filter(e => e.data.result === 'yes').length,
        on_task_pct: checks.length ? Math.round(checks.filter(e => e.data.result === 'yes').length / checks.length * 100) : null,
        drifts: t('focus_end').reduce((s, e) => s + (+e.data.drifts || 0), 0),
        refocus: t('refocus').length,
        start_latency: median(lat),
        estimate_ratio: est.length ? Math.round(median(est) * 100) / 100 : null,
        routine_morning: t('routine_done').some(e => e.data.routine === 'r-morning') ? 1 : 0,
        routine_after: t('routine_done').some(e => e.data.routine === 'r-after') ? 1 : 0,
        routine_bed: t('routine_done').some(e => e.data.routine === 'r-bed') ? 1 : 0,
        bag_packed: t('routine_item').some(e => e.data.item === 'r-bed-0') || t('routine_done').some(e => e.data.routine === 'r-bed') ? 1 : 0,
        papers_scanned: t('paper_scanned').length,
        assignments_added: t('assignment_added').length,
        study_sessions: t('study_done').length,
        assignments_done: asg.length, on_time: asg.filter(e => (e.data.early_days ?? 0) >= 0).length,
        quiz_scores: t('quiz').map(e => e.data.pct),
        cards: sum(t('cards').map(e => +e.data.n || 0)),
        stuck: t('stuck').length + t('stuck_smaller').length + t('stuck_two').length + t('stuck_move').length + t('stuck_help').length + t('stuck_swap').length,
        reminders_started: t('reminder_action').filter(e => e.data.action === 'start').length,
        reminders_snoozed: t('reminder_action').filter(e => e.data.action === 'snooze').length,
      };
    });
    return out;
  }

  /* Daily Report Card targets. `better` = 'gte' (at least) or 'lte' (at most). */
  const GOAL_METRICS = {
    missions_done:   { label: 'Missions finished', unit: '', better: 'gte', default: 3 },
    focus_min:       { label: 'Focused minutes', unit: 'min', better: 'gte', default: 30 },
    study_sessions:  { label: 'Study sessions done', unit: '', better: 'gte', default: 1 },
    papers_scanned:  { label: 'Papers scanned (school days)', unit: '', better: 'gte', default: 1, schoolOnly: true },
    assignments_added: { label: 'Assignments logged (school days)', unit: '', better: 'gte', default: 1, schoolOnly: true },
    routine_morning: { label: 'Morning routine done', unit: '', better: 'gte', default: 1, schoolOnly: true, binary: true },
    routine_after:   { label: 'After-school reset done', unit: '', better: 'gte', default: 1, schoolOnly: true, binary: true },
    bag_packed:      { label: 'Bag packed the night before', unit: '', better: 'gte', default: 1, binary: true },
    on_task_pct:     { label: 'On-task at check-ins', unit: '%', better: 'gte', default: 70 },
    start_latency:   { label: 'Starts within X min of plan', unit: 'min', better: 'lte', default: 15 },
  };
  function goalMet(goal, day) {
    const m = GOAL_METRICS[goal.metric]; if (!m) return null;
    if (m.schoolOnly && day && !day.schoolDay) return null;           // not applicable today
    const v = day ? day[goal.metric] : null;
    if (v === null || v === undefined) return m.better === 'lte' || goal.metric === 'on_task_pct' ? null : false; // "no data" vs "not done"
    return m.better === 'lte' ? v <= goal.target : v >= goal.target;
  }
  /* DRC day score: % of applicable targets met; a "met" day is ≥ 2:1 yes:no (≥ 67%). */
  function drcDay(goals, day) {
    const r = goals.filter(g => g.active !== false).map(g => goalMet(g, day)).filter(v => v !== null);
    if (!r.length) return null;
    const pct = Math.round(r.filter(Boolean).length / r.length * 100);
    return { pct, met: pct >= 67, n: r.length };
  }

  function tacticUse(events) {
    const out = {};
    events.forEach(e => { const k = TACTIC_OF[e.type]; if (k) out[k] = (out[k] || 0) + 1; });
    return out;
  }

  /* Fading signals: share of focus starts he began himself vs. from a reminder; swaps that led back to the hard task. */
  function independence(events) {
    const starts = events.filter(e => e.type === 'focus_start');
    const self = starts.filter(e => !(e.data && e.data.prompted)).length;
    const swaps = events.filter(e => e.type === 'stuck_swap' && e.data && e.data.task);
    const returned = swaps.filter(s => events.some(e => (e.type === 'focus_start' || e.type === 'mission_done') && e.data && e.data.task === s.data.task && e.ts > s.ts && Date.parse(e.ts) - Date.parse(s.ts) < 2 * 864e5)).length;
    return { starts: starts.length, self_started: self, self_pct: starts.length ? Math.round(self / starts.length * 100) : null, swaps: swaps.length, swaps_returned: returned };
  }

  return { dayOf, median, sum, isSchoolDay, daily, independence, EVIDENCE, TACTICS, TACTIC_OF, GOAL_METRICS, goalMet, drcDay, tacticUse };
})();
if (typeof module !== 'undefined') module.exports = MQM;
