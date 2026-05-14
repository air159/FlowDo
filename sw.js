const CACHE  = 'flowdo-v10';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
      return cached || network;
    })
  );
});

// ── Show one summary notification for all today's pending tasks ───────────────
const PRIO_ICON = { critical:'🔴', high:'🟠', medium:'🟡', low:'⚪' };

self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'SHOW_TASK_NOTIFS') return;
  const { tasks, dateStr, isTest } = e.data;
  if (!tasks.length) return;

  const count = tasks.length;
  const title = `FlowDo ✦ ${count} task${count !== 1 ? 's' : ''} today`;
  const lines = tasks.map(t => `${PRIO_ICON[t.priority] || '🟡'} ${t.title}`);
  const body = lines.join('\n');

  const tag = isTest ? 'flowdo-summary-test' : 'flowdo-summary-' + dateStr;

  e.waitUntil((async () => {
    const existing = await self.registration.getNotifications();
    existing.forEach(n => {
      const title = (n.title || '').toLowerCase();
      const tag = (n.tag || '').toLowerCase();
      if (tag.includes('flowdo') || title.startsWith('flowdo')) n.close();
    });
    await self.registration.showNotification(title, {
      body,
      icon:     '/icon-192.png',
      badge:    '/icon-192.png',
      tag,                          // same tag each day — replaces instead of stacking
      renotify: false,
      data:     { dateStr, isTest: !!isTest },
      actions:  [{ action: 'open', title: '📅 Open today' }]
    });
  })());
});

// ── Notification tap ──────────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { dateStr, isTest } = e.notification.data || {};
  if (isTest) return;

  const url = '/?openday=' + dateStr;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      if (cs.length) { cs[0].navigate(url); cs[0].focus(); }
      else self.clients.openWindow(url);
    })
  );
});
