import { icons } from './icons.js';

const tabs = [
  { hash: '#home',    icon: icons.home,    label: 'Home' },
  { hash: '#stats',   icon: icons.stats,   label: 'Stats' },
  { hash: '#courses', icon: icons.courses, label: 'Plätze' },
  { hash: '#players', icon: icons.players, label: 'Spieler' },
];

export function renderNavBar(nav, activeHash) {
  nav.innerHTML = tabs.map(t => `
    <a href="${t.hash}" class="${activeHash === t.hash ? 'active' : ''}">
      <span class="nav-pip"></span>
      <span class="icon">${t.icon}</span>
      ${t.label}
    </a>
  `).join('');
}
