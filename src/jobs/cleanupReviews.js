const cron = require('node-cron');
const { pool } = require('../db/pool');

// Τρέχει ΚΑΘΕ ΜΕΡΑ 12:20 (Europe/Athens)
function initCleanupReviews() {
  const schedule = '0 20 12 * * *'; // sec min hour dom mon dow
  cron.schedule(
    schedule,
    async () => {
      try {
        const q = `
          DELETE FROM public.reviews
          WHERE created_at < NOW() - INTERVAL '6 months'
        `;
        await pool.query(q);
        // console.log('[cleanup-reviews] done');
      } catch (e) {
        // console.error('[cleanup-reviews] failed', e);
      }
    },
    { timezone: 'Europe/Athens' }
  );
}

module.exports = { initCleanupReviews };
