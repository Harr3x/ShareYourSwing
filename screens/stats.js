import { getAllPlayers, getAllRounds, getAllCourses } from '../db.js';
import { computePlayerStats, computeHandicap, computeBreakdownByPar } from '../utils/golf.js';

export async function render(container) {
  const [players, rounds, courses] = await Promise.all([
    getAllPlayers(), getAllRounds(), getAllCourses()
  ]);

  const courseMap = new Map(courses.map(c => [c.id, c]));

  if (!players.length || !rounds.length) {
    container.innerHTML = '<h1>Statistiken</h1><p class="text-muted">Noch keine Rundendaten vorhanden.</p>';
    return;
  }

  let selectedPlayerId = players[0].id;

  function draw() {
    const stats = computePlayerStats(rounds, courseMap, selectedPlayerId);
    const hcpResult = computeHandicap(rounds, courseMap, selectedPlayerId);
    const byPar = computeBreakdownByPar(rounds, courseMap, selectedPlayerId);

    container.innerHTML = `
      <h1>Statistiken</h1>
      <select id="player-select" style="margin-bottom:20px;">
        ${players.map(p => `<option value="${p.id}" ${p.id === selectedPlayerId ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>

      <div class="card" style="flex-direction:column;align-items:flex-start;gap:4px;">
        <div style="font-size:13px;color:var(--text-muted)">Gespielte Runden</div>
        <div style="font-size:24px;font-weight:700">${stats.totalRounds}</div>
      </div>
      <div class="card" style="flex-direction:column;align-items:flex-start;gap:4px;">
        <div style="font-size:13px;color:var(--text-muted)">Handicap</div>
        <div style="font-size:24px;font-weight:700">${hcpResult.handicap != null ? hcpResult.handicap.toFixed(1) : '—'}</div>
      </div>

      <h2 class="mt-16">Handicap-Trend</h2>
      ${hcpTrendSVG(hcpResult.history)}

      <h2 class="mt-16">Ergebnis-Breakdown</h2>
      ${breakdownHTML(stats.breakdown)}

      <h2 class="mt-16">Breakdown nach Par</h2>
      ${breakdownByParHTML(byPar)}
    `;

    container.querySelector('#player-select').addEventListener('change', e => {
      selectedPlayerId = e.target.value;
      draw();
    });
  }

  draw();
}

function hcpTrendSVG(history) {
  if (history.length < 2) return '<p class="text-muted">Mindestens 2 vollständige 18-Loch-Runden für Trend benötigt.</p>';

  const W = 320, H = 160, pad = 30;
  const values = history.map(r => r.hcp);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  function x(i) { return pad + (i / (history.length - 1)) * (W - 2 * pad); }
  function y(v) { return pad + ((max - v) / range) * (H - 2 * pad); }

  const points = history.map((r, i) => `${x(i)},${y(r.hcp)}`).join(' ');
  const dots = history.map((r, i) => `
    <circle cx="${x(i)}" cy="${y(r.hcp)}" r="4" fill="var(--primary)">
      <title>${new Date(r.date).toLocaleDateString('de-DE')}: ${r.hcp.toFixed(1)}</title>
    </circle>
  `).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-sm);">
      <polyline points="${points}" fill="none" stroke="var(--primary)" stroke-width="2"/>
      ${dots}
      <text x="${pad}" y="${H - 6}" font-size="10" fill="var(--text-muted)">${new Date(history[0].date).toLocaleDateString('de-DE', {month:'short', day:'numeric'})}</text>
      <text x="${W - pad}" y="${H - 6}" font-size="10" fill="var(--text-muted)" text-anchor="end">${new Date(history[history.length-1].date).toLocaleDateString('de-DE', {month:'short', day:'numeric'})}</text>
    </svg>
  `;
}

function breakdownHTML(bd) {
  const total = Object.values(bd).reduce((s, v) => s + v, 0);
  if (!total) return '<p class="text-muted">Noch keine Daten.</p>';

  const items = [
    { key: 'eagle',  label: 'Eagle',        cls: 'golf-eagle',  color: '#1565c0' },
    { key: 'birdie', label: 'Birdie',        cls: 'golf-birdie', color: '#2e7d32' },
    { key: 'par',    label: 'Par',           cls: 'golf-par',    color: '#555' },
    { key: 'bogey',  label: 'Bogey',         cls: 'golf-bogey',  color: '#f57f17' },
    { key: 'double', label: 'Double Bogey',  cls: 'golf-double', color: '#bf360c' },
    { key: 'triple', label: 'Triple+',       cls: 'golf-triple', color: '#b71c1c' },
  ];

  const rows = items.filter(item => bd[item.key] > 0).map(item => {
    const count = bd[item.key];
    const pct = Math.round((count / total) * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span class="${item.cls}" style="flex-shrink:0;font-size:13px;width:28px;height:28px;">${pct}%</span>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
            <span>${item.label}</span><span>${count}×</span>
          </div>
          <div style="background:var(--border);border-radius:4px;height:8px;">
            <div style="background:${item.color};width:${pct}%;height:8px;border-radius:4px;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  return `<div class="card" style="flex-direction:column;align-items:stretch;gap:0;">${rows}</div>`;
}

function breakdownByParHTML(byPar) {
  const items = [
    { key: 'eagle',  label: 'Eagle',        cls: 'golf-eagle',  color: '#1565c0' },
    { key: 'birdie', label: 'Birdie',        cls: 'golf-birdie', color: '#2e7d32' },
    { key: 'par',    label: 'Par',           cls: 'golf-par',    color: '#555' },
    { key: 'bogey',  label: 'Bogey',         cls: 'golf-bogey',  color: '#f57f17' },
    { key: 'double', label: 'Double Bogey',  cls: 'golf-double', color: '#bf360c' },
    { key: 'triple', label: 'Triple+',       cls: 'golf-triple', color: '#b71c1c' },
  ];

return [3, 4, 5].map(par => {
    const bd = byPar['par' + par];
    const total = Object.values(bd).reduce((s, v) => s + v, 0);
    if (!total) return '';
    return `
      <div class="card" style="flex-direction:column;align-items:stretch;gap:8px;">
        <div style="font-weight:600">Par ${par}</div>
        ${items.filter(item => bd[item.key] > 0).map(item => {
        const count = bd[item.key];
        const pct = Math.round((count / total) * 100);
        return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span class="${item.cls}" style="flex-shrink:0;font-size:12px;width:24px;height:24px;">${pct}%</span>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
                <span>${item.label}</span><span>${count}×</span>
              </div>
              <div style="background:var(--border);border-radius:4px;height:6px;">
                <div style="background:${item.color};width:${pct}%;height:6px;border-radius:4px;"></div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
      </div>
    `;
  }).join('');
}