const PLAYER_COLORS = [
  '#2196f3', '#f44336', '#4caf50', '#ff9800',
  '#9c27b0', '#00bcd4', '#ff5722', '#607d8b',
];

export function roundChartHTML(players, scores, holes) {
  if (!players.length || !holes.length) return '';

  const series = players.map((p, pi) => {
    const data = [];
    let cum = 0;
    for (let i = 0; i < 18; i++) {
      const s = scores[p.id] != null ? scores[p.id][i] : null;
      if (s != null) cum += s - holes[i].par;
      data.push(cum);
    }
    return { name: p.name, color: PLAYER_COLORS[pi % PLAYER_COLORS.length], data };
  });

  let min = Infinity, max = -Infinity;
  for (const s of series) {
    for (const v of s.data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const pad = Math.max(3, (max - min) * 0.15);
  let yMin = Math.floor((min - pad) / 5) * 5;
  let yMax = Math.ceil((max + pad) / 5) * 5;

  const W = 400, H = 200;
  const padLeft = 38, padRight = 10, padTop = 16, padBottom = 24;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const range = yMax - yMin || 1;

  function x(i) { return padLeft + (i / 17) * chartW; }
  function y(v) { return padTop + ((yMax - v) / range) * chartH; }

  const ticks = [];
  for (let t = yMin; t <= yMax; t += 5) {
    ticks.push(t);
  }

  const gridLines = ticks.map(t => `
    <line x1="${padLeft}" y1="${y(t)}" x2="${W - padRight}" y2="${y(t)}"
      stroke="${t === 0 ? 'var(--text-muted)' : 'var(--border-light)'}" stroke-width="${t === 0 ? 1.5 : 1}"
      ${t === 0 ? '' : 'stroke-dasharray="3,3"'}
    />
    <text x="${padLeft - 6}" y="${y(t) + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">
      ${t > 0 ? '+' + t : t}
    </text>
  `).join('');

  const xLabels = [0, 2, 4, 6, 8, 10, 12, 14, 16].map(i => `
    <text x="${x(i)}" y="${H - 4}" font-size="10" fill="var(--text-muted)" text-anchor="middle">${i + 1}</text>
  `).join('');
  const xLabelLast = `<text x="${x(17)}" y="${H - 4}" font-size="10" fill="var(--text-muted)" text-anchor="middle">18</text>`;

  const lines = series.map(s => {
    const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const dots = s.data.map((v, i) =>
      `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}">
        <title>${s.name} – Bahn ${i + 1}: ${v > 0 ? '+' + v : v}</title>
      </circle>`
    ).join('');
    return `
      <polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
    `;
  }).join('');

  const legend = series.map(s => `
    <span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:12px;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>
      ${s.name}
    </span>
  `).join('');

  return `
    <h3 class="mt-16" style="font-size:15px;margin-bottom:8px;">Verlauf (±Par)</h3>
    <div style="border:1px solid var(--border-light);border-radius:var(--radius);background:var(--surface);padding:4px;">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;">
        <text x="${padLeft}" y="${padTop - 6}" font-size="11" fill="var(--text-muted)">±Par</text>
        ${gridLines}
        ${lines}
        ${xLabels}
        ${xLabelLast}
      </svg>
      <div style="padding:6px 12px 8px;display:flex;flex-wrap:wrap;gap:2px;">
        ${legend}
      </div>
    </div>
  `;
}