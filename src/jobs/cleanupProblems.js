const cron = require('node-cron');
const { pool } = require('../db/pool');

function initCleanupProblems() {
  // Τρέχει κάθε μέρα στις 03:05:00 (μπορείς να αλλάξεις με env)
  const schedule = '0 0 3 * * *';

  cron.schedule(
    schedule,
    async () => {
      try {
        const { rowCount } = await pool.query(
          `DELETE FROM public.problems
           WHERE created_at < NOW() - INTERVAL '2 months'`
        );
        console.log(`[cleanup-problems] deleted ${rowCount} old problems`);
      } catch (e) {
        console.error('[cleanup-problems] failed:', e);
      }
    },
  );
}

module.exports = { initCleanupProblems };