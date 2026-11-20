/* MainQuest service worker: offline app shell + notification actions. */
const CACHE = 'mainquest-v1';
const SHELL = ['./', 'index.html', 'app.css', 'content.js', 'core.js', 'focus.js', 'ui.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/badge-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive), cache fallback (so it works offline).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const action = e.action || 'open';
  const extra = e.notification.data || {};
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) {
      const c = all[0]; await c.focus();
      c.postMessage({ type: 'notif-action', action, extra });
    } else {
      const q = new URLSearchParams({ action, task: extra.taskId || '', routine: extra.routineId || '' });
      await self.clients.openWindow('./?' + q.toString());
    }
  })());
});
