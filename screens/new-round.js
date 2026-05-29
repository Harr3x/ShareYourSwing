import { getAllPlayers, getAllCourses, addRound } from '../db.js';
import { icons } from '../components/icons.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(container) {
  const [players, courses] = await Promise.all([
    getAllPlayers(), getAllCourses()
  ]);

  if (!courses.length || !players.length) {
    container.innerHTML = `
      <h1>Neue Runde</h1>
      <p class="text-muted">Lege zuerst einen Platz und mindestens einen Spieler an.</p>
      <button class="btn-primary" onclick="location.hash='#home'" style="margin-top:16px">Zurück</button>
    `;
    return;
  }

  container.innerHTML = `
    <h1>Neue Runde</h1>
    <a href="#home" style="display:inline-flex;align-items:center;gap:4px;margin-bottom:20px;color:var(--text-muted);text-decoration:none">${icons.chevronLeft} Zurück</a>
    <label style="font-weight:600;display:block;margin-bottom:6px">Platz</label>
    <select id="select-course" style="margin-bottom:20px;">
      ${courses.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('')}
    </select>
    <label style="font-weight:600;display:block;margin-bottom:8px">Spieler</label>
    <div id="player-checks" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      ${players.map(p => `
        <label style="display:flex;align-items:center;gap:12px;font-size:16px;padding:12px 14px;background:var(--surface);border:1px solid var(--border-light);border-radius:var(--radius);box-shadow:var(--shadow-sm);cursor:pointer;">
          <input type="checkbox" class="player-check" value="${p.id}" style="width:18px;height:18px;accent-color:var(--primary);flex-shrink:0;">
          ${escapeHTML(p.name)}
        </label>
      `).join('')}
    </div>
    <button class="btn-primary" id="start-round-btn">Runde starten ${icons.chevronRight}</button>
  `;

  container.querySelector('#start-round-btn').addEventListener('click', async () => {
    const courseId = container.querySelector('#select-course').value;
    const checked = [...container.querySelectorAll('.player-check:checked')].map(el => el.value);
    if (!checked.length) { alert('Mindestens einen Spieler wählen.'); return; }
    const round = await addRound(courseId, checked);
    location.hash = `#play?roundId=${round.id}&hole=0&player=0`;
  });
}
