import { renderNavBar } from './components/nav-bar.js';

const routes = {
  '#home':      () => import('./screens/home.js'),
  '#new-round': () => import('./screens/new-round.js'),
  '#play':      () => import('./screens/play.js'),
  '#scorecard': () => import('./screens/scorecard.js'),
  '#stats':     () => import('./screens/stats.js'),
  '#courses':   () => import('./screens/courses.js'),
  '#players':   () => import('./screens/players.js'),
};

function parseHash() {
  const [hash, query = ''] = location.hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { hash: hash || '#home', params };
}

async function navigate() {
  const { hash, params } = parseHash();
  const app = document.getElementById('app');

  // Hide before render to avoid flash
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
  }

  // Animate in after content is ready
  requestAnimationFrame(() => {
    app.style.transition = 'opacity 0.26s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
    app.style.opacity = '1';
    app.style.transform = 'translateY(0)';
  });

  renderNavBar(document.getElementById('nav'), hash);
}

window.addEventListener('hashchange', navigate);
navigate();
