import { getCloudRound } from '../supabase.js';
import { scoreCellHTML } from '../components/score-cell.js';
import { icons } from '../components/icons.js';

export async function render(container, params) {
  const { roundId } = params;
  const round = await getCloudRound(roundId);

  const participants = round.round_participants || [];
  const holes = round.holes || [];
  const date = new Date(round.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

  function totalFor(p) {
    return (p.scores || []).reduce((s, v) => v != null ? s + v : s, 0);
  }

  function vsParFor(p) {
    let diff = 0;
    for (let i = 0; i < 18; i++) {
      if (p.scores[i] != null) diff += p.scores[i] - holes[i].par;
    }
    return diff;
  }

  const headerCells = Array.from({ length: 18 }, (_, i) => `<th>${i + 1}</th>`).join('');
  const parRow = `<tr class="row-par"><th>Par</th>${holes.map(h => `<td>${h.par}</td>`).join('')}<th>Total</th><th>+/−</th></tr>`;

  const playerRows = participants.map(p => {
    const cells = Array.from({ length: 18 }, (_, i) => {
      const strokes = p.scores?.[i] ?? null;
      return `<td>${scoreCellHTML(strokes, holes[i].par)}</td>`;
    }).join('');
    const vsPar = vsParFor(p);
    const vsParStr = vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
    const allNull = (p.scores || []).every(v => v == null);
    return `<tr><th style="text-align:left;padding-left:8px">${p.display_name}</th>${cells}<td class="row-total">${totalFor(p) || '—'}</td><td class="row-total">${allNull ? '—' : vsParStr}</td></tr>`;
  }).join('');

  container.innerHTML = `
    <div class="scorecard-screen">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <a href="#feed" style="display:inline-flex;align-items:center;gap:2px;color:var(--text-muted);text-decoration:none;font-size:14px">${icons.chevronLeft} Feed</a>
        <div style="flex:1;min-width:0;">
          <h1 style="margin:0;font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${round.course_name}</h1>
          <div style="font-size:13px;color:var(--text-muted)">${date}</div>
        </div>
      </div>
      <div class="scorecard-wrap">
        <table class="scorecard">
          <thead><tr><th>Spieler</th>${headerCells}<th>Total</th><th>+/−</th></tr>${parRow}</thead>
          <tbody>${playerRows}</tbody>
        </table>
      </div>
    </div>
  `;
}
