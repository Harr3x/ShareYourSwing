const CACHE = 'sys-v31';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './migration.js',
  './styles.css',
  './db.js',
  './config.js',
  './supabase.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './utils/golf.js',
  './utils/geo.js',
  './components/nav-bar.js',
  './components/score-cell.js',
  './components/icons.js',
  './screens/home.js',
  './screens/play.js',
  './screens/scorecard.js',
  './screens/stats.js',
  './screens/courses.js',
  './screens/players.js',
  './screens/new-round.js',
  './screens/login.js',
  './screens/feed.js',
  './screens/cloud-scorecard.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only cache same-origin requests; let external requests (fonts, CDN, Supabase) pass through
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached ?? fetch(e.request))
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'ShareYourSwing', {
      body: data.body ?? '',
      icon: data.icon ?? '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});