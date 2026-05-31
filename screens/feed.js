import { getFeedRounds, getCurrentUser } from '../supabase.js';

export async function render(container) {
  container.innerHTML = `
    <div style="padding:20px">
      <h2 style="margin-bottom:24px">Feed</h2>
      <div id="feed-list"><p style="color:#999">Wird geladen...</p></div>
    </div>
  `;

  const [rounds, me] = await Promise.all([getFeedRounds(), getCurrentUser()]);
  const feedEl = container.querySelector('#feed-list');

  if (rounds.length === 0) {
    feedEl.innerHTML = '<p style="color:#999">Noch keine Runden. Teile eine Runde oder füge Freunde hinzu!</p>';
    return;
  }

  feedEl.innerHTML = rounds.map(round => {
    const participants = round.round_participants || [];
    const scorer = round['profiles!cloud_rounds_created_by_fkey'];
    const date = new Date(round.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
    const isMe = round.created_by === me.id;

    const participantRows = participants.map(p => {
      const total = (p.scores || []).filter(s => s !== null).reduce((a, b) => a + b, 0);
      return `<span style="font-size:.85rem;padding:4px 10px;background:var(--surface-2);border-radius:20px;margin-right:6px">${p.display_name}: ${total}</span>`;
    }).join('');

    return `
      <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-weight:600">${round.course_name}</div>
            <div style="font-size:.85rem;color:#666;margin-top:2px">${isMe ? 'Du' : '@' + scorer?.username} · ${date}</div>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${participantRows}</div>
      </div>
    `;
  }).join('');
}
