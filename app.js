import { renderNavBar } from './components/nav-bar.js';
import { getSession, subscribeToNotifications } from './supabase.js';

const PUBLIC_ROUTES = new Set(['#login']);

const routes = {
  '#home':      () => import('./screens/home.js'),
  '#new-round': () => import('./screens/new-round.js'),
  '#play':      () => import('./screens/play.js'),
  '#scorecard': () => import('./screens/scorecard.js'),
  '#stats':     () => import('./screens/stats.js'),
  '#courses':   () => import('./screens/courses.js'),
  '#players':   () => import('./screens/players.js'),
  '#login':     () => import('./screens/login.js'),
  '#feed':            () => import('./screens/feed.js'),
  '#cloud-scorecard': () => import('./screens/cloud-scorecard.js'),
};

function parseHash() {
  const [hash, query = ''] = location.hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { hash: hash || '#home', params };
}

async function navigate() {
  const { hash, params } = parseHash();
  const app = document.getElementById('app');

  if (!PUBLIC_ROUTES.has(hash)) {
    const session = await getSession();
    if (!session) {
      location.hash = '#login';
      return;
    }
  }

  app.style.transition = 'none';
  app.style.opacity = '0';
  app.style.transform = 'translateY(14px)';
  app.innerHTML = '';

  const loader = routes[hash] ?? routes['#home'];
  try {
    const mod = await loader();
    await mod.render(app, params);
  } catch (err) {
    app.innerHTML = '<p style="padding:20px;color:red">Fehler beim Laden der Seite.</p>';
    console.error(err);
  }

  requestAnimationFrame(() => {
    app.style.transition = 'opacity 0.26s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
    app.style.opacity = '1';
    app.style.transform = 'translateY(0)';
  });

  const showNav = !PUBLIC_ROUTES.has(hash);
  const nav = document.getElementById('nav');
  if (showNav) {
    renderNavBar(nav, hash);
    nav.style.display = '';
  } else {
    nav.style.display = 'none';
  }
}

window.addEventListener('hashchange', navigate);
navigate();

getSession().then(session => {
  if (session) subscribeToNotifications();
});
