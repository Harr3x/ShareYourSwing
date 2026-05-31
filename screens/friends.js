import { getFriends, getPendingRequests, acceptFriendRequest, sendFriendRequest, findProfileByUsername, signOut } from '../supabase.js';

export async function render(container) {
  container.innerHTML = `
    <div style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <h2 style="margin:0">Freunde</h2>
        <button id="logout-btn" style="padding:6px 14px;border:1px solid var(--border);border-radius:8px;background:white;cursor:pointer;font-size:.85rem">Abmelden</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:24px">
        <input type="text" id="search-input" placeholder="Benutzername suchen..." style="flex:1;padding:10px;border:1px solid var(--border);border-radius:10px">
        <button id="add-btn" class="btn-primary" style="padding:10px 16px;white-space:nowrap">Hinzufügen</button>
      </div>
      <p id="add-msg" style="font-size:.9rem;margin-bottom:20px;display:none"></p>

      <h3 style="font-size:1rem;margin-bottom:12px">Offene Anfragen</h3>
      <div id="pending-list" style="margin-bottom:24px"></div>

      <h3 style="font-size:1rem;margin-bottom:12px">Meine Freunde</h3>
      <div id="friends-list"></div>
    </div>
  `;

  container.querySelector('#logout-btn').addEventListener('click', () => signOut());

  async function reload() {
    const [friends, pending] = await Promise.all([getFriends(), getPendingRequests()]);

    const pendingEl = container.querySelector('#pending-list');
    pendingEl.innerHTML = pending.length === 0
      ? '<p style="color:#999;font-size:.9rem">Keine offenen Anfragen.</p>'
      : pending.map(p => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--surface-2);border-radius:10px;margin-bottom:8px">
            <span>@${p.username}</span>
            <button data-id="${p.friendshipId}" class="accept-btn btn-primary" style="padding:6px 14px;font-size:.85rem">Annehmen</button>
          </div>
        `).join('');

    pendingEl.querySelectorAll('.accept-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await acceptFriendRequest(btn.dataset.id);
        reload();
      });
    });

    const friendsEl = container.querySelector('#friends-list');
    friendsEl.innerHTML = friends.length === 0
      ? '<p style="color:#999;font-size:.9rem">Noch keine Freunde.</p>'
      : friends.map(f => `
          <div style="padding:12px;background:var(--surface-2);border-radius:10px;margin-bottom:8px">
            @${f.username}
          </div>
        `).join('');
  }

  reload();

  container.querySelector('#add-btn').addEventListener('click', async () => {
    const username = container.querySelector('#search-input').value.trim();
    const msgEl = container.querySelector('#add-msg');
    if (!username) return;

    try {
      const profile = await findProfileByUsername(username);
      if (!profile) {
        msgEl.textContent = `Kein Nutzer mit Username "${username}" gefunden.`;
        msgEl.style.color = '#e53e3e';
        msgEl.style.display = 'block';
        return;
      }
      await sendFriendRequest(profile.id);
      msgEl.textContent = `Freundschaftsanfrage an @${username} gesendet!`;
      msgEl.style.color = '#38a169';
      msgEl.style.display = 'block';
      container.querySelector('#search-input').value = '';
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.style.color = '#e53e3e';
      msgEl.style.display = 'block';
    }
  });
}
