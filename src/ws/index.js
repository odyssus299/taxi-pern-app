const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const DriversRepo = require('../repos/drivers.repo');

// μικρό helper για Authorization: "Bearer xxx"
function extractBearerToken(req) {
  // socket.io v4: το token έρχεται συνήθως στο auth, αλλά υποστηρίζουμε και headers
  const authHeader = req?.headers?.authorization || req?.auth?.Authorization || req?.auth?.authorization;
  if (typeof authHeader === 'string') {
    const [scheme, token] = authHeader.split(' ');
    if ((scheme || '').toLowerCase() === 'bearer' && token) return token;
  }
  // επίσης υποστήριξε auth.token
  if (req?.auth?.token && typeof req.auth.token === 'string') return req.auth.token;
  return null;
}

function verifyJwtFromHandshake(handshake) {
  const token = extractBearerToken(handshake) || handshake?.query?.token || null;
  if (!token) throw new Error('missing token');

  const secret = process.env.JWT_SECRET || process.env.JWT_KEY;
  const decoded = jwt.verify(token, secret);
  // περιμένουμε claims: { userId, userRole }
  const userId = String(decoded.userId || decoded.id || '');
  const userRole = String(decoded.userRole || decoded.role || '').toLowerCase();
  if (!userId || !userRole) throw new Error('invalid token claims');

  return { userId, userRole, token };
}

function initWs(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.FRONTEND_HOME_URL || 'http://localhost:5173',
        'http://localhost:5173'
      ],
      credentials: true
    },
    path: '/ws' // θέτουμε σαφές path για WS
  });

  // Auth στο connect
  io.use((socket, next) => {
    try {
      const { userId, userRole } = verifyJwtFromHandshake(socket.handshake);
      socket.data.userId = userId;
      socket.data.userRole = userRole;
      return next();
    } catch (err) {
      return next(new Error('Η αυθεντικοποίηση απέτυχε. Παρακαλώ συνδεθείτε ξανά.'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, userRole } = socket.data;

    // Βάλε τον driver στο room του
    if (userRole === 'driver') {
      await socket.join(`driver:${userId}`);
    }

    console.log('[WS] connected:', {
        socketId: socket.id,
        userId,
        userRole,
        from: socket.handshake.address,
        ua: socket.handshake.headers['user-agent']
      });

    // === Driver απαντά σε ping με τρέχουσα/πρόσφατη θέση ===
    // payload shape: { pingId, lat, lng, accuracy?, stale? }
    socket.on('driver:pos:pong', async (payload = {}) => {
      if (socket.data.userRole !== 'driver') return; // μόνο drivers
      console.log('[WS] pong recv:', { fromDriver: socket.data.userId, payload });
      const driverId = Number(socket.data.userId);
      const lat = Number(payload.lat);
      const lng = Number(payload.lng);

      if (!Number.isFinite(driverId) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.log('[WS] pong invalid coords/driverId');
        return;
      }

      try {
        const updated = await DriversRepo.updatePosition(driverId, lat, lng);
        console.log('[WS] db position updated:', updated);
      } catch (_e) {
        // σιωπηλή αποτυχία — δεν μπλοκάρουμε το socket loop
      }
    });

    socket.on('disconnect', () => {
      // optional: presence flags/metrics
      console.log('[WS] disconnected:', { socketId: socket.id, reason });
    });
  });

  // Προαιρετικά: εκθέτουμε ένα μικρό hub API για μελλοντική χρήση (π.χ. ping/notify drivers)
  const hub = {
    io,
    notifyDriverProposal(driverId, payload) {
      io.to(`driver:${driverId}`).emit('ride:proposal', payload);
    },
    pingDriverPosition(driverId, payload) {
      io.to(`driver:${driverId}`).emit('driver:pos:ping', payload);
    }
  };

  // διαθέσιμο σε όλο το app αν θέλουμε (π.χ. μέσω require('./ws').hub)
  module.exports.hub = hub;

  return io;
}

module.exports = { initWs };
