import { getRound, getAllPlayers, saveHoleScore, deleteRound } from '../db.js';
import { scoreCellHTML } from '../components/score-cell.js';
import { icons } from '../components/icons.js';
import { publishRound, getCourse } from '../supabase.js';

export async function render(container, params) {
  const { roundId } = params;
  const [round, players] = await Promise.all([getRound(roundId), getAllPlayers()]);
  const course = await getCourse(round.courseId);
  const playerMap = new Map(players.map(p => [p.id, p]));
  const roundPlayers = round.playerIds.map(id => playerMap.get(id)).filter(Boolean);

  function totalFor(playerId) {
    const scores = round.scores[playerId];
    return scores.reduce((s, v) => v != null ? s + v : s, 0);
  }

  function vsParFor(playerId) {
    const scores = round.scores[playerId];
    let diff = 0;
    for (let i = 0; i < 18; i++) {
      if (scores[i] != null) diff += scores[i] - course.holes[i].par;
    }
    return diff;
  }

  function draw() {
    const holes = Array.from({ length: 18 }, (_, i) => i);

    const headerCells = holes.map(i => `<th>${i + 1}</th>`).join('');
    const parRow = `<tr class="row-par"><th>Par</th>${holes.map(i =>
      `<td>${course.holes[i].par}</td>`).join('')}<th>Total</th><th>+/−</th></tr>`;
    const playerRows = roundPlayers.map(p => {
      const cells = holes.map(i => {
        const strokes = round.scores[p.id][i];
        const par = course.holes[i].par;
        return `<td data-round="${roundId}" data-pid="${p.id}" data-hole="${i}" style="cursor:pointer">${scoreCellHTML(strokes, par)}</td>`;
      }).join('');
      const vsPar = vsParFor(p.id);
      const vsParStr = vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
      return `<tr><th style="text-align:left;padding-left:8px">${p.name}</th>${cells}<td class="row-total">${totalFor(p.id) || '—'}</td><td class="row-total">${round.scores[p.id].every(v => v == null) ? '—' : vsParStr}</td></tr>`;
    }).join('');

    container.innerHTML = `
      <div class="scorecard-screen">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <a href="#home" style="display:inline-flex;align-items:center;gap:2px;color:var(--text-muted);text-decoration:none;font-size:14px">${icons.chevronLeft} Home</a>
          <h1 style="margin:0;flex:1;font-size:20px">${course.name}</h1>
          <button class="btn-danger" id="btn-delete-round" style="padding:6px 14px;min-height:auto;font-size:13px;">Löschen</button>
        </div>
        <div class="scorecard-wrap">
          <table class="scorecard">
            <thead><tr><th>Spieler</th>${headerCells}<th>Total</th><th>+/−</th></tr>${parRow}</thead>
            <tbody>${playerRows}</tbody>
          </table>
        </div>
        <div style="margin-top:16px;">
          <a href="#play?roundId=${roundId}&hole=0" class="btn-primary" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;text-decoration:none;border-radius:var(--radius);">
            Weiter spielen ${icons.chevronRight}
          </a>
        </div>
      </div>
    `;

    container.querySelector('#btn-delete-round')?.addEventListener('click', async () => {
      if (!confirm('Runde wirklich löschen?')) return;
      await deleteRound(roundId);
      location.hash = '#home';
    });

    container.querySelectorAll('[data-hole]').forEach(cell => {
      cell.addEventListener('click', async () => {
        const holeIndex = parseInt(cell.dataset.hole, 10);
        const playerId = cell.dataset.pid;
        const par = course.holes[holeIndex].par;
        const current = round.scores[playerId][holeIndex] ?? par;
        const val = prompt(`Schläge für Bahn ${holeIndex + 1} (Par ${par}):`, current);
        const parsed = parseInt(val, 10);
        if (!val || isNaN(parsed) || parsed < 1) return;
        round.scores[playerId][holeIndex] = parsed;
        await saveHoleScore(roundId, playerId, holeIndex, parsed);
        draw();
      });
    });
  }

  draw();

  // Share button
  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn-primary';
  shareBtn.textContent = 'Runde teilen';
  shareBtn.style.cssText = 'display:block;margin:24px auto;padding:12px 32px;font-size:1rem';
  container.querySelector('.scorecard-screen').appendChild(shareBtn);

  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    shareBtn.textContent = 'Wird geteilt...';
    try {
      const playerMap = new Map(players.map(p => [p.id, p]));
      const participantMap = round.playerIds
        .map(pid => {
          const player = playerMap.get(pid);
          if (!player) return null;
          return { userId: pid, displayName: player.name, scores: round.scores[pid] };
        })
        .filter(Boolean);

      await publishRound(course, round.date, participantMap);
      shareBtn.textContent = '✓ Geteilt!';
    } catch (err) {
      console.error(err);
      shareBtn.textContent = 'Fehler – nochmal versuchen';
      shareBtn.disabled = false;
    }
  });
}
