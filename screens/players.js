import { getAllPlayers, addPlayer, deletePlayer, updatePlayer, putPlayer } from '../db.js';
import { computeHandicap } from '../utils/golf.js';
import { icons } from '../components/icons.js';
import { getFriends, getPendingRequests, acceptFriendRequest, removeFriend, sendFriendRequest, findProfileByUsername, signOut, getCurrentUser, getMyProfile, getCloudRoundsForPlayers } from '../supabase.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const iconBirdie    = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="5" r="4"/></svg>`;
const iconEagle     = `<svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="5" r="4"/><circle cx="11" cy="5" r="4"/></svg>`;
const iconFlag      = `<svg width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="1" x2="2" y2="11"/><path d="M2 1l6 2.5-6 2.5"/></svg>`;
const iconHoleInOne = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0l1.34 4.13H12L8.33 6.69l1.34 4.12L6 8.25l-3.67 2.56 1.34-4.12L0 4.13h4.66z"/></svg>`;

function computeBirdieStats(rounds, courseMap, playerId) {
  let birdies = 0, eagles = 0, holesInOne = 0;
  for (const r of rounds) {
    if (!r.playerIds.includes(playerId)) continue;
    const course = courseMap.get(r.courseId);
    if (!course) continue;
    const scores = r.scores[playerId];
    for (let i = 0; i < 18; i++) {
      if (scores[i] == null) continue;
      if (scores[i] === 1) { holesInOne++; continue; }
      const diff = scores[i] - course.holes[i].par;
      if (diff <= -2) eagles++;
      else if (diff === -1) birdies++;
    }
  }
  return { birdies, eagles, holesInOne };
}

function computeCourseRecords(rounds, courseMap, playerId) {
  // Group by course name — courseId = cloud_rounds.id (unique per round, not per course)
  const byCourse = new Map();
  for (const r of rounds) {
    const course = courseMap.get(r.courseId);
    if (!course) continue;
    if (!byCourse.has(course.name)) byCourse.set(course.name, { course, results: [] });
    for (const pid of r.playerIds) {
      const scores = r.scores[pid];
      if (!scores || scores.some(s => s == null)) continue;
      byCourse.get(course.name).results.push({ date: r.date, pid, total: scores.reduce((s, v) => s + v, 0) });
    }
  }

  const records = [];
  for (const { course, results } of byCourse.values()) {
    results.sort((a, b) => a.date.localeCompare(b.date));
    let recordScore = Infinity, recordHolder = null;
    for (const { pid, total } of results) {
      if (total < recordScore) { recordScore = total; recordHolder = pid; }
    }
    if (recordHolder === playerId) records.push({ name: course.name, score: recordScore });
  }
  return records;
}

function achievementChips(birdieStats, records) {
  const { birdies, eagles, holesInOne } = birdieStats;
  const chips = [];
  if (holesInOne > 0) chips.push(
    `<span class="achievement" style="background:#faf5ff;color:#7c3aed;border-color:#c4b5fd;">${iconHoleInOne} ${holesInOne} Hole in One</span>`
  );
  if (eagles > 0) chips.push(
    `<span class="achievement" style="background:#fffbe6;color:#b8860b;border-color:#edd56a;">${iconEagle} ${eagles} Eagle${eagles !== 1 ? 's' : ''}</span>`
  );
  if (birdies > 0) chips.push(
    `<span class="achievement" style="background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;">${iconBirdie} ${birdies} Birdie${birdies !== 1 ? 's' : ''}</span>`
  );
  for (const r of records) chips.push(
    `<span class="achievement" style="background:#fff3e0;color:#c2510a;border-color:#ffcc80;">${iconFlag} Rekord · ${escapeHTML(r.name)}</span>`
  );
  return chips.join('');
}

