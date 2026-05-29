import { getAllPlayers, addPlayer, deletePlayer } from '../db.js';

export async function render(container) {
  container.innerHTML = '<h1>Spieler</h1><div id="player-list"></div>'
    + '<div class="mt-16"><input id="new-player-name" placeholder="Name" style="width:100%;padding:12px;font-size:16px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;">'
    + '<button class="btn-primary" id="add-player-btn">Spieler hinzufügen</button></div>';

  async function refresh() {
    const players = await getAllPlayers();
    const list = container.querySelector('#player-list');
    if (!players.length) {
      list.innerHTML = '<p class="text-muted">Noch keine Spieler.</p>';
      return;
    }
    list.innerHTML = players.map(p => `
      <div class="card">
        <span>${p.name}</span>
        <button class="btn-danger" style="padding:0 14px;min-height:36px;font-size:13px;" data-delete="${p.id}">Löschen</button>
      </div>
    `).join('');
  }

  await refresh();

  container.querySelector('#add-player-btn').addEventListener('click', async () => {
    const input = container.querySelector('#new-player-name');
    const name = input.value.trim();
    if (!name) return;
    await addPlayer(name);
    input.value = '';
    await refresh();
  });

  container.addEventListener('click', async e => {
    const id = e.target.dataset.delete;
    if (!id) return;
    await deletePlayer(id);
    await refresh();
  });
}
