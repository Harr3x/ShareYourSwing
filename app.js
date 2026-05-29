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
  app.innerHTML = '';

  const loader = routes[hash] ?? routes['#home'];
  try {
    const mod = await loader();
    mod.render(app, params);
  } catch (err) {
    app.innerHTML = '<p style="padding:20px;color:red">Fehler beim Laden der Seite.</p>';
    console.error(err);
  }

  renderNavBar(document.getElementById('nav'), hash);
}

window.addEventListener('hashchange', navigate);
navigate();
