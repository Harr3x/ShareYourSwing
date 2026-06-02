import { getLegacyRounds, getLegacyPlayers } from './db.js';
import { getCourses, publishRound } from './supabase.js';

export async function runMigrationIfNeeded() {
  if (localStorage.getItem('migration_v2_done')) return;

  try {
    const [rounds, players] = await Promise.all([getLegacyRounds(), getLegacyPlayers()]);

    if (rounds.length > 0) {
      const courses = await getCourses();
      const courseMap = new Map(courses.map(c => [c.id, c]));
      const playerMap = new Map(players.map(p => [p.id, p]));

      for (const round of rounds) {
        const course = courseMap.get(round.courseId);
        if (!course) continue;

        const allScored = round.playerIds.every(pid =>
          Array.isArray(round.scores[pid]) && round.scores[pid].every(s => s != null)
        );
        if (!allScored) continue;

        try {
          const participantMap = round.playerIds.map(pid => ({
            userId: pid,
            displayName: playerMap.get(pid)?.name || pid,
            scores: round.scores[pid],
          }));
          await publishRound(course, round.date, participantMap);
        } catch (e) {
          console.warn('migration: failed to publish round', round.id, e);
        }
      }
    }
  } catch (e) {
    console.warn('migration: error during migration', e);
  }

  localStorage.setItem('migration_v2_done', 'true');
}
