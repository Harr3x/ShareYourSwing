import { getAllPlayers, getAllRounds, getAllCourses, addPlayer, deletePlayer, updatePlayer } from '../db.js';
import { computeHandicap } from '../utils/golf.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(container) {
  const [allPlayers, rounds, courses] = await Promise.all([
    getAllPlayers(), getAllRounds(), getAllCourses()
  ]);
  const courseMap = new Map(courses.map(c => [c.id, c]));

  container.innerHTML = `
    <h1>Spieler</h1>
    <div id="player-list"></div>
    <button class="btn-primary" id="show-form-btn" style="margin-top:16px">Spieler hinzufügen</button>
  `;

  function closeSheet() {
    const existing = document.getElementById('sheet-wrap');
    if (existing) existing.remove();
  }

  function showSheet(innerHTML) {
    closeSheet();
    const wrap = document.createElement('div');
    wrap.id = 'sheet-wrap';
    wrap.innerHTML = `
      <div class="overlay" id="sheet-overlay"></div>
      <div class="bottom-sheet" id="bottom-sheet">
        <div class="handle"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('sheet-overlay').addEventListener('click', closeSheet);
    updateSheetContent(innerHTML);
  }

  function updateSheetContent(innerHTML) {
    const sheet = document.getElementById('bottom-sheet');
    if (!sheet) return;
    const content = sheet.querySelector('#sheet-content');
    if (content) content.innerHTML = innerHTML;
    else sheet.insertAdjacentHTML('beforeend', `<div id="sheet-content">${innerHTML}</div>`);
  }

  async function refresh() {
    const players = await getAllPlayers();
    const list = container.querySelector('#player-list');
    if (!players.length) {
      list.innerHTML = '<p class="text-muted">Noch keine Spieler.</p>';
      return;
    }
    list.innerHTML = players.map(p => {
      const hcp = computeHandicap(rounds, courseMap, p.id);
      return `
      <div class="card">
        <span>${escapeHTML(p.name)} <span style="color:var(--text-muted);font-weight:400">${hcp.handicap != null ? 'HCP ' + hcp.handicap.toFixed(1) : ''}</span></span>
        <button style="background:none;border:none;font-size:18px;cursor:pointer;padding:8px;min-height:unset;border-radius:50%;" data-edit="${p.id}">✏️</button>
      </div>
    `}).join('');
  }

  function showAddStep() {
    showSheet(`
      <label style="font-weight:600;display:block;margin-bottom:6px">Spielername</label>
      <input id="new-player-name" placeholder="Name" style="width:100%;padding:12px;font-size:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;">
      <button class="btn-primary" id="add-player-btn">Hinzufügen</button>
    `);

    const sheet = document.getElementById('bottom-sheet');
    sheet.querySelector('#add-player-btn').addEventListener('click', async () => {
      const name = sheet.querySelector('#new-player-name').value.trim();
      if (!name) return;
      await addPlayer(name);
      closeSheet();
      await refresh();
    });
  }

  function showEditStep(id, currentName) {
    showSheet(`
      <label style="font-weight:600;display:block;margin-bottom:6px">Name</label>
      <input id="edit-player-name" value="${escapeHTML(currentName)}" style="width:100%;padding:12px;font-size:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;">
      <button class="btn-primary" id="save-player-btn">Speichern</button>
      <button class="btn-danger" id="delete-player-btn" style="margin-top:12px;width:100%">Spieler löschen</button>
    `);

    const sheet = document.getElementById('bottom-sheet');
    sheet.querySelector('#save-player-btn').addEventListener('click', async () => {
      const name = sheet.querySelector('#edit-player-name').value.trim();
      if (!name) return;
      await updatePlayer(id, name);
      closeSheet();
      await refresh();
    });
    sheet.querySelector('#delete-player-btn').addEventListener('click', async () => {
      await deletePlayer(id);
      closeSheet();
      await refresh();
    });
  }

  await refresh();

  container.querySelector('#show-form-btn').addEventListener('click', showAddStep);

  container.addEventListener('click', async e => {
    const id = e.target.dataset.edit;
    if (!id) return;
    const player = allPlayers.find(p => p.id === id);
    if (player) showEditStep(id, player.name);
  });
}