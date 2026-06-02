import { addDraft, setCloudRoundId } from '../db.js';
import { getCourses, getCurrentUser, getFriends, createActiveRound } from '../supabase.js';
import { icons } from '../components/icons.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(container) {
  const [courses, user, friends] = await Promise.all([
    getCourses(), getCurrentUser(), getFriends(),
  ]);

  if (!courses.length) {
    container.innerHTML = `
      <h1>Neue Runde</h1>
      <p class="text-muted">Lege zuerst einen Platz an.</p>
      <button class="btn-primary" onclick="location.hash='#home'" style="margin-top:16px">Zurück</button>
    `;
    return;
  }

  const players = [
    { id: user.id, name: user.user_metadata?.username || user.email },
    ...friends.map(f => ({ id: f.userId, name: f.username })),
  ];

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
          <input type="checkbox" class="player-check" value="${p.id}" ${p.id === user.id ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary);flex-shrink:0;">
          ${escapeHTML(p.name)}
        </label>
      `).join('')}
    </div>
    <p id="start-error" style="color:var(--danger,#e53e3e);font-size:14px;min-height:20px;margin:0;"></p>
    <button class="btn-primary" id="start-round-btn">Runde starten ${icons.chevronRight}</button>
  `;

  container.querySelector('#start-round-btn').addEventListener('click', async () => {
    const errorEl = container.querySelector('#start-error');
    errorEl.textContent = '';
    const courseId = container.querySelector('#select-course').value;
    const checked = [...container.querySelectorAll('.player-check:checked')].map(el => el.value);
    if (!checked.length) { errorEl.textContent = 'Mindestens einen Spieler auswählen.'; return; }

    const btn = container.querySelector('#start-round-btn');
    btn.disabled = true;

    try {
      const course = courses.find(c => c.id === courseId);
      const playerNames = Object.fromEntries(players.map(p => [p.id, p.name]));
      const scores = Object.fromEntries(checked.map(pid => [pid, Array(18).fill(null)]));

      const draft = await addDraft({
        courseId: course.id,
        courseName: course.name,
        holes: course.holes,
        playerIds: checked,
        playerNames,
        date: new Date().toISOString(),
        scores,
      });

      if (navigator.onLine) {
        try {
          const cloudId = await createActiveRound(
            course.name, draft.date, checked, playerNames, course.holes
          );
          await setCloudRoundId(draft.id, cloudId);
        } catch (e) {
          console.warn('createActiveRound failed, continuing offline:', e);
        }
      }

      location.hash = `#play?draftId=${draft.id}&hole=0`;
    } catch (err) {
      console.error('start round failed:', err);
      errorEl.textContent = `Fehler: ${err.message ?? err}`;
      btn.disabled = false;
    }
  });
}
