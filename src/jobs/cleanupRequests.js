
const cron = require('node-cron');
const { pool } = require('../db/pool');

// Τρέχει ΚΑΘΕ ΜΕΡΑ 12:25 (Europe/Athens)
function initCleanupRequests() {
  const schedule = '0 25 12 * * *'; // sec min hour dom mon dow
  cron.schedule(
    schedule,
    async () => {
      try {
        const q = `
          DELETE FROM public.requests
          WHERE created_at < NOW() - INTERVAL '6 months'
        `;
        await pool.query(q);
        // console.log('[cleanup-requests] done');
      } catch (e) {
        // console.error('[cleanup-requests] failed', e);
      }
    },
    { timezone: 'Europe/Athens' }
  );
}

module.exports = { initCleanupRequests };
