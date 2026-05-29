import { getRound, getCourse, getAllPlayers, saveHoleScore } from '../db.js';
import { getScoreClass, getScoreLabel } from '../utils/golf.js';
import { icons } from '../components/icons.js';

export async function render(container, params) {
  const { roundId } = params;
  let holeIndex = parseInt(params.hole ?? '0', 10);
  let playerIndex = parseInt(params.player ?? '0', 10);

  const [round, players] = await Promise.all([
    getRound(roundId),
    getAllPlayers(),
  ]);
  const course = await getCourse(round.courseId);

  const playerMap = new Map(players.map(p => [p.id, p]));
  const roundPlayers = round.playerIds.map(id => playerMap.get(id)).filter(Boolean);

  function currentPar() {
    return course.holes[holeIndex].par;
  }

  let currentScore = currentPar();

  function updateHash() {
    history.replaceState(null, '', `#play?roundId=${roundId}&hole=${holeIndex}&player=${playerIndex}`);
  }

  function draw() {
    const player = roundPlayers[playerIndex];
    const par = currentPar();
    const cls = getScoreClass(currentScore, par);
    const label = getScoreLabel(currentScore, par);
    const totalPlayers = roundPlayers.length;

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <button class="btn-ghost" id="btn-back" style="padding:0 14px;display:inline-flex;align-items:center;gap:4px">${icons.chevronLeft} Zurück</button>
        <span style="font-size:13px;color:var(--text-muted)">Spieler ${playerIndex + 1} / ${totalPlayers}</span>
        <a href="#scorecard?roundId=${roundId}" style="color:var(--text-muted);display:flex;align-items:center;text-decoration:none;padding:8px" title="Scorecard">${icons.scorecard}</a>
      </div>

      <div style="text-align:center;margin-bottom:4px">
        <div style="font-size:28px;font-weight:700;margin-top:4px;letter-spacing:-0.5px">${player.name}</div>
      </div>

      <div class="hole-header">
        <div class="hole-number">Bahn ${holeIndex + 1}</div>
        <div class="par-badge">Par ${par}</div>
      </div>

      <div class="score-counter" style="justify-content:center;margin-bottom:8px;">
        <button id="btn-minus">−</button>
        <div class="score-value">
          <span class="${cls}" style="width:64px;height:64px;font-size:36px;">${currentScore}</span>
        </div>
        <button id="btn-plus">+</button>
      </div>

      <div style="text-align:center;margin-bottom:32px;font-size:14px;color:var(--text-muted);min-height:20px">${label}</div>

      <button class="btn-primary" id="btn-confirm">Bestätigen</button>
    `;

    container.querySelector('#btn-minus').addEventListener('click', () => {
      if (currentScore > 1) { currentScore--; draw(); }
    });
    container.querySelector('#btn-plus').addEventListener('click', () => {
      currentScore++;
      draw();
    });
    container.querySelector('#btn-confirm').addEventListener('click', async () => {
      round.scores[round.playerIds[playerIndex]][holeIndex] = currentScore;
      await saveHoleScore(roundId, round.playerIds[playerIndex], holeIndex, currentScore);
      advance();
    });
    container.querySelector('#btn-back').addEventListener('click', () => {
      goBack();
    });
  }

  function advance() {
    if (playerIndex < roundPlayers.length - 1) {
      playerIndex++;
      currentScore = currentPar();
      updateHash();
      draw();
    } else if (holeIndex < 17) {
      holeIndex++;
      playerIndex = 0;
      currentScore = currentPar();
      updateHash();
      draw();
    } else {
      location.hash = `#scorecard?roundId=${roundId}`;
    }
  }

  function goBack() {
    if (playerIndex > 0) {
      playerIndex--;
      const prevScore = round.scores[round.playerIds[playerIndex]]?.[holeIndex];
      currentScore = prevScore ?? currentPar();
      updateHash();
      draw();
    } else if (holeIndex > 0) {
      holeIndex--;
      playerIndex = roundPlayers.length - 1;
      const prevScore = round.scores[round.playerIds[playerIndex]]?.[holeIndex];
      currentScore = prevScore ?? currentPar();
      updateHash();
      draw();
    } else {
      location.hash = '#home';
    }
  }

  draw();
}
