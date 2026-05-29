import { renderNavBar } from './components/nav-bar.js';

const routes = {
  '#home':      () => import('./screens/home.js'),
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
  const mod = await loader();
  mod.render(app, params);

  renderNavBar(document.getElementById('nav'), hash);
}

window.addEventListener('hashchange', navigate);
navigate();
