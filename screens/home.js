import { getAllPlayers, getAllCourses, getAllRounds, addRound, getCourse } from '../db.js';

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
      : renderWizard(players, courses)
    }
    <div class="mt-16">
      <h2>Letzte Runden</h2>
      ${await recentRoundsHTML(rounds, courses)}
    </div>
  `;

  if (courses.length && players.length) {
    container.querySelector('#start-round-btn').addEventListener('click', async () => {
      const courseId = container.querySelector('#select-course').value;
      const checked = [...container.querySelectorAll('.player-check:checked')].map(el => el.value);
      if (!checked.length) { alert('Mindestens einen Spieler wählen.'); return; }
      const round = await addRound(courseId, checked);
      location.hash = `#play?roundId=${round.id}&hole=0&player=0`;
    });
  }
}

function renderWizard(players, courses) {
  return `
    <h2>Neue Runde</h2>
    <label style="font-weight:600;display:block;margin-bottom:6px">Platz</label>
    <select id="select-course" style="width:100%;padding:12px;font-size:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;">
      ${courses.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('')}
    </select>
    <label style="font-weight:600;display:block;margin-bottom:8px">Spieler</label>
    <div id="player-checks" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
      ${players.map(p => `
        <label style="display:flex;align-items:center;gap:10px;font-size:16px;padding:10px;background:var(--surface);border-radius:var(--radius);">
          <input type="checkbox" class="player-check" value="${p.id}" style="width:20px;height:20px;">
          ${escapeHTML(p.name)}
        </label>
      `).join('')}
    </div>
    <button class="btn-primary" id="start-round-btn">Runde starten →</button>
  `;
}

async function recentRoundsHTML(rounds, courses) {
  if (!rounds.length) return '<p class="text-muted">Noch keine Runden.</p>';
  const courseMap = new Map(courses.map(c => [c.id, c]));
  return rounds
    .slice().sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map(r => {
      const course = courseMap.get(r.courseId);
      const date = new Date(r.date).toLocaleDateString('de-DE');
      return `
        <div class="card" style="cursor:pointer" onclick="location.hash='#scorecard?roundId=${r.id}'">
          <div>
            <div style="font-weight:600">${escapeHTML(course?.name ?? '?')}</div>
            <div class="text-muted">${date}</div>
          </div>
          <span style="color:var(--text-muted)">→</span>
        </div>
      `;
    }).join('');
}
