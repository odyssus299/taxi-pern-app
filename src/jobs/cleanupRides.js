const cron = require('node-cron');
const { pool } = require('../db/pool');

function initCleanupRides() {
  // προεπιλογή: κάθε μέρα στις 
  const schedule = '0 0 3 * * *';
  cron.schedule(schedule, async () => {
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM public.rides
         WHERE created_at < NOW() - INTERVAL '6 months'`
      );
      // console.log(`[cleanup-rides] deleted ${rowCount} old rides`);
    } catch (e) {
      // console.error('[cleanup-rides] failed:', e);
    }
  });
}

module.exports = { initCleanupRides };