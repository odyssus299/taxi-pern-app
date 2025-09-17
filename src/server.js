require('dotenv').config();
const app = require('./app');
const { checkDb, pool } = require('./db/pool');
const http = require('http');
const { initWs, getHub } = require('./ws'); // WS init & hub accessor

// Cron jobs (όπως τα έχεις)
const { initCleanupRides } = require('../src/jobs/cleanupRides');
const { initCleanupProblems } = require('../src/jobs/cleanupProblems');
const { initCleanupReviews } = require('./jobs/cleanupReviews');
const { initCleanupRequests } = require('./jobs/cleanupRequests');

const PORT = parseInt(process.env.APP_PORT || '4000', 10);

// Sweep & repos για WS push στους επόμενους
const { sweepExpiredAwaiting } = require('../src/repos/rides.repo');
const RidesRepo = require('./repos/rides.repo');

(async () => {
  let server;
  let io;
  let sweepTimer;
  let shuttingDown = false;

  // Κοινός helper για καθαρό τερματισμό
  const shutdown = async (signal = 'SIGTERM') => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] received ${signal}, closing gracefully...`);

    try { clearInterval(sweepTimer); } catch {}
    try { io?.close?.(); } catch (e) { /* ignore */ }

    // Κλείσε HTTP server -> μετά PG pool
    try {
      await new Promise((resolve) => {
        server?.close?.(() => resolve());
        // Αν δεν υπάρχει server, resolve άμεσα
        if (!server || !server.close) resolve();
      });
    } catch (e) { /* ignore */ }

    try { await pool?.end?.(); } catch { /* ignore */ }

    // Σε περίπτωση που κάτι κρέμεται, φόρτωσε hard-exit μετά από 5s
    setTimeout(() => process.exit(0), 5000).unref();
    process.exit(0);
  };

  // Uncaught handlers -> προσπάθησε graceful shutdown
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    shutdown('unhandledRejection');
  });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  try {
    await checkDb();

    // Εκκίνηση cron jobs
    initCleanupRides();
    initCleanupProblems();
    initCleanupReviews();
    initCleanupRequests();

    // Notifier που καλείται όταν ο sweep προάγει νέο awaiting οδηγό
    const onNewAwaiting = async (rideId, driverId, respondByMs) => {
      const ws = (typeof getHub === 'function') ? getHub() : null;
      if (!ws || typeof ws.notifyDriverProposal !== 'function') return;

      // Φέρε pickup coords (προαιρετικό για καθαρό payload)
      let rideRow = null;
      try {
        if (typeof RidesRepo.findById === 'function') {
          rideRow = await RidesRepo.findById(rideId);
        }
      } catch { /* ignore */ }

      const pickupLat = Number(rideRow?.pickup_lat ?? rideRow?.pickupLat ?? 0);
      const pickupLng = Number(rideRow?.pickup_lng ?? rideRow?.pickupLng ?? 0);
      console.log('[sweep->ws] notify', { rideId, driverId });

      ws.notifyDriverProposal(Number(driverId), {
        rideId: String(rideId),
        pickupLat,
        pickupLng,
        respondByMs
      });
    };

    // Sweep ληγμένων awaiting κάθε 1s
    const SWEEP_EVERY_MS = 1000;
    const SWEEP_BATCH = 200;
    sweepTimer = setInterval(async () => {
      try {
        await sweepExpiredAwaiting(SWEEP_BATCH, onNewAwaiting);
      } catch {
        // κράτα τον server ζωντανό
      }
    }, SWEEP_EVERY_MS);

    // Δημιουργία HTTP server & δέσιμο Socket.IO
    server = http.createServer(app);
    io = initWs(server);

    server.listen(PORT, () => {
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
