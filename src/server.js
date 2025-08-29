require('dotenv').config();
const app = require('./app');
const { checkDb, pool } = require('./db/pool');

// 👉 πρόσθεσε αυτό:
const { initCleanupRides } = require('../src/jobs/cleanupRides');
const { initCleanupProblems } = require('../src/jobs/cleanupProblems');

const PORT = parseInt(process.env.APP_PORT || '4000', 10);

(async () => {
  try {
    await checkDb();

    // Ξεκίνα το cron ΜΟΝΟ εδώ (όχι σε app.js)
    // Προαιρετικά: μόνο production
    // if (process.env.NODE_ENV !== 'test') {
      initCleanupRides();
      initCleanupProblems();
    // }

    app.listen(PORT, () => {
      const opts = pool.options || {};
      const dbInfo = opts.connectionString ? 'DATABASE_URL' : `${opts.host}:${opts.port}/${opts.database}`;
      console.log(`API listening on http://localhost:${PORT}`);
      console.log(`[pg] Connected to ${dbInfo}`);
    });
  } catch (err) {
    console.error('🔴 DATABASE CONNECTION FAILED:', err.message);
    process.exit(1);
  }
})();