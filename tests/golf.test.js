import assert from 'node:assert/strict';
import { scoreRelativeToPar, getScoreClass, getScoreLabel, computePlayerStats } from '../utils/golf.js';

// scoreRelativeToPar
assert.equal(scoreRelativeToPar(3, 4), -1);
assert.equal(scoreRelativeToPar(4, 4),  0);
assert.equal(scoreRelativeToPar(5, 4),  1);
assert.equal(scoreRelativeToPar(2, 4), -2);

// getScoreClass
assert.equal(getScoreClass(2, 4), 'golf-eagle');
assert.equal(getScoreClass(3, 4), 'golf-birdie');
assert.equal(getScoreClass(4, 4), 'golf-par');
assert.equal(getScoreClass(5, 4), 'golf-bogey');
assert.equal(getScoreClass(6, 4), 'golf-double');
assert.equal(getScoreClass(7, 4), 'golf-triple');
assert.equal(getScoreClass(9, 4), 'golf-triple');

// getScoreLabel
assert.equal(getScoreLabel(3, 4), 'Birdie');
assert.equal(getScoreLabel(4, 4), 'Par');
assert.equal(getScoreLabel(5, 4), 'Bogey');
assert.equal(getScoreLabel(2, 4), 'Eagle');
assert.equal(getScoreLabel(6, 4), 'Double Bogey');
assert.equal(getScoreLabel(7, 4), 'Triple+');

// computePlayerStats — one completed round
const fakeCourse = { id: 'c1', name: 'Test', holes: Array.from({length:18}, () => ({ par: 4 })) };
const scores18 = Array(18).fill(4); // all pars
scores18[0] = 3; // birdie on hole 1
scores18[1] = 5; // bogey on hole 2
const fakeRound = { id: 'r1', courseId: 'c1', date: '2026-05-01', playerIds: ['p1'], scores: { p1: scores18 } };
const courses = new Map([['c1', fakeCourse]]);
const stats = computePlayerStats([fakeRound], courses, 'p1');
assert.equal(stats.totalRounds, 1);
assert.equal(stats.breakdown.birdie, 1);
assert.equal(stats.breakdown.bogey, 1);
assert.equal(stats.breakdown.par, 16);
assert.equal(stats.roundTrend[0].scoreVsPar, 0); // birdie + bogey = net 0
assert.equal(stats.avgScoreVsPar, 0);

// computePlayerStats — partial round (not all 18 holes completed)
const scoresPartial = Array(18).fill(null);
scoresPartial[0] = 3; // birdie on hole 1
scoresPartial[1] = 5; // bogey on hole 2
scoresPartial[2] = 4; // par on hole 3
// holes 3-17 remain null
const fakeRoundPartial = { id: 'r2', courseId: 'c1', date: '2026-05-02', playerIds: ['p1'], scores: { p1: scoresPartial } };
const statsPartial = computePlayerStats([fakeRoundPartial], courses, 'p1');
assert.equal(statsPartial.totalRounds, 1); // counted as a round the player participated in
assert.equal(statsPartial.roundTrend.length, 0); // but NOT included in roundTrend (incomplete)
assert.equal(statsPartial.breakdown.birdie, 1);
assert.equal(statsPartial.breakdown.bogey, 1);
assert.equal(statsPartial.breakdown.par, 1);

console.log('All tests passed ✓');
