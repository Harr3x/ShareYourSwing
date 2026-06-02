const DB_NAME = 'shareyourswing';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      // Preserve old stores (players, courses, rounds) for migration — not actively used
      if (!db.objectStoreNames.contains('players'))
        db.createObjectStore('players', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('courses'))
        db.createObjectStore('courses', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('rounds')) {
        const rs = db.createObjectStore('rounds', { keyPath: 'id' });
        rs.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('drafts'))
        db.createObjectStore('drafts', { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

// ─── Drafts ─────────────────────────────────────────────────────────────────
// Draft schema: { id, cloudRoundId, courseId, courseName, holes, playerIds,
//                 playerNames, date, scores, pendingSync, createdAt }

export async function addDraft(data) {
  const db = await openDB();
  const draft = { ...data, id: uuid(), cloudRoundId: null, pendingSync: false, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const t = db.transaction(['drafts'], 'readwrite');
    t.onerror = e => reject(e.target.error);
    const req = t.objectStore('drafts').put(draft);
    req.onsuccess = () => resolve(draft);
    req.onerror = e => reject(e.target.error);
  });
}

export async function getDraft(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['drafts'], 'readonly');
    const req = t.objectStore('drafts').get(id);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror = e => reject(e.target.error);
  });
}

export async function removePlayerFromDraft(id, playerId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['drafts'], 'readwrite');
    t.onerror = e => reject(e.target.error);
    const store = t.objectStore('drafts');
    const req = store.get(id);
    req.onsuccess = e => {
      const draft = e.target.result;
      if (!draft) { resolve(); return; }
      draft.playerIds = draft.playerIds.filter(pid => pid !== playerId);
      delete draft.playerNames[playerId];
      delete draft.scores[playerId];
      const put = store.put(draft);
      put.onsuccess = () => resolve();
      put.onerror = ev => reject(ev.target.error);
    };
    req.onerror = e => reject(e.target.error);
  });
}

export async function getActiveDraft() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['drafts'], 'readonly');
    const req = t.objectStore('drafts').getAll();
    req.onsuccess = e => resolve((e.target.result ?? [])[0] ?? null);
    req.onerror = e => reject(e.target.error);
  });
}

export async function saveDraftScore(id, playerId, holeIndex, strokes) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['drafts'], 'readwrite');
    t.onerror = e => reject(e.target.error);
    const store = t.objectStore('drafts');
    const req = store.get(id);
    req.onsuccess = e => {
      const draft = e.target.result;
      draft.scores[playerId][holeIndex] = strokes;
      store.put(draft).onsuccess = () => resolve();
    };
    req.onerror = e => reject(e.target.error);
  });
}

export async function setCloudRoundId(id, cloudRoundId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['drafts'], 'readwrite');
    t.onerror = e => reject(e.target.error);
    const store = t.objectStore('drafts');
    const req = store.get(id);
    req.onsuccess = e => {
      const draft = e.target.result;
      draft.cloudRoundId = cloudRoundId;
      store.put(draft).onsuccess = () => resolve();
    };
    req.onerror = e => reject(e.target.error);
  });
}

export async function setPendingSync(id, pending) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['drafts'], 'readwrite');
    t.onerror = e => reject(e.target.error);
    const store = t.objectStore('drafts');
    const req = store.get(id);
    req.onsuccess = e => {
      const draft = e.target.result;
      draft.pendingSync = pending;
      store.put(draft).onsuccess = () => resolve();
    };
    req.onerror = e => reject(e.target.error);
  });
}

export async function deleteDraft(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['drafts'], 'readwrite');
    t.onerror = e => reject(e.target.error);
    const req = t.objectStore('drafts').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

// ─── Legacy (migration only) ─────────────────────────────────────────────────

export async function getLegacyRounds() {
  const db = await openDB();
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains('rounds')) { resolve([]); return; }
    const t = db.transaction(['rounds'], 'readonly');
    const req = t.objectStore('rounds').getAll();
    req.onsuccess = e => resolve(e.target.result ?? []);
    req.onerror = () => resolve([]);
  });
}

export async function getLegacyPlayers() {
  const db = await openDB();
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains('players')) { resolve([]); return; }
    const t = db.transaction(['players'], 'readonly');
    const req = t.objectStore('players').getAll();
    req.onsuccess = e => resolve(e.target.result ?? []);
    req.onerror = () => resolve([]);
  });
}
