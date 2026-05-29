const DB_NAME = 'shareyourswing';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('players')) {
        db.createObjectStore('players', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('rounds')) {
        const rs = db.createObjectStore('rounds', { keyPath: 'id' });
        rs.createIndex('date', 'date');
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function uuid() {
  return crypto.randomUUID();
}

function tx(db, stores, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    t.onerror = e => reject(e.target.error);
    resolve(fn(t));
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function getOne(store, id) {
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function put(store, value) {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function del(store, id) {
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

// ─── Players ────────────────────────────────────────────────────────────────

export async function getAllPlayers() {
  const db = await openDB();
  return tx(db, ['players'], 'readonly', t => getAll(t.objectStore('players')));
}

export async function addPlayer(name) {
  const db = await openDB();
  const player = { id: uuid(), name };
  await tx(db, ['players'], 'readwrite', t => put(t.objectStore('players'), player));
  return player;
}

export async function deletePlayer(id) {
  const db = await openDB();
  return tx(db, ['players'], 'readwrite', t => del(t.objectStore('players'), id));
}

export async function updatePlayer(id, name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['players'], 'readwrite');
    const store = t.objectStore('players');
    const req = store.get(id);
    req.onsuccess = e => {
      const player = e.target.result;
      player.name = name;
      store.put(player).onsuccess = () => resolve();
    };
    req.onerror = e => reject(e.target.error);
    t.onerror = e => reject(e.target.error);
  });
}

// ─── Courses ────────────────────────────────────────────────────────────────

export async function getAllCourses() {
  const db = await openDB();
  return tx(db, ['courses'], 'readonly', t => getAll(t.objectStore('courses')));
}

export async function getCourse(id) {
  const db = await openDB();
  return tx(db, ['courses'], 'readonly', t => getOne(t.objectStore('courses'), id));
}

export async function addCourse(name, holes) {
  // holes: [{par}] x 18
  const db = await openDB();
  const course = { id: uuid(), name, holes: holes.map((h, i) => ({ number: i + 1, par: h.par })) };
  await tx(db, ['courses'], 'readwrite', t => put(t.objectStore('courses'), course));
  return course;
}

export async function updateCourse(course) {
  const db = await openDB();
  return tx(db, ['courses'], 'readwrite', t => put(t.objectStore('courses'), course));
}

export async function deleteCourse(id) {
  const db = await openDB();
  return tx(db, ['courses'], 'readwrite', t => del(t.objectStore('courses'), id));
}

// ─── Rounds ─────────────────────────────────────────────────────────────────

export async function addRound(courseId, playerIds) {
  const db = await openDB();
  // scores initialized as null arrays — filled in during play
  const scores = {};
  for (const pid of playerIds) scores[pid] = Array(18).fill(null);
  const round = { id: uuid(), courseId, playerIds, date: new Date().toISOString(), scores };
  await tx(db, ['rounds'], 'readwrite', t => put(t.objectStore('rounds'), round));
  return round;
}

export async function getRound(id) {
  const db = await openDB();
  return tx(db, ['rounds'], 'readonly', t => getOne(t.objectStore('rounds'), id));
}

export async function getAllRounds() {
  const db = await openDB();
  return tx(db, ['rounds'], 'readonly', t => getAll(t.objectStore('rounds')));
}

export async function deleteRound(id) {
  const db = await openDB();
  return tx(db, ['rounds'], 'readwrite', t => del(t.objectStore('rounds'), id));
}

export async function saveHoleScore(roundId, playerId, holeIndex, strokes) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(['rounds'], 'readwrite');
    const store = t.objectStore('rounds');
    const req = store.get(roundId);
    req.onsuccess = e => {
      const round = e.target.result;
      round.scores[playerId][holeIndex] = strokes;
      store.put(round).onsuccess = () => resolve();
    };
    req.onerror = e => reject(e.target.error);
    t.onerror = e => reject(e.target.error);
  });
}
