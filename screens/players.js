import { getAllPlayers, getAllRounds, getAllCourses, addPlayer, deletePlayer, updatePlayer } from '../db.js';
import { computeHandicap } from '../utils/golf.js';
import { icons } from '../components/icons.js';
import { getFriends, getPendingRequests, acceptFriendRequest, sendFriendRequest, findProfileByUsername, signOut } from '../supabase.js';

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
  const records = [];
  const courseIds = [...new Set(rounds.map(r => r.courseId))];
  for (const courseId of courseIds) {
    const course = courseMap.get(courseId);
    if (!course) continue;
    let best = Infinity, holders = [];
    for (const r of rounds.filter(r => r.courseId === courseId)) {
      for (const pid of r.playerIds) {
        const scores = r.scores[pid];
        if (!scores || scores.some(s => s == null)) continue;
        const total = scores.reduce((s, v) => s + v, 0);
        if (total < best) { best = total; holders = [pid]; }
        else if (total === best && !holders.includes(pid)) holders.push(pid);
      }
    }
    if (holders.includes(playerId) && best < Infinity) {
      records.push({ name: course.name, score: best });
    }
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
  const [allPlayers, rounds, courses] = await Promise.all([
    getAllPlayers(), getAllRounds(), getAllCourses()
  ]);
  const courseMap = new Map(courses.map(c => [c.id, c]));

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
    const players = await getAllPlayers();
    const list = container.querySelector('#player-list');
    if (!players.length) {
      list.innerHTML = '<p class="text-muted">Noch keine Spieler.</p>';
    } else {
      const sorted = [...players].sort((a, b) => {
        const ha = computeHandicap(rounds, courseMap, a.id).handicap;
        const hb = computeHandicap(rounds, courseMap, b.id).handicap;
        if (ha == null && hb == null) return 0;
        if (ha == null) return 1;
        if (hb == null) return -1;
        return ha - hb;
      });

      list.innerHTML = sorted.map(p => {
        const hcp = computeHandicap(rounds, courseMap, p.id);
        const birdieStats = computeBirdieStats(rounds, courseMap, p.id);
        const records = computeCourseRecords(rounds, courseMap, p.id);
        const chips = achievementChips(birdieStats, records);
        return `
          <div class="card" style="align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600">${escapeHTML(p.name)}<span style="color:var(--text-muted);font-weight:400;font-size:14px;margin-left:6px">${hcp.handicap != null ? 'HCP ' + hcp.handicap.toFixed(1) : ''}</span></div>
              ${chips ? `<div class="achievement-row">${chips}</div>` : ''}
            </div>
            <button class="btn-icon" data-edit="${p.id}" aria-label="Bearbeiten" style="flex-shrink:0;margin-top:2px;">${icons.edit}</button>
          </div>
        `;
      }).join('');
    }

    // Freunde + Anfragen
    const [friends, pending] = await Promise.all([getFriends(), getPendingRequests()]);
    const localPlayerNames = players.map(p => p.name.toLowerCase());
    const newFriends = friends.filter(f => !localPlayerNames.includes(f.username.toLowerCase()));

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

    if (newFriends.length > 0) {
      html += `<h3 style="font-size:.95rem;margin:20px 0 10px;color:var(--text-muted)">Freunde</h3>`;
      html += newFriends.map(f => `
        <div class="card" style="align-items:center;">
          <div style="flex:1;font-weight:500">@${escapeHTML(f.username)}</div>
          <button class="btn-primary add-as-player-btn" data-username="${escapeHTML(f.username)}" style="padding:6px 14px;font-size:.85rem;min-height:auto">+ Spieler</button>
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

    section.querySelectorAll('.add-as-player-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await addPlayer(btn.dataset.username);
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

  function showEditStep(id, currentName) {
    showSheet(`
      <label style="font-weight:600;display:block;margin-bottom:6px">Name</label>
      <input id="edit-player-name" value="${escapeHTML(currentName)}" style="margin-bottom:16px;">
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

  container.querySelector('#add-friend-btn').addEventListener('click', showAddFriendSheet);
  container.querySelector('#logout-btn').addEventListener('click', () => signOut());

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const id = btn.dataset.edit;
    const player = allPlayers.find(p => p.id === id);
    if (player) showEditStep(id, player.name);
  });
}
