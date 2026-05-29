const tabs = [
  { hash: '#home',    icon: '🏠', label: 'Home' },
  { hash: '#stats',   icon: '📈', label: 'Stats' },
  { hash: '#courses', icon: '⛳', label: 'Plätze' },
  { hash: '#players', icon: '👤', label: 'Spieler' },
];

export function renderNavBar(nav, activeHash) {
  nav.innerHTML = tabs.map(t => `
    <a href="${t.hash}" class="${activeHash === t.hash ? 'active' : ''}">
      <span class="icon">${t.icon}</span>
      ${t.label}
    </a>
  `).join('');
}
