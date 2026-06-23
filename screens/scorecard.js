import { getDraft, saveDraftScore, deleteDraft, setCloudRoundId, setPendingSync, removePlayerFromDraft } from '../db.js';
import { createActiveRound, syncParticipantScores, mergePlayerScore, publishActiveRound, deleteActiveRound, removeParticipant, sendPushToFriends, getActiveRound, getUserRounds, upsertPlayerStats, getCurrentUser } from '../supabase.js';
import { computeHandicap } from '../utils/golf.js';
import { scoreCellHTML } from '../components/score-cell.js';
import { roundChartHTML } from '../components/round-chart.js';
import { icons } from '../components/icons.js';

export async function render(container, params) {
  const { draftId } = params;
  const fromHole = parseInt(params.fromHole ?? '0', 10);
  let draft = await getDraft(draftId);
  if (!draft) {
    container.innerHTML = '<p style="padding:20px">Runde nicht gefunden.</p>';
    return;
  }
  if (draft.cloudRoundId) {
    try {
      const live = await getActiveRound(draft.cloudRoundId);
      live.players.forEach(p => { draft.scores[p.id] = p.scores; });
    } catch (e) { /* fallback auf lokale Daten */ }
  }

  const course = { name: draft.courseName, holes: draft.holes };

  function totalFor(playerId) {
    return draft.scores[playerId].reduce((s, v) => v != null ? s + v : s, 0);
  }

  function vsParFor(playerId) {
    let diff = 0;
    for (let i = 0; i < 18; i++) {
      if (draft.scores[playerId][i] != null)
        diff += draft.scores[playerId][i] - course.holes[i].par;
    }
    return diff;
  }

  async function ensureCloudRound() {
    draft = await getDraft(draftId);
    if (!draft.cloudRoundId) {
      const cloudId = await createActiveRound(
        draft.courseName, draft.date,
        draft.playerIds, draft.playerNames, draft.holes
      );
      await setCloudRoundId(draftId, cloudId);
      draft = await getDraft(draftId);
    }
    return draft.cloudRoundId;
  }

  function draw() {
    const roundPlayers = draft.playerIds.map(id => ({ id, name: draft.playerNames[id] || id }));
    const holes = Array.from({ length: 18 }, (_, i) => i);

    const headerCells = holes.map(i => `<th>${i + 1}</th>`).join('');
    const parRow = `<tr class="row-par"><th>Par</th>${holes.map(i =>
      `<td>${course.holes[i].par}</td>`).join('')}<th>Total</th><th>+/−</th></tr>`;
    const playerRows = roundPlayers.map(p => {
      const cells = holes.map(i => {
        const strokes = draft.scores[p.id][i];
        const par = course.holes[i].par;
        return `<td data-pid="${p.id}" data-hole="${i}" style="cursor:pointer">${scoreCellHTML(strokes, par)}</td>`;
      }).join('');
      const vsPar = vsParFor(p.id);
      const vsParStr = vsPar > 0 ? `+${vsPar}` : `${vsPar}`;
      const removeBtn = roundPlayers.length > 1
        ? `<button data-remove-player="${p.id}" style="margin-left:6px;padding:1px 6px;min-height:unset;font-size:12px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--text-muted);cursor:pointer;">×</button>`
        : '';
      return `<tr><th style="text-align:left;padding-left:8px"><span style="display:inline-flex;align-items:center;">${p.name}${removeBtn}</span></th>${cells}<td class="row-total" data-total="${p.id}">${draft.scores[p.id].some(v => v != null) ? totalFor(p.id) : '—'}</td><td class="row-total" data-vspar="${p.id}">${draft.scores[p.id].every(v => v == null) ? '—' : vsParStr}</td></tr>`;
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
        <div id="round-chart-wrap">
          ${roundChartHTML(roundPlayers, draft.scores, course.holes)}
        </div>
        <div style="margin-top:16px;">
          <a href="#play?draftId=${draftId}&hole=${fromHole}" class="btn-primary" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;text-decoration:none;border-radius:var(--radius);">
            Weiter spielen ${icons.chevronRight}
          </a>
        </div>
      </div>
    `;

    container.querySelector('#btn-delete-round').addEventListener('click', async () => {
      if (!confirm('Runde wirklich löschen?')) return;
      draft = await getDraft(draftId);
      if (draft?.cloudRoundId) {
        try { await deleteActiveRound(draft.cloudRoundId); } catch (e) { console.warn(e); }
      }
      await deleteDraft(draftId);
      location.hash = '#home';
    });

    container.querySelectorAll('[data-hole]').forEach(cell => {
      cell.addEventListener('click', async () => {
        const holeIndex = parseInt(cell.dataset.hole, 10);
        const playerId = cell.dataset.pid;
        const par = course.holes[holeIndex].par;
        const current = draft.scores[playerId][holeIndex] ?? par;
        const val = prompt(`Schläge für Bahn ${holeIndex + 1} (Par ${par}, 0 = nicht gespielt):`, current);
        const parsed = parseInt(val, 10);
        if (!val || isNaN(parsed) || parsed < 0) return;
        const stored = parsed === 0 ? null : parsed;
        draft.scores[playerId][holeIndex] = stored;
        await saveDraftScore(draftId, playerId, holeIndex, stored);
        if (navigator.onLine) {
          draft = await getDraft(draftId);
          if (draft.cloudRoundId) {
            mergePlayerScore(draft.cloudRoundId, playerId, holeIndex, stored)
              .catch(e => console.warn('sync failed:', e));
          }
        } else {
          await setPendingSync(draftId, true);
        }
        draw();
      });
    });

    container.querySelectorAll('[data-remove-player]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const playerId = btn.dataset.removePlayer;
        const name = roundPlayers.find(p => p.id === playerId)?.name || playerId;
        if (!confirm(`${name} aus der Runde entfernen?`)) return;
        try {
          await removePlayerFromDraft(draftId, playerId);
        } catch (e) {
          alert('Fehler beim Entfernen des Spielers. Bitte erneut versuchen.');
          return;
        }
        if (draft.cloudRoundId) {
          await removeParticipant(draft.cloudRoundId, playerId).catch(e => console.warn(e));
        }
        draft = await getDraft(draftId);
        draw();
      });
    });
  }

  draw();

  if (draft.cloudRoundId) {
    const liveInterval = setInterval(async () => {
      if (!document.body.contains(container)) { clearInterval(liveInterval); return; }
      try {
        const live = await getActiveRound(draft.cloudRoundId);
        live.players.forEach(p => {
          draft.scores[p.id] = p.scores;
          p.scores.forEach((score, i) => {
            const cell = container.querySelector(`[data-pid="${p.id}"][data-hole="${i}"]`);
            if (cell) cell.innerHTML = scoreCellHTML(score, course.holes[i].par);
          });
          const totalEl = container.querySelector(`[data-total="${p.id}"]`);
          const vsParEl = container.querySelector(`[data-vspar="${p.id}"]`);
          if (totalEl) totalEl.textContent = p.scores.some(v => v != null) ? p.scores.reduce((s, v) => v != null ? s + v : s, 0) : '—';
          if (vsParEl) {
            let diff = 0;
            p.scores.forEach((s, i) => { if (s != null) diff += s - course.holes[i].par; });
            vsParEl.textContent = p.scores.every(v => v == null) ? '—' : (diff > 0 ? `+${diff}` : `${diff}`);
          }
        });
          const liveRoster = draft.playerIds.map(id => ({ id, name: draft.playerNames[id] || id }));
          const chartWrap = container.querySelector('#round-chart-wrap');
          if (chartWrap) chartWrap.innerHTML = roundChartHTML(liveRoster, draft.scores, course.holes);
        } catch (e) {}
    }, 5000);
  }

  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn-primary';
  shareBtn.textContent = 'Runde teilen';
  shareBtn.style.cssText = 'display:block;margin:24px auto;padding:12px 32px;font-size:1rem';
  container.querySelector('.scorecard-screen').appendChild(shareBtn);

  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    shareBtn.textContent = 'Wird geteilt...';
    try {
      draft = await getDraft(draftId);
      const cloudRoundId = await ensureCloudRound();

      // Partner's self-entered scores live in the cloud but not in local IndexedDB;
      // re-merge before final sync so they aren't overwritten.
      try {
        const live = await getActiveRound(cloudRoundId);
        live.players.forEach(p => {
          const local = draft.scores[p.id] || Array(18).fill(null);
          draft.scores[p.id] = local.map((v, i) => v != null ? v : (p.scores[i] ?? null));
        });
      } catch (e) { /* fallback to local draft scores */ }

      // Final sync of all scores
      await Promise.all(
        draft.playerIds.map(pid =>
          syncParticipantScores(cloudRoundId, pid, draft.scores[pid])
        )
      );

      await publishActiveRound(cloudRoundId);
      sendPushToFriends(draft.courseName); // fire and forget
      getCurrentUser().then(me => {
        if (!me) return;
        getUserRounds().then(({ rounds: myRounds, courseMap: myCourseMap }) => {
          const { handicap: newHcp } = computeHandicap(myRounds, myCourseMap, me.id);
          if (newHcp != null) upsertPlayerStats(me.id, { handicap: newHcp });
        });
      });
      await deleteDraft(draftId);
      shareBtn.textContent = '✓ Geteilt!';
      setTimeout(() => { location.hash = '#home'; }, 1200);
    } catch (err) {
      console.error(err);
      shareBtn.textContent = 'Fehler – nochmal versuchen';
      shareBtn.disabled = false;
    }
  });
}
