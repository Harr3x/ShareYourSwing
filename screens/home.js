import { getActiveDraft } from '../db.js';
import { getCurrentUser, getMyRounds } from '../supabase.js';
import { icons } from '../components/icons.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function holesPlayed(scores) {
  return (scores || []).filter(s => s != null).length;
}

function totalScore(scores) {
  return (scores || []).reduce((s, v) => v != null ? s + v : s, 0);
}

function vsParStr(scores, holes) {
  let diff = 0;
  for (let i = 0; i < 18; i++) {
    if ((scores || [])[i] != null) diff += scores[i] - holes[i].par;
  }
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export async function render(container) {
  const [user, rounds, draft] = await Promise.all([
    getCurrentUser(), getMyRounds(), getActiveDraft(),
  ]);

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <h1 style="margin:0">ShareYourSwing</h1>
      <a href="#courses" style="color:var(--text-muted);text-decoration:none;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);box-shadow:var(--shadow-sm);" title="Plätze">${icons.courses}</a>
    </div>
    ${!user
      ? `<p class="text-muted">Bitte meld dich an.</p>`
      : draft
        ? `<a href="#play?draftId=${draft.id}&hole=0" class="btn-primary" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:14px;text-decoration:none;border-radius:var(--radius);margin-bottom:8px;">Runde fortsetzen ${icons.chevronRight}</a>`
        : `<button class="btn-primary" onclick="location.hash='#new-round'" style="margin-bottom:8px">Neue Runde ${icons.chevronRight}</button>`
    }
    <div class="mt-16">
      <h2>Meine Runden</h2>
      ${recentRoundsHTML(rounds)}
    </div>
  `;
}

function recentRoundsHTML(rounds) {
  if (!rounds.length) return '<p class="text-muted">Noch keine Runden.</p>';
  return rounds.map(r => {
    const date = new Date(r.date).toLocaleDateString('de-DE');
    const names = r.players.join(', ');
    const played = holesPlayed(r.myScores);
    const total = totalScore(r.myScores);
    const diff = vsParStr(r.myScores, r.holes);
    return `
      <div class="card" style="cursor:pointer;flex-direction:column;align-items:stretch;gap:4px;" onclick="location.hash='#cloud-scorecard?roundId=${r.id}'">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">${escapeHTML(r.courseName)}</span>
          <span style="color:var(--text-muted);display:flex;align-items:center">${icons.chevronRight}</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);">${date} · ${escapeHTML(names)} · ${played} Löcher</div>
        ${played > 0 ? `<div style="font-size:15px;font-weight:600;">Total: ${total} <span style="font-weight:400;color:var(--text-muted);">${diff}</span></div>` : ''}
      </div>
    `;
  }).join('');
}
