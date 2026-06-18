import { getCurrentUser, getUserRounds, upsertPlayerStats } from '../supabase.js';
import { computePlayerStats, computeHandicap, computeBreakdownByPar, computeBirdieStats, computeCourseRecords } from '../utils/golf.js';

export async function render(container) {
  const user = await getCurrentUser();
  if (!user) {
    container.innerHTML = '<h1>Statistiken</h1><p class="text-muted">Bitte einloggen um deine Statistiken zu sehen.</p>';
    return;
  }

  const rounds = await getUserRounds();
  const courseMap = new Map(rounds.map(r => [r.courseId, { holes: r.holes }]));

  if (!rounds.length) {
    container.innerHTML = '<h1>Statistiken</h1><p class="text-muted">Noch keine Rundendaten vorhanden.</p>';
    return;
  }

  const stats = computePlayerStats(rounds, courseMap, user.id);
  const hcpResult = computeHandicap(rounds, courseMap, user.id);
  console.log('[stats] hcp:', hcpResult.handicap, 'rounds:', rounds.length);
  if (hcpResult.handicap != null) {
    upsertPlayerStats(user.id, {
      handicap: hcpResult.handicap,
      birdieStats: computeBirdieStats(rounds, courseMap, user.id),
      courseRecords: computeCourseRecords(rounds, courseMap, user.id),
    });
  }
  const byPar = computeBreakdownByPar(rounds, courseMap, user.id);
  const courseStats = courseHoleStats(rounds, user.id);

  container.innerHTML = `
    <h1>Statistiken</h1>

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

    <h2 class="mt-16" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;" onclick="this.nextElementSibling.hidden=!this.nextElementSibling.hidden;this.querySelector('.chev').textContent=this.nextElementSibling.hidden?'▶':'▼'">
      Breakdown nach Par <span class="chev" style="font-size:12px;color:var(--text-muted)">▶</span>
    </h2>
    <div hidden>
      ${breakdownByParHTML(byPar)}
    </div>

    <h2 class="mt-16" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;" onclick="this.nextElementSibling.hidden=!this.nextElementSibling.hidden;this.querySelector('.chev').textContent=this.nextElementSibling.hidden?'▶':'▼'">
      Bahnen-Statistik <span class="chev" style="font-size:12px;color:var(--text-muted)">▶</span>
    </h2>
    <div hidden>
      ${courseHoleStatsHTML(courseStats)}
    </div>
  `;
}

function hcpTrendSVG(history) {
  if (!history.length) return '<p class="text-muted">Mindestens 1 vollständige 18-Loch-Runde für Trend benötigt.</p>';

  const points = [{ date: history[0].date, hcp: 36 }, ...history];

  const W = 320, H = 160, padLeft = 38, padRight = 16, padTop = 16, padBottom = 22;
  const yMin = 0, yMax = 36;
  const range = yMax - yMin;

  function x(i) { return padLeft + (i / (points.length - 1)) * (W - padLeft - padRight); }
  function y(v) { return padTop + ((yMax - v) / range) * (H - padTop - padBottom); }

  const ticks = [36, 18, 0];
  const gridLines = ticks.map(v => `
    <line x1="${padLeft}" y1="${y(v)}" x2="${W - padRight}" y2="${y(v)}" stroke="var(--border-light)" stroke-width="1"/>
    <text x="${padLeft - 4}" y="${y(v) + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${v.toFixed(1)}</text>
  `).join('');

  const linePoints = points.map((r, i) => `${x(i)},${y(r.hcp)}`).join(' ');
  const dots = points.map((r, i) => `
    <circle cx="${x(i)}" cy="${y(r.hcp)}" r="4" fill="${i === 0 ? 'var(--text-muted)' : 'var(--primary)'}">
      <title>${i === 0 ? 'Start' : new Date(r.date).toLocaleDateString('de-DE')}: ${r.hcp.toFixed(1)}</title>
    </circle>
  `).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;border:1px solid var(--border-light);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-sm);">
      ${gridLines}
      <polyline points="${linePoints}" fill="none" stroke="var(--primary)" stroke-width="2"/>
      ${dots}
      <text x="${padLeft}" y="${H - 4}" font-size="10" fill="var(--text-muted)">Start</text>
      <text x="${W - padRight}" y="${H - 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${new Date(points[points.length-1].date).toLocaleDateString('de-DE', {month:'short', day:'numeric'})}</text>
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

