const CACHE = 'sys-v19';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './db.js',
  './config.js',
  './supabase.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './utils/golf.js',
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