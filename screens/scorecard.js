import { getDraft, saveDraftScore, deleteDraft, setCloudRoundId, setPendingSync, removePlayerFromDraft } from '../db.js';
import { createActiveRound, syncParticipantScores, publishActiveRound, deleteActiveRound, removeParticipant } from '../supabase.js';
import { scoreCellHTML } from '../components/score-cell.js';
import { icons } from '../components/icons.js';

export async function render(container, params) {
  const { draftId } = params;
  let draft = await getDraft(draftId);
  if (!draft) {
    container.innerHTML = '<p style="padding:20px">Runde nicht gefunden.</p>';
    return;
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
      return `<tr><th style="text-align:left;padding-left:8px"><span style="display:inline-flex;align-items:center;">${p.name}${removeBtn}</span></th>${cells}<td class="row-total">${totalFor(p.id) || '—'}</td><td class="row-total">${draft.scores[p.id].every(v => v == null) ? '—' : vsParStr}</td></tr>`;
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
          <a href="#play?draftId=${draftId}&hole=0" class="btn-primary" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;text-decoration:none;border-radius:var(--radius);">
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
        const val = prompt(`Schläge für Bahn ${holeIndex + 1} (Par ${par}):`, current);
        const parsed = parseInt(val, 10);
        if (!val || isNaN(parsed) || parsed < 0) return;
        draft.scores[playerId][holeIndex] = parsed === 0 ? null : parsed;
        await saveDraftScore(draftId, playerId, holeIndex, parsed);
        if (navigator.onLine) {
          draft = await getDraft(draftId);
          if (draft.cloudRoundId) {
            syncParticipantScores(draft.cloudRoundId, playerId, draft.scores[playerId])
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
        await removePlayerFromDraft(draftId, playerId);
        if (draft.cloudRoundId) {
          await removeParticipant(draft.cloudRoundId, playerId).catch(e => console.warn(e));
        }
        draft = await getDraft(draftId);
        draw();
      });
    });
  }

  draw();

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

      // Final sync of all scores
      await Promise.all(
        draft.playerIds.map(pid =>
          syncParticipantScores(cloudRoundId, pid, draft.scores[pid])
        )
      );

      await publishActiveRound(cloudRoundId);
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
