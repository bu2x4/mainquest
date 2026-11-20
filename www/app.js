'use strict';
/* MainQuest boot: wiring, timers, lifecycle. */

function logOpenSafe() { if (S.lastOpenLog !== today()) { S.lastOpenLog = today(); T.log('app_open', {}); save({ noSchedule: true }); } }
(async function boot() {
  await restoreFromNative();
  tidyBacklog();

  // Clicks inside the main view + tabs go through one router. Sheets/overlay bind their own handlers.
  $('#view').addEventListener('click', e => UI.onClick(e));
  $('#tabs').addEventListener('click', e => UI.onClick(e));
  $('#view').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'qa') UI.quickAdd(e.target.value);
    if (e.target.id === 'qa-now') UI.quickAdd(e.target.value);
  });

  UI.render();
  if (S.focus) Focus.render();

  // Orientation bar every 15s; full refresh each minute unless he is typing or a sheet is open.
  let lastDay = today();
  setInterval(() => {
    if (!S.profile.onboarded) return;
    UI.orient();
    Reminders.tick();
    if (today() !== lastDay) { lastDay = today(); tidyBacklog(); Reminders.sync(); }
  }, 15000);
  setInterval(() => {
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (S.profile.onboarded && $('#sheet-wrap').hidden && !typing) UI.render();
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    Focus.onVisibility();
    if (!document.hidden) { tidyBacklog(); if ($('#sheet-wrap').hidden) UI.render(); Reminders.tick(); Reminders.sync(); GSync.sync('resume'); logOpenSafe(); Cloud.sync('resume'); }
  });

  // Web/PWA: service worker for offline + notifications.
  if (!Native.ok && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('sw', e); }
    const p = new URLSearchParams(location.search);
    if (p.get('action')) Reminders.onAction(p.get('action'), { taskId: p.get('task'), routineId: p.get('routine') });
  }

  // Android hardware back button: close what's on top instead of quitting.
  if (Native.ok) {
    const App = Native.plugin('App');
    App && App.addListener('backButton', () => {
      if (!$('#sheet-wrap').hidden) return UI.closeSheet();
      if (S.focus && Focus.panel && Focus.panel !== 'complete') { Focus.panel = null; return Focus.render(); }
      if (S.focus) return UI.toast('Tap ✕ to leave focus mode');
      if (UI.tab !== 'home') return UI.go('home');
      App.minimizeApp();
    });
    App && App.addListener('appStateChange', ({ isActive }) => { if (isActive) { UI.render(); Reminders.sync(); } });
  }

  await Reminders.init();
  Reminders.tick();
  GSync.sync('boot');
  const logOpen = () => { if (S.lastOpenLog !== today()) { S.lastOpenLog = today(); T.log('app_open', {}); save({ noSchedule: true }); } };
  logOpen(); Cloud.sync('boot');
  setInterval(() => { if (!document.hidden) Cloud.sync('timer'); }, 15 * 60e3);
  setInterval(() => { if (!document.hidden) GSync.sync('timer'); }, 10 * 60e3);
})();