function courseHoleStats(rounds, userId) {
  // Group rounds by course name
  const byCourseName = new Map();
  for (const r of rounds) {
    const name = r.courseName || 'Unbekannt';
    if (!byCourseName.has(name)) byCourseName.set(name, []);
    byCourseName.get(name).push(r);
  }

  // For each course, compute per-hole avg vs par
  const result = [];
  for (const [name, courseRounds] of byCourseName) {
    const holes = Array.from({ length: 18 }, (_, i) => {
      const scores = courseRounds
        .map(r => ({ score: (r.scores[userId] ?? [])[i], par: r.holes[i]?.par }))
        .filter(s => s.score != null && s.par != null);
      if (!scores.length) return { hole: i + 1, par: courseRounds[0].holes[i]?.par ?? null, avg: null, count: 0 };
      const avgVsPar = scores.reduce((s, v) => s + (v.score - v.par), 0) / scores.length;
      return { hole: i + 1, par: courseRounds[0].holes[i]?.par ?? null, avg: avgVsPar, count: scores.length };
    });
    result.push({ name, rounds: courseRounds.length, holes });
  }
  return result;
}

function courseHoleStatsHTML(courses) {
  if (!courses.length) return '';

  function holeColor(avg) {
    if (avg === null) return 'var(--text-muted)';
    if (avg < 0) return '#2e7d32';
    if (avg > 0) return '#bf360c';
    return 'var(--text-muted)';
  }

  function holeListHTML(course) {
    const sorted = [...course.holes].sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return a.avg - b.avg;
    });
    return `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">aus ${course.rounds} Runde${course.rounds !== 1 ? 'n' : ''}</div>
      ${sorted.map(h => {
        const avgStr = h.avg === null ? '—' : (h.avg >= 0 ? `+${h.avg.toFixed(2)}` : h.avg.toFixed(2));
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:14px;">
            <span>Bahn ${h.hole}${h.par != null ? ` <span style="color:var(--text-muted);font-size:12px;">(Par ${h.par})</span>` : ''}</span>
            <span style="font-weight:600;color:${holeColor(h.avg)}">${avgStr}</span>
          </div>
        `;
      }).join('')}
    `;
  }

  if (courses.length === 1) {
    return `
      <div class="card" style="flex-direction:column;align-items:stretch;gap:0;">
        ${holeListHTML(courses[0])}
      </div>
    `;
  }

  // Pre-render all panels; show/hide on tab click
  const panels = courses.map((c, i) => `
    <div id="chs-panel-${i}" ${i !== 0 ? 'hidden' : ''}>
      ${holeListHTML(c)}
    </div>
  `).join('');

  const tabs = courses.map((c, i) => `
    <button
      onclick="document.querySelectorAll('[id^=chs-panel-]').forEach((p,j)=>p.hidden=j!==${i});document.querySelectorAll('[id^=chs-tab-]').forEach((t,j)=>{t.style.background=j===${i}?'var(--primary)':'none';t.style.color=j===${i}?'white':'inherit';})"
      id="chs-tab-${i}"
      style="padding:4px 12px;border:1px solid var(--border);border-radius:20px;font-size:13px;cursor:pointer;background:${i === 0 ? 'var(--primary)' : 'none'};color:${i === 0 ? 'white' : 'inherit'};"
    >${c.name}</button>
  `).join('');

  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">${tabs}</div>
    <div class="card" style="flex-direction:column;align-items:stretch;gap:0;">${panels}</div>
  `;
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