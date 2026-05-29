import { getAllPlayers, getAllCourses, getAllRounds } from '../db.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(container) {
  const [players, courses, rounds] = await Promise.all([
    getAllPlayers(), getAllCourses(), getAllRounds()
  ]);

  container.innerHTML = `
    <h1>ShareYourSwing ⛳</h1>
    ${!courses.length || !players.length
      ? `<p class="text-muted">Lege zuerst einen Platz und mindestens einen Spieler an.</p>`
      : `<button class="btn-primary" onclick="location.hash='#new-round'" style="margin-bottom:8px">Neue Runde →</button>`
    }
    <div class="mt-16">
      <h2>Letzte Runden</h2>
      ${await recentRoundsHTML(rounds, courses, players)}
    </div>
  `;
}

function holesPlayed(scores) {
  return scores.filter(s => s !== null).length;
}

async function recentRoundsHTML(rounds, courses, players) {
  if (!rounds.length) return '<p class="text-muted">Noch keine Runden.</p>';
  const courseMap = new Map(courses.map(c => [c.id, c]));
  const playerMap = new Map(players.map(p => [p.id, p]));
  return rounds
    .slice().sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map(r => {
      const course = courseMap.get(r.courseId);
      const date = new Date(r.date).toLocaleDateString('de-DE');
      const names = r.playerIds.map(id => playerMap.get(id)?.name ?? '?').join(', ');
      const holes = holesPlayed(r.scores[r.playerIds[0]]);
      return `
        <div class="card" style="cursor:pointer" onclick="location.hash='#scorecard?roundId=${r.id}'">
          <div>
            <div style="font-weight:600">${escapeHTML(course?.name ?? '?')}</div>
            <div class="text-muted">${date} · ${escapeHTML(names)} · ${holes} Löcher</div>
          </div>
          <span style="color:var(--text-muted)">→</span>
        </div>
      `;
    }).join('');
}
