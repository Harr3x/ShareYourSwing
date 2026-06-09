import { getDraft, saveDraftScore, setCloudRoundId, setPendingSync } from '../db.js';
import { createActiveRound, syncParticipantScores, syncOtherParticipantScore, getActiveRound, getCurrentUser, getCloudRoundsForPlayers } from '../supabase.js';
import { getScoreClass, getScoreLabel, computeHandicap } from '../utils/golf.js';
import { icons } from '../components/icons.js';
import { haversineMeters } from '../utils/geo.js';

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(container, params) {
  const draftId = params.draftId || null;
  const cloudRoundId = params.cloudRoundId || null;
  const isJoinMode = !!cloudRoundId;
  let holeIndex = parseInt(params.hole ?? '0', 10);

  let currentUser = null;
  try { currentUser = await getCurrentUser(); } catch (e) {}
  let cloudRoundScoreCache = {};

  let draft;
  let isCreator = true;

  if (isJoinMode) {
    let cloudRound;
    try {
      cloudRound = await getActiveRound(cloudRoundId);
    } catch (e) {
      container.innerHTML = '<p style="padding:20px">Runde nicht gefunden.</p>';
      return;
    }
    isCreator = cloudRound.createdBy === currentUser?.id;
    // Build virtual draft — same shape as IndexedDB draft so all helpers work unchanged
    draft = {
      holes: cloudRound.holes,
      playerIds: cloudRound.players.map(p => p.id),
      playerNames: Object.fromEntries(cloudRound.players.map(p => [p.id, p.name])),
      scores: Object.fromEntries(cloudRound.players.map(p => [p.id, [...p.scores]])),
      cloudRoundId,
    };
    // Seed cache with loaded scores
    cloudRound.players.forEach(p => { cloudRoundScoreCache[p.id] = [...p.scores]; });
  } else {
    draft = await getDraft(draftId);
    if (!draft) {
      container.innerHTML = '<p style="padding:20px">Runde nicht gefunden.</p>';
      return;
    }
  }

  const roundPlayers = draft.playerIds.map(id => ({ id, name: draft.playerNames[id] || id }));

  let hcpMap = {};
  try {
    const { rounds, courseMap } = await getCloudRoundsForPlayers(draft.playerIds);
    for (const pid of draft.playerIds) {
      const { handicap } = computeHandicap(rounds, courseMap, pid);
      hcpMap[pid] = handicap ?? 36;
    }
  } catch (e) {
    for (const pid of draft.playerIds) hcpMap[pid] = 36;
  }

  function currentPar() { return draft.holes[holeIndex].par; }

  let currentScores = {};
  let watchId = null;
  let currentPosition = null;
  let currentDistance = null;
  let holeMap = null;
  let mapMarker = null;
  let mapCircle = null;

  let pollInterval = null;

  const flagIcon = L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" width="24" height="34"><circle cx="8" cy="5" r="2.5" fill="#555"/><line x1="8" y1="7" x2="8" y2="34" stroke="#555" stroke-width="2.5" stroke-linecap="round"/><path d="M8 7 L22 11 L8 15 Z" fill="#e53935"/></svg>`,
    iconSize: [24, 34],
    iconAnchor: [12, 34],
  });

  function initScores() {
    roundPlayers.forEach(p => {
      currentScores[p.id] = draft.scores[p.id][holeIndex] ?? null;
    });
  }

  function initMap() {
    const hole = draft.holes[holeIndex];
    if (hole?.pinLat == null) return;

    const mapEl = container.querySelector('#hole-map');
    if (!mapEl) return;

    holeMap = L.map(mapEl, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(holeMap);

    mapMarker = L.marker([hole.pinLat, hole.pinLng], { icon: flagIcon }).addTo(holeMap);

    if (currentPosition) {
      mapCircle = L.circle([currentPosition.lat, currentPosition.lng], {
        radius: 3,
        color: '#2196F3',
        fillColor: '#2196F3',
        fillOpacity: 0.8,
        weight: 2,
      }).addTo(holeMap);
      holeMap.fitBounds([
        [hole.pinLat, hole.pinLng],
        [currentPosition.lat, currentPosition.lng],
      ], { padding: [30, 30], maxZoom: 18 });
    } else {
      holeMap.setView([hole.pinLat, hole.pinLng], 16);
    }
  }

  function updateMap() {
    const hole = draft.holes[holeIndex];
    if (!holeMap || !hole?.pinLat) return;

    if (mapMarker) {
      mapMarker.setLatLng([hole.pinLat, hole.pinLng]);
    } else {
      mapMarker = L.marker([hole.pinLat, hole.pinLng], { icon: flagIcon }).addTo(holeMap);
    }

    if (currentPosition) {
      if (mapCircle) {
        mapCircle.setLatLng([currentPosition.lat, currentPosition.lng]);
      } else {
        mapCircle = L.circle([currentPosition.lat, currentPosition.lng], {
          radius: 3,
          color: '#2196F3',
          fillColor: '#2196F3',
          fillOpacity: 0.8,
          weight: 2,
        }).addTo(holeMap);
      }
      holeMap.fitBounds([
        [hole.pinLat, hole.pinLng],
        [currentPosition.lat, currentPosition.lng],
      ], { padding: [30, 30], maxZoom: 18 });
    }
  }

  function destroyMap() {
    if (holeMap) {
      holeMap.remove();
      holeMap = null;
      mapMarker = null;
      mapCircle = null;
    }
  }

  function startGpsWatch() {
    if (!navigator.geolocation) return;
    const hole = draft.holes[holeIndex];
    if (hole?.pinLat == null) return;

    watchId = navigator.geolocation.watchPosition(
      pos => {
        currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const hole = draft.holes[holeIndex];
        if (hole?.pinLat != null) {
          currentDistance = haversineMeters(
            currentPosition.lat, currentPosition.lng,
            hole.pinLat, hole.pinLng
          );
        }
        const el = container.querySelector('#distance-display');
        if (el) el.textContent = currentDistance != null ? `${currentDistance}m zum Loch` : 'GPS...';
        updateMap();
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
  }

  function stopGpsWatch() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  function updateHash() {
    if (isJoinMode) {
      history.replaceState(null, '', `#play?cloudRoundId=${cloudRoundId}&hole=${holeIndex}`);
    } else {
      history.replaceState(null, '', `#play?draftId=${draftId}&hole=${holeIndex}`);
    }
  }

  function holeStatus(i) {
    const scored = roundPlayers.filter(p => draft.scores[p.id][i] != null).length;
    if (scored === 0) return 'empty';
    if (scored === roundPlayers.length) return 'complete';
    return 'partial';
  }

  function progressDots() {
    return Array.from({ length: 18 }, (_, i) => {
      let cls = 'hole-dot';
      if (i === holeIndex) cls += ' hole-dot--active';
      else if (i < holeIndex) cls += ' hole-dot--done';
      return `<span class="${cls}"></span>`;
    }).join('');
  }

  function vsParSoFar(pid) {
    let diff = 0, hasAny = false;
    for (let i = 0; i < 18; i++) {
      const s = draft.scores[pid][i];
      if (s != null) { diff += s - draft.holes[i].par; hasAny = true; }
    }
    return hasAny ? diff : null;
  }

  function totalChipHTML(pid) {
    const diff = vsParSoFar(pid);
    if (diff === null) return '';
    const isOver = diff > (hcpMap[pid] ?? 36);
    const label = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
    const style = isOver
      ? 'background:#fdf0ee;border:1px solid #e8b4ae;color:#c0392b;'
      : 'background:var(--surface-2);border:1px solid var(--border);color:var(--text);';
    return `<span data-chip="${pid}" style="border-radius:20px;padding:2px 8px;font-size:12px;font-weight:600;${style}">${label}</span>`;
  }

  function scoreBadgeContent(score, par) {
    if (score == null) return { cls: 'golf-muted', display: '−', label: '' };
    if (score === 0) return { cls: 'golf-par', display: '—', label: 'Nicht gespielt' };
    return { cls: getScoreClass(score, par), display: score, label: getScoreLabel(score, par) };
  }

  function playerCardHTML(p) {
    const par = currentPar();
    const score = currentScores[p.id];
    const { cls, display, label } = scoreBadgeContent(score, par);
    return `
      <div class="card" data-card="${p.id}" style="flex-direction:column;align-items:stretch;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:17px;font-weight:600;letter-spacing:-0.2px;">${escapeHTML(p.name)}</div>
          ${totalChipHTML(p.id)}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <button data-minus="${p.id}" style="width:52px;height:52px;min-height:unset;border-radius:50%;font-size:26px;font-weight:300;background:var(--surface-2);border:1.5px solid var(--border);box-shadow:var(--shadow-sm);display:inline-flex;align-items:center;justify-content:center;">−</button>
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
            <span class="${cls}" data-badge="${p.id}" style="width:52px;height:52px;font-size:24px;">${display}</span>
            <div data-label="${p.id}" style="font-size:12px;color:var(--text-muted);font-weight:500;min-height:16px;text-align:center;">${label}</div>
          </div>
          <button data-plus="${p.id}" style="width:52px;height:52px;min-height:unset;border-radius:50%;font-size:26px;font-weight:300;background:var(--surface-2);border:1.5px solid var(--border);box-shadow:var(--shadow-sm);display:inline-flex;align-items:center;justify-content:center;">+</button>
        </div>
      </div>
    `;
  }

  function draw() {
    const par = currentPar();
    const isLast = holeIndex === 17;

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
        <button id="btn-back" class="btn-ghost" style="padding:0 12px;font-size:14px;display:inline-flex;align-items:center;gap:4px;flex-shrink:0;">${icons.chevronLeft} Zurück</button>
        <div class="hole-progress">${progressDots()}</div>
        ${!isJoinMode ? `<a href="#scorecard?draftId=${draftId}&fromHole=${holeIndex}" style="color:var(--text-muted);display:flex;align-items:center;text-decoration:none;padding:6px;flex-shrink:0;" title="Scorecard">${icons.scorecard}</a>` : '<span style="width:30px;flex-shrink:0;"></span>'}
      </div>

      <button id="btn-hole-overview" style="width:100%;background:none;border:none;border-radius:var(--radius);padding:8px 16px 16px;min-height:unset;text-align:center;cursor:pointer;transition:background 0.15s ease;" title="Bahn wählen">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:2px;">Bahn</div>
        <div style="font-size:56px;font-weight:700;line-height:1;letter-spacing:-3px;color:var(--text);">${holeIndex + 1}</div>
        <div class="par-badge" style="display:inline-flex;margin-top:10px;">Par ${par}</div>
      </button>

      ${draft.holes[holeIndex]?.pinLat != null ? `
      <div id="map-container" style="border-radius:var(--radius);overflow:hidden;margin-top:12px;margin-bottom:16px;background:var(--surface);border:1.5px solid var(--border);box-shadow:var(--shadow-sm);">
        <div id="hole-map" style="width:100%;height:180px;"></div>
        <div id="distance-display" style="text-align:center;font-size:16px;font-weight:600;color:var(--text);padding:8px 0 10px;min-height:24px">${currentDistance != null ? currentDistance + 'm zum Loch' : 'GPS...'}</div>
      </div>` : ''}

      <div id="player-cards">
        ${roundPlayers.map(p => playerCardHTML(p)).join('')}
      </div>

      <button id="btn-confirm" class="btn-primary" style="margin-top:8px;">
        ${isLast
          ? (isJoinMode && !isCreator ? 'Fertig' : 'Runde beenden')
          : `Nächste Bahn ${icons.chevronRight}`}
      </button>
    `;
  }

  function updateScoreDisplay(pid) {
    const par = currentPar();
    const score = currentScores[pid];

    const { cls, display, label } = scoreBadgeContent(score, par);
    const badge = container.querySelector(`[data-badge="${pid}"]`);
    const labelEl = container.querySelector(`[data-label="${pid}"]`);
    if (!badge) return;

    badge.className = `${cls}`;
    badge.setAttribute('data-badge', pid);
    badge.style.cssText = 'width:52px;height:52px;font-size:24px;';
    badge.textContent = display;
    if (labelEl) labelEl.textContent = label;

    void badge.offsetWidth;
    badge.classList.add('score-pop');
  }

  // ── Hole overview sheet ──────────────────────────────────────

  function showHoleOverview() {
    closeOverview();
    const wrap = document.createElement('div');
    wrap.id = 'hole-overview-wrap';

    const tiles = Array.from({ length: 18 }, (_, i) => {
      const status = holeStatus(i);
      const par = draft.holes[i].par;
      const isCurrent = i === holeIndex;

      let bg, color, border;
      if (isCurrent) {
        bg = 'var(--primary)'; color = 'white'; border = 'none';
      } else if (status === 'complete') {
        bg = 'var(--primary-light)'; color = 'var(--primary)'; border = '1.5px solid var(--primary)';
      } else if (status === 'partial') {
        bg = '#fff8e1'; color = '#b45309'; border = '1.5px solid #fcd34d';
      } else {
        bg = 'var(--surface-2)'; color = 'var(--text)'; border = '1px solid var(--border-light)';
      }

      return `
        <button data-jump="${i}" style="background:${bg};color:${color};border:${border};border-radius:var(--radius-sm);padding:12px 6px;min-height:unset;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;transition:filter 0.12s ease;">
          <span style="font-size:22px;font-weight:700;line-height:1;">${i + 1}</span>
          <span style="font-size:11px;font-weight:500;opacity:0.75;">Par ${par}</span>
        </button>
      `;
    }).join('');

    wrap.innerHTML = `
      <div class="overlay" id="hole-overview-overlay"></div>
      <div class="bottom-sheet" id="hole-overview-sheet">
        <div class="handle"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h2 style="margin:0;color:var(--text);">Bahn wählen</h2>
          <div style="display:flex;gap:12px;font-size:11px;color:var(--text-muted);align-items:center;gap:8px;">
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--primary-light);border:1.5px solid var(--primary);display:inline-block;"></span> Fertig</span>
            <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:#fff8e1;border:1.5px solid #fcd34d;display:inline-block;"></span> Teils</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          ${tiles}
        </div>
      </div>
    `;

    document.body.appendChild(wrap);
    document.getElementById('hole-overview-overlay').addEventListener('click', closeOverview);
  }

  function closeOverview() {
    document.getElementById('hole-overview-wrap')?.remove();
  }

  // ── Cloud sync ───────────────────────────────────────────────

  async function syncToCloud() {
    draft = await getDraft(draftId);
    if (!draft) return;

    if (!draft.cloudRoundId) {
      try {
        const cloudId = await createActiveRound(
          draft.courseName, draft.date,
          draft.playerIds, draft.playerNames, draft.holes
        );
        await setCloudRoundId(draftId, cloudId);
        draft = await getDraft(draftId);
        if (!pollInterval) startPolling();
      } catch (e) {
        console.warn('createActiveRound failed:', e);
        return;
      }
    }

    try {
      const myId = currentUser?.id;
      await Promise.all(
        draft.playerIds.map(pid => {
          if (pid === myId) {
            return syncParticipantScores(draft.cloudRoundId, pid, draft.scores[pid]);
          }
          // Other players: only fill null slots using last-known cloud state
          const knownScores = cloudRoundScoreCache[pid] ?? Array(18).fill(null);
          const localScores = draft.scores[pid];
          const nonNullMoves = localScores
            .map((score, i) => ({ score, i }))
            .filter(({ score }) => score != null);
          return Promise.all(
            nonNullMoves.map(({ score, i }) =>
              syncOtherParticipantScore(draft.cloudRoundId, pid, i, score, knownScores)
            )
          );
        })
      );
      await setPendingSync(draftId, false);
      draft = await getDraft(draftId);
    } catch (e) {
      console.warn('syncParticipantScores failed:', e);
    }
  }

  // ── Advance / back ───────────────────────────────────────────

  async function advance() {
    const btn = container.querySelector('#btn-confirm');
    if (btn) btn.disabled = true;

    if (isJoinMode) {
      const myId = currentUser?.id;
      if (!myId) {
        console.warn('advance: no currentUser in join mode');
      }
      await Promise.all(roundPlayers.map(async p => {
        const score = currentScores[p.id];
        if (score == null) return;
        draft.scores[p.id][holeIndex] = score;
        if (p.id === myId) {
          try {
            const knownScores = cloudRoundScoreCache[p.id] ?? Array(18).fill(null);
            const merged = [...knownScores];
            merged[holeIndex] = score;
            cloudRoundScoreCache[p.id] = merged;
            await syncParticipantScores(cloudRoundId, p.id, merged);
          } catch (e) {
            console.warn('sync own score failed:', e);
          }
        } else {
          const knownScores = cloudRoundScoreCache[p.id] ?? Array(18).fill(null);
          if (knownScores[holeIndex] == null) {
            knownScores[holeIndex] = score;
            cloudRoundScoreCache[p.id] = knownScores;
            try {
              await syncParticipantScores(cloudRoundId, p.id, knownScores);
            } catch (e) {
              console.warn('sync other score failed:', e);
            }
          }
        }
      }));

      if (holeIndex < draft.holes.length - 1) {
        holeIndex++;
        initScores();
        updateHash();
        destroyMap();
        draw();
        setTimeout(initMap, 50);
      } else {
        stopGpsWatch();
        localStorage.removeItem('activeCloudRoundId');
        location.hash = '#home';
      }
    } else {
      await Promise.all(
        roundPlayers.map(async p => {
          const val = currentScores[p.id] === 0 ? null : currentScores[p.id];
          draft.scores[p.id][holeIndex] = val;
          await saveDraftScore(draftId, p.id, holeIndex, val);
        })
      );

      if (navigator.onLine) {
        await syncToCloud();
      } else {
        await setPendingSync(draftId, true);
      }

      if (holeIndex < 17) {
        holeIndex++;
        initScores();
        updateHash();
        destroyMap();
        draw();
        setTimeout(initMap, 50);
      } else {
        stopGpsWatch();
        location.hash = `#scorecard?draftId=${draftId}`;
      }
    }
  }

  function goBack() {
    if (holeIndex > 0) {
      holeIndex--;
      initScores();
      updateHash();
      destroyMap();
      draw();
      setTimeout(initMap, 50);
    } else {
      stopGpsWatch();
      location.hash = '#home';
    }
  }

  function jumpToHole(i) {
    holeIndex = i;
    initScores();
    updateHash();
    closeOverview();
    destroyMap();
    draw();
    setTimeout(initMap, 50);
  }

  // ── Polling ──────────────────────────────────────────────────

  function startPolling() {
    const roundId = isJoinMode ? cloudRoundId : draft.cloudRoundId;
    if (!roundId) return;
    pollInterval = setInterval(async () => {
      if (!document.body.contains(container)) {
        clearInterval(pollInterval);
        return;
      }
      try {
        const fresh = await getActiveRound(roundId);
        const myId = currentUser?.id;
        const par = draft.holes[holeIndex].par;
        fresh.players.forEach(p => {
          cloudRoundScoreCache[p.id] = [...p.scores];
          if (p.id !== myId) {
            draft.scores[p.id] = p.scores.map((s, i) =>
              currentScores[p.id] != null && i === holeIndex ? currentScores[p.id] : s
            );
            if (currentScores[p.id] == null) {
              currentScores[p.id] = draft.scores[p.id][holeIndex];
            }
          }
          // Direct DOM update — avoids innerHTML flicker
          const badge = container.querySelector(`[data-badge="${p.id}"]`);
          const labelEl = container.querySelector(`[data-label="${p.id}"]`);
          const chipEl = container.querySelector(`[data-chip="${p.id}"]`);
          if (badge) {
            const score = currentScores[p.id];
            const { cls, display, label } = scoreBadgeContent(score, par);
            badge.className = cls;
            badge.textContent = display;
            if (labelEl) labelEl.textContent = label;
          }
          // Update vs-par chip
          if (chipEl) {
            const diff = vsParSoFar(p.id);
            if (diff !== null) {
              const isOver = diff > (hcpMap[p.id] ?? 36);
              const label = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
              chipEl.textContent = label;
              chipEl.style.cssText = isOver
                ? 'background:#fdf0ee;border:1px solid #e8b4ae;color:#c0392b;'
                : 'background:var(--surface-2);border:1px solid var(--border);color:var(--text);';
              chipEl.style.cssText += 'border-radius:20px;padding:2px 8px;font-size:12px;font-weight:600;';
            }
          }
        });
      } catch (e) { console.warn('polling: fetch failed', e); }
    }, 30000);
  }

  // ── Init ─────────────────────────────────────────────────────

  container.dataset.playSession = draftId ?? cloudRoundId;

  initScores();
  draw();
  setTimeout(initMap, 50);
  startPolling();
  startGpsWatch();

  const stopOnLeave = () => {
    if (!document.body.contains(container)) {
      stopGpsWatch();
      destroyMap();
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('click', stopOnLeave);
    }
  };
  document.addEventListener('click', stopOnLeave);

  // Reconnect: sync pending scores when internet returns
  window.addEventListener('online', function onReconnect() {
    if (!document.body.contains(container)) {
      window.removeEventListener('online', onReconnect);
      return;
    }
    syncToCloud().catch(e => console.warn('reconnect sync failed:', e));
  });

  container.addEventListener('click', e => {
    if (container.dataset.playSession !== (draftId ?? cloudRoundId)) return;
    if (e.target.closest('#btn-back')) { goBack(); return; }
    if (e.target.closest('#btn-confirm')) { advance(); return; }
    if (e.target.closest('#btn-hole-overview')) { showHoleOverview(); return; }

    const minus = e.target.closest('[data-minus]');
    if (minus) {
      const pid = minus.dataset.minus;
      if (currentScores[pid] > 0) { currentScores[pid]--; updateScoreDisplay(pid); }
      return;
    }
    const plus = e.target.closest('[data-plus]');
    if (plus) {
      const pid = plus.dataset.plus;
      if (currentScores[pid] == null) {
        currentScores[pid] = currentPar();
      } else {
        currentScores[pid]++;
      }
      updateScoreDisplay(pid);
      return;
    }
  });

  document.addEventListener('click', function onJump(e) {
    if (container.dataset.playSession !== (draftId ?? cloudRoundId)) {
      document.removeEventListener('click', onJump);
      return;
    }
    const tile = e.target.closest('[data-jump]');
    if (tile) jumpToHole(parseInt(tile.dataset.jump, 10));
  });
}
