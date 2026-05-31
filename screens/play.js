import { getRound, getAllPlayers, saveHoleScore } from '../db.js';
import { getCourse } from '../supabase.js';
import { getScoreClass, getScoreLabel } from '../utils/golf.js';
import { icons } from '../components/icons.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(container, params) {
  const { roundId } = params;
  let holeIndex = parseInt(params.hole ?? '0', 10);

  const [round, players] = await Promise.all([
    getRound(roundId),
    getAllPlayers(),
  ]);
  const course = await getCourse(round.courseId);

  const playerMap = new Map(players.map(p => [p.id, p]));
  const roundPlayers = round.playerIds.map(id => playerMap.get(id)).filter(Boolean);

  function currentPar() { return course.holes[holeIndex].par; }

  let currentScores = {};

  function initScores() {
    roundPlayers.forEach(p => {
      currentScores[p.id] = round.scores[p.id][holeIndex] ?? currentPar();
    });
  }

  function updateHash() {
    history.replaceState(null, '', `#play?roundId=${roundId}&hole=${holeIndex}`);
  }

  function holeStatus(i) {
    const scored = roundPlayers.filter(p => round.scores[p.id][i] != null).length;
    if (scored === 0) return 'empty';
    if (scored === roundPlayers.length) return 'complete';
    return 'partial';
  }

  function progressDots() {
    return Array.from({ length: 18 }, (_, i) => {
      let cls = 'hole-dot';
      if (i === holeIndex) cls += ' hole-dot--active';
      else if (i < holeIndex) cls += ' hole-dot--done';
      return `<span class="${cls}"></span>`;
    }).join('');
  }

  function playerCardHTML(p) {
    const par = currentPar();
    const score = currentScores[p.id];
    const cls = getScoreClass(score, par);
    const label = getScoreLabel(score, par);
    return `
      <div class="card" data-card="${p.id}" style="flex-direction:column;align-items:stretch;gap:12px;">
        <div style="font-size:17px;font-weight:600;letter-spacing:-0.2px;">${escapeHTML(p.name)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <button data-minus="${p.id}" style="width:52px;height:52px;min-height:unset;border-radius:50%;font-size:26px;font-weight:300;background:var(--surface-2);border:1.5px solid var(--border);box-shadow:var(--shadow-sm);display:inline-flex;align-items:center;justify-content:center;">−</button>
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
            <span class="${cls}" data-badge="${p.id}" style="width:52px;height:52px;font-size:24px;">${score}</span>
            <div data-label="${p.id}" style="font-size:12px;color:var(--text-muted);font-weight:500;min-height:16px;text-align:center;">${label}</div>
          </div>
          <button data-plus="${p.id}" style="width:52px;height:52px;min-height:unset;border-radius:50%;font-size:26px;font-weight:300;background:var(--surface-2);border:1.5px solid var(--border);box-shadow:var(--shadow-sm);display:inline-flex;align-items:center;justify-content:center;">+</button>
        </div>
      </div>
    `;
  }

  function draw() {
    const par = currentPar();
    const isLast = holeIndex === 17;

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
        <button id="btn-back" class="btn-ghost" style="padding:0 12px;font-size:14px;display:inline-flex;align-items:center;gap:4px;flex-shrink:0;">${icons.chevronLeft} Zurück</button>
        <div class="hole-progress">${progressDots()}</div>
        <a href="#scorecard?roundId=${roundId}" style="color:var(--text-muted);display:flex;align-items:center;text-decoration:none;padding:6px;flex-shrink:0;" title="Scorecard">${icons.scorecard}</a>
      </div>

      <button id="btn-hole-overview" style="width:100%;background:none;border:none;border-radius:var(--radius);padding:8px 16px 16px;min-height:unset;text-align:center;cursor:pointer;transition:background 0.15s ease;" title="Bahn wählen">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:2px;">Bahn</div>
        <div style="font-size:56px;font-weight:700;line-height:1;letter-spacing:-3px;color:var(--text);">${holeIndex + 1}</div>
        <div class="par-badge" style="display:inline-flex;margin-top:10px;">Par ${par}</div>
      </button>

      <div id="player-cards">
        ${roundPlayers.map(p => playerCardHTML(p)).join('')}
      </div>

      <button id="btn-confirm" class="btn-primary" style="margin-top:8px;">
        ${isLast ? 'Runde beenden' : `Nächste Bahn ${icons.chevronRight}`}
      </button>
    `;
  }

  function updateScoreDisplay(pid) {
    const par = currentPar();
    const score = currentScores[pid];
    const cls = getScoreClass(score, par);
    const label = getScoreLabel(score, par);

    const badge = container.querySelector(`[data-badge="${pid}"]`);
    const labelEl = container.querySelector(`[data-label="${pid}"]`);
    if (!badge) return;

    badge.className = `${cls}`;
    badge.setAttribute('data-badge', pid);
    badge.style.cssText = 'width:52px;height:52px;font-size:24px;';
    badge.textContent = score;
    if (labelEl) labelEl.textContent = label;

    void badge.offsetWidth;
    badge.classList.add('score-pop');
  }

  // ── Hole overview sheet ──────────────────────────────────────

  function showHoleOverview() {
    closeOverview();
    const wrap = document.createElement('div');
    wrap.id = 'hole-overview-wrap';

    const tiles = Array.from({ length: 18 }, (_, i) => {
      const status = holeStatus(i);
      const par = course.holes[i].par;
      const isCurrent = i === holeIndex;

      let bg, color, border;
      if (isCurrent) {
        bg = 'var(--primary)'; color = 'white'; border = 'none';
      } else if (status === 'complete') {
        bg = 'var(--primary-light)'; color = 'var(--primary)'; border = '1.5px solid var(--primary)';
      } else if (status === 'partial') {
        bg = '#fff8e1'; color = '#b45309'; border = '1.5px solid #fcd34d';
      } else {
        bg = 'var(--surface-2)'; color = 'var(--text)'; border = '1px solid var(--border-light)';
      }

      return `
        <button data-jump="${i}" style="background:${bg};color:${color};border:${border};border-radius:var(--radius-sm);padding:12px 6px;min-height:unset;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;transition:filter 0.12s ease;">
          <span style="font-size:22px;font-weight:700;line-height:1;">${i + 1}</span>
          <span style="font-size:11px;font-weight:500;opacity:0.75;">Par ${par}</span>
        </button>
      `;
    }).join('');

    wrap.innerHTML = `
      <div class="overlay" id="hole-overview-overlay"></div>
      <div class="bottom-sheet" id="hole-overview-sheet">
        <div class="handle"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h2 style="margin:0;color:var(--text);">Bahn wählen</h2>
          <div style="display:flex;gap:12px;font-size:11px;color:var(--text-muted);align-items:center;gap:8px;">
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--primary-light);border:1.5px solid var(--primary);display:inline-block;"></span> Fertig</span>
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:#fff8e1;border:1.5px solid #fcd34d;display:inline-block;"></span> Teils</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          ${tiles}
        </div>
      </div>
    `;

    document.body.appendChild(wrap);
    document.getElementById('hole-overview-overlay').addEventListener('click', closeOverview);
  }

  function closeOverview() {
    document.getElementById('hole-overview-wrap')?.remove();
  }

  // ── Advance / back ───────────────────────────────────────────

  async function advance() {
    const btn = container.querySelector('#btn-confirm');
    if (btn) btn.disabled = true;

    await Promise.all(
      roundPlayers.map(p => {
        round.scores[p.id][holeIndex] = currentScores[p.id];
        return saveHoleScore(roundId, p.id, holeIndex, currentScores[p.id]);
      })
    );

    if (holeIndex < 17) {
      holeIndex++;
      initScores();
      updateHash();
      draw();
    } else {
      location.hash = `#scorecard?roundId=${roundId}`;
    }
  }

  function goBack() {
    if (holeIndex > 0) {
      holeIndex--;
      initScores();
      updateHash();
      draw();
    } else {
      location.hash = '#home';
    }
  }

  function jumpToHole(i) {
    holeIndex = i;
    initScores();
    updateHash();
    closeOverview();
    draw();
  }

  // ── Init ─────────────────────────────────────────────────────

  // Tag this session so stale listeners from previous rounds self-disable
  container.dataset.playSession = roundId;

  initScores();
  draw();

  container.addEventListener('click', e => {
    if (container.dataset.playSession !== roundId) return;
    if (e.target.closest('#btn-back')) { goBack(); return; }
    if (e.target.closest('#btn-confirm')) { advance(); return; }
    if (e.target.closest('#btn-hole-overview')) { showHoleOverview(); return; }

    const minus = e.target.closest('[data-minus]');
    if (minus) {
      const pid = minus.dataset.minus;
      if (currentScores[pid] > 1) { currentScores[pid]--; updateScoreDisplay(pid); }
      return;
    }
    const plus = e.target.closest('[data-plus]');
    if (plus) {
      currentScores[plus.dataset.plus]++;
      updateScoreDisplay(plus.dataset.plus);
      return;
    }
  });

  // Delegated from body for the sheet (outside container); self-removes when session changes
  document.addEventListener('click', function onJump(e) {
    if (container.dataset.playSession !== roundId) {
      document.removeEventListener('click', onJump);
      return;
    }
    const tile = e.target.closest('[data-jump]');
    if (tile) jumpToHole(parseInt(tile.dataset.jump, 10));
  });
}
