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