export async function render(container) {
  const [allPlayers, currentUser, friends] = await Promise.all([
    getAllPlayers(), getCurrentUser(), getFriends()
  ]);

  // Auto-add logged-in user as local player if not already present
  if (currentUser && !allPlayers.find(p => p.id === currentUser.id)) {
    const profile = await getMyProfile();
    await putPlayer({ id: currentUser.id, name: profile?.username || currentUser.email });
  }

  const friendIds = friends.map(f => f.userId);
  const { rounds, courseMap } = await getCloudRoundsForPlayers(
    currentUser ? [currentUser.id, ...friendIds] : friendIds
  );

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <h1 style="margin:0">Spieler</h1>
      <div style="display:flex;gap:8px;align-items:center">
        <button id="add-friend-btn" class="btn-icon" aria-label="Freund hinzufügen" title="Freund hinzufügen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
          </svg>
        </button>
        <button id="logout-btn" class="btn-icon" aria-label="Abmelden" title="Abmelden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div id="player-list"></div>
    <div id="friends-section"></div>
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
    const [players, friends, pending] = await Promise.all([
      getAllPlayers(), getFriends(), getPendingRequests()
    ]);

    // Valid IDs = current user + accepted friends (all Supabase UUIDs)
    const validIds = new Set([
      ...(currentUser ? [currentUser.id] : []),
      ...friends.map(f => f.userId),
    ]);

    // Remove stale local players (old random UUIDs from pre-cloud state)
    const stale = players.filter(p => !validIds.has(p.id));
    if (stale.length > 0) await Promise.all(stale.map(p => deletePlayer(p.id)));

    // Auto-add accepted friends not yet in local DB
    const localPlayerIds = new Set(players.map(p => p.id));
    const newFriends = friends.filter(f => !localPlayerIds.has(f.userId));
    if (newFriends.length > 0) {
      await Promise.all(newFriends.map(f => putPlayer({ id: f.userId, name: f.username })));
    }
    const allP = (stale.length > 0 || newFriends.length > 0) ? await getAllPlayers() : players;
    const friendMap = new Map(friends.map(f => [f.userId, f.friendshipId]));

    const list = container.querySelector('#player-list');
    if (!allP.length) {
      list.innerHTML = '<p class="text-muted">Noch keine Spieler.</p>';
    } else {
      const sorted = [...allP].sort((a, b) => {
        const ha = computeHandicap(rounds, courseMap, a.id).handicap;
        const hb = computeHandicap(rounds, courseMap, b.id).handicap;
        if (ha == null && hb == null) return 0;
        if (ha == null) return 1;
        if (hb == null) return -1;
        return ha - hb;
      });

      list.innerHTML = sorted.map(p => {
        const isMe = p.id === currentUser?.id;
        const hcp = computeHandicap(rounds, courseMap, p.id);
        const birdieStats = computeBirdieStats(rounds, courseMap, p.id);
        const records = computeCourseRecords(rounds, courseMap, p.id);
        const chips = achievementChips(birdieStats, records);
        const friendshipId = friendMap.get(p.id) || '';
        return `
          <div class="card" style="align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600">
                ${escapeHTML(p.name)}
                ${isMe ? '<span style="font-size:11px;background:var(--primary);color:#fff;border-radius:4px;padding:1px 6px;margin-left:6px;font-weight:500;vertical-align:middle">Du</span>' : ''}
                <span style="color:var(--text-muted);font-weight:400;font-size:14px;margin-left:6px">${hcp.handicap != null ? 'HCP ' + hcp.handicap.toFixed(1) : ''}</span>
              </div>
              ${chips ? `<div class="achievement-row">${chips}</div>` : ''}
            </div>
            ${!isMe ? `<button class="btn-icon" data-edit="${p.id}" data-friendship-id="${friendshipId}" aria-label="Optionen" style="flex-shrink:0;margin-top:2px;">${icons.edit}</button>` : ''}
          </div>
        `;
      }).join('');
    }

    const section = container.querySelector('#friends-section');
    let html = '';
    if (pending.length > 0) {
      html += `<h3 style="font-size:.95rem;margin:20px 0 10px;color:var(--text-muted)">Anfragen</h3>`;
      html += pending.map(p => `
        <div class="card" style="align-items:center;">
          <div style="flex:1;font-weight:500">@${escapeHTML(p.username)}</div>
          <button class="btn-primary accept-btn" data-id="${p.friendshipId}" style="padding:6px 14px;font-size:.85rem;min-height:auto">Annehmen</button>
        </div>
      `).join('');
    }
    section.innerHTML = html;
    section.querySelectorAll('.accept-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await acceptFriendRequest(btn.dataset.id);
        refresh();
      });
    });
  }

  function showAddFriendSheet() {
    showSheet(`
      <label style="font-weight:600;display:block;margin-bottom:6px">Benutzername</label>
      <input id="friend-username" placeholder="z.B. max_mustermann" style="margin-bottom:16px;" autocomplete="off">
      <p id="friend-msg" style="font-size:.9rem;margin-bottom:12px;display:none"></p>
      <button class="btn-primary" id="send-request-btn">Anfrage senden</button>
    `);
    const sheet = document.getElementById('bottom-sheet');
    sheet.querySelector('#send-request-btn').addEventListener('click', async () => {
      const username = sheet.querySelector('#friend-username').value.trim();
      const msgEl = sheet.querySelector('#friend-msg');
      if (!username) return;
      try {
        const profile = await findProfileByUsername(username);
        if (!profile) {
          msgEl.textContent = `Kein Nutzer "${username}" gefunden.`;
          msgEl.style.color = 'var(--error, #e53e3e)';
          msgEl.style.display = 'block';
          return;
        }
        await sendFriendRequest(profile.id);
        msgEl.textContent = `Anfrage an @${username} gesendet!`;
        msgEl.style.color = 'var(--primary)';
        msgEl.style.display = 'block';
      } catch (err) {
        msgEl.textContent = err.message;
        msgEl.style.color = 'var(--error, #e53e3e)';
        msgEl.style.display = 'block';
      }
    });
  }

  function showRemoveFriendSheet(playerId, friendshipId, playerName) {
    showSheet(`
      <p style="margin-bottom:20px">Freundschaft mit <strong>${escapeHTML(playerName)}</strong> aufheben?</p>
      <button class="btn-danger" id="remove-friend-btn" style="width:100%">Freundschaft auflösen</button>
    `);
    document.getElementById('bottom-sheet').querySelector('#remove-friend-btn').addEventListener('click', async () => {
      await removeFriend(friendshipId);
      await deletePlayer(playerId);
      closeSheet();
      await refresh();
    });
  }

  await refresh();

  container.querySelector('#add-friend-btn').addEventListener('click', showAddFriendSheet);
  container.querySelector('#logout-btn').addEventListener('click', () => signOut());

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const id = btn.dataset.edit;
    const friendshipId = btn.dataset.friendshipId;
    const allP = await getAllPlayers();
    const player = allP.find(p => p.id === id);
    if (player && friendshipId) showRemoveFriendSheet(id, friendshipId, player.name);
  });
}
