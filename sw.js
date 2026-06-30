const CACHE  = 'flowdo-v13';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap'
];
const CACHEABLE_ORIGINS = new Set([
  location.origin,
  'https://www.gstatic.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(ASSETS.map(asset => cache.add(asset).catch(() => {})))
    )
  );
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
  if (!CACHEABLE_ORIGINS.has(url.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok || res.type === 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
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

  // FIXED: Use one consistent tag for ALL notifications. 
  // This forces the operating system to automatically replace the old one natively.
  const tag = 'flowdo-summary';

  e.waitUntil((async () => {
    // FIXED AGAIN: Unconditionally close ANY existing notifications from this app.
    const existing = await self.registration.getNotifications();
    existing.forEach(n => n.close());

    await self.registration.showNotification(title, {
      body,
      icon:     '/icon-192.png',
      badge:    '/icon-192.png',
      tag,      // The consistent tag that makes the magic happen
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
