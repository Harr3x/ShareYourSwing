import { icons } from './icons.js';

const feedIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`;
const friendsIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>`;

const tabs = [
  { hash: '#home',    icon: icons.home,    label: 'Home' },
  { hash: '#stats',   icon: icons.stats,   label: 'Stats' },
  { hash: '#players', icon: friendsIcon,   label: 'Spieler' },
  { hash: '#feed',    icon: feedIcon,      label: 'Feed' },
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
