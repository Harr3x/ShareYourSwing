// Returns strokes relative to par. Negative = under par.
export function scoreRelativeToPar(strokes, par) {
  return strokes - par;
}

// Returns CSS class name for a score cell.
export function getScoreClass(strokes, par) {
  const diff = strokes - par;
  if (diff <= -2) return 'golf-eagle';
  if (diff === -1) return 'golf-birdie';
  if (diff === 0)  return 'golf-par';
  if (diff === 1)  return 'golf-bogey';
  if (diff === 2)  return 'golf-double';
  return 'golf-triple';
}

// Returns human-readable label.
export function getScoreLabel(strokes, par) {
  const diff = strokes - par;
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0)  return 'Par';
  if (diff === 1)  return 'Bogey';
  if (diff === 2)  return 'Double Bogey';
  return 'Triple+';
}

/**
 * Compute handicap for a player based on swingolf rules.
 * Only 18-hole rounds with all scores filled count.
 * Start-HCP: 36.0, max: 36.0
 * Improvement (result < HCP): factor 0.4 if HCP >= 18, else 0.2
 * Worsening (result > HCP): factor 0.1
 * Returns: { handicap: number|null, history: [{date, hcp}] }
 */
export function computeHandicap(rounds, courses, playerId) {
  const completed = rounds
    .filter(r => {
      if (!r.playerIds.includes(playerId)) return false;
      const scores = r.scores[playerId];
      if (!scores) return false;
      return scores.every(s => s != null);
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!completed.length) return { handicap: null, history: [] };

  let hcp = 36.0;
  const history = [];

  for (const round of completed) {
    const course = courses.get(round.courseId);
    if (!course) continue;

    const scores = round.scores[playerId];
    let roundVsPar = 0;
    for (let i = 0; i < 18; i++) {
      roundVsPar += scores[i] - course.holes[i].par;
    }

    const diff = roundVsPar - hcp;
    let delta;
    if (diff < 0) {
      delta = hcp >= 18.0 ? diff * 0.4 : diff * 0.2;
    } else {
      delta = diff * 0.1;
    }

    hcp = Math.min(36.0, Math.round((hcp + delta) * 10) / 10);
    history.push({ date: round.date, hcp });
  }

  return { handicap: history.length ? history[history.length - 1].hcp : null, history };
}

/**
 * Aggregate stats for one player across all rounds.
 * rounds: Round[] (from DB)
 * courses: Map<courseId, Course>
 * playerId: string
 * Returns: { totalRounds, avgScoreVsPar, breakdown: {eagle,birdie,par,bogey,double,triple}, roundTrend: [{date, scoreVsPar}] }
 */
export function computePlayerStats(rounds, courses, playerId) {
  const playerRounds = rounds.filter(r => r.playerIds.includes(playerId) && r.scores[playerId]);

  let breakdown = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0 };
  let roundTrend = [];

  for (const round of playerRounds) {
    const course = courses.get(round.courseId);
    if (!course) continue;

    const scores = round.scores[playerId];
    let roundVsPar = 0;
    let holes = 0;

    for (let i = 0; i < 18; i++) {
      const strokes = scores[i];
      if (strokes == null) continue;
      const par = course.holes[i].par;
      const diff = strokes - par;
      roundVsPar += diff;
      holes++;

      if (diff <= -2)      breakdown.eagle++;
      else if (diff === -1) breakdown.birdie++;
      else if (diff === 0)  breakdown.par++;
      else if (diff === 1)  breakdown.bogey++;
      else if (diff === 2)  breakdown.double++;
      else                  breakdown.triple++;
    }

    if (holes === 18) roundTrend.push({ date: round.date, scoreVsPar: roundVsPar });
  }

  const completedRounds = roundTrend.length;
  const avgScoreVsPar = completedRounds
    ? Math.round((roundTrend.reduce((s, r) => s + r.scoreVsPar, 0) / completedRounds) * 10) / 10
    : null;

  return { totalRounds: playerRounds.length, avgScoreVsPar, breakdown, roundTrend };
}

export function computeBirdieStats(rounds, courseMap, playerId) {
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

export function computeCourseRecords(rounds, courseMap, playerId) {
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
    if (recordHolder === playerId && course.name) records.push({ name: course.name, score: recordScore });
  }
  return records;
}

/**
 * Compute per-par-type breakdown for a player.
 * Returns: { par3: {eagle,birdie,par,bogey,double,triple}, par4: ..., par5: ... }
 */
export function computeBreakdownByPar(rounds, courses, playerId) {
  const result = {};
  for (const par of [3, 4, 5]) result['par' + par] = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0 };

  const playerRounds = rounds.filter(r => r.playerIds.includes(playerId) && r.scores[playerId]);
  for (const round of playerRounds) {
    const course = courses.get(round.courseId);
    if (!course) continue;
    const scores = round.scores[playerId];
    for (let i = 0; i < 18; i++) {
      const strokes = scores[i];
      if (strokes == null) continue;
      const par = course.holes[i].par;
      const key = 'par' + par;
      if (!result[key]) continue;
      const diff = strokes - par;
      if (diff <= -2)      result[key].eagle++;
      else if (diff === -1) result[key].birdie++;
      else if (diff === 0)  result[key].par++;
      else if (diff === 1)  result[key].bogey++;
      else if (diff === 2)  result[key].double++;
      else                  result[key].triple++;
    }
  }

  return result;
}
