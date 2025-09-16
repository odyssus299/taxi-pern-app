require('dotenv').config();
const app = require('./app');
const { checkDb, pool } = require('./db/pool');
const http = require('http');
const { initWs } = require('./ws'); // ΝΕΟ: θα δημιουργήσουμε το ./ws/index.js

// 👉 πρόσθεσε αυτό:
const { initCleanupRides } = require('../src/jobs/cleanupRides');
const { initCleanupProblems } = require('../src/jobs/cleanupProblems');
const { initCleanupReviews } = require('./jobs/cleanupReviews');
const { initCleanupRequests } = require('./jobs/cleanupRequests');

const PORT = parseInt(process.env.APP_PORT || '4000', 10);

const { sweepExpiredAwaiting } = require('../src/repos/rides.repo');

(async () => {
  try {
    await checkDb();

    // Ξεκίνα το cron ΜΟΝΟ εδώ (όχι σε app.js)
    // Προαιρετικά: μόνο production
    // if (process.env.NODE_ENV !== 'test') {
      initCleanupRides();
      initCleanupProblems();
      initCleanupReviews();  // reviews >6m
      initCleanupRequests();
    // }

    // 👉 Ξεκίνα το sweep ΜΕΤΑ την επιτυχή σύνδεση DB
    const SWEEP_EVERY_MS = 1000;
    const SWEEP_BATCH = 200;
    const sweepTimer = setInterval(async () => {
      try {
        const n = await sweepExpiredAwaiting(SWEEP_BATCH);
        // if (n > 0) console.log('[ride-sweep] advanced', n);
      } catch (e) {
        // κράτα τον server ζωντανό
        // console.error('[ride-sweep] error', e);
      }
    }, SWEEP_EVERY_MS);

    process.on('SIGTERM', () => clearInterval(sweepTimer));
    process.on('SIGINT',  () => clearInterval(sweepTimer));

    // ΝΕΟ: φτιάχνουμε http server, δένουμε Socket.IO
    const server = http.createServer(app);
    initWs(server); // εκκίνηση WS layer (JWT handshake, rooms, handlers)
    server.listen(PORT, () => {
    //app.listen(PORT, () => {
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