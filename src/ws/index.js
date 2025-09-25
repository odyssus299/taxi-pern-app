// src/ws/index.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const DriversRepo = require('../repos/drivers.repo');

let ioRef = null; // optional debug/reference
let hub = null;   // set in initWs() and read via getHub()

// Κρατάμε ενεργό socket ανά οδηγό: driverId -> socketId
const driverSockets = new Map();

// --- helpers --------------------------------------------------

function extractBearerToken(handshakeOrReq) {
  const hdr =
    handshakeOrReq?.headers?.authorization ||
    handshakeOrReq?.auth?.Authorization ||
    handshakeOrReq?.auth?.authorization ||
    null;

  if (typeof hdr === 'string') {
    const [scheme, token] = hdr.split(' ');
    if ((scheme || '').toLowerCase() === 'bearer' && token) return token;
  }

  if (typeof handshakeOrReq?.auth?.token === 'string') return handshakeOrReq.auth.token;
  if (typeof handshakeOrReq?.query?.token === 'string') return handshakeOrReq.query.token;

  return null;
}

function verifyJwtFromHandshake(handshake) {
  let token = extractBearerToken(handshake);
  if (!token) throw new Error('missing token');

  if (/^Bearer\s+/i.test(token)) token = token.split(' ')[1];

  const secret = process.env.JWT_SECRET || process.env.JWT_KEY;
  const decoded = jwt.verify(token, secret);

  const userId = String(decoded.userId || decoded.id || '');
  const userRole = String(decoded.userRole || decoded.role || '').toLowerCase();

  if (!userId || !userRole) throw new Error('invalid token claims');
  return { userId, userRole, token };
}

// --- init -----------------------------------------------------

function initWs(httpServer) {
  const io = new Server(httpServer, {
    path: '/ws',
    cors: {
      origin: true,      // reflect request origin
      credentials: true,
    },
  });

  ioRef = io;

  // Auth gate για κάθε socket
  io.use((socket, next) => {
    try {
      const { userId, userRole } = verifyJwtFromHandshake(socket.handshake);
      socket.data.userId = userId;
      socket.data.userRole = userRole;
      next();
    } catch (err) {
      next(new Error('Η αυθεντικοποίηση απέτυχε. Παρακαλώ συνδεθείτε ξανά.'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, userRole } = socket.data;

    // --- Single active socket per driver ---
    if (userRole === 'driver') {
      const prevSocketId = driverSockets.get(userId);
      if (prevSocketId && prevSocketId !== socket.id) {
        const prev = io.sockets.sockets.get(prevSocketId);
        if (prev) {
          try {
            // Προαιρετικό ενημερωτικό event στον παλιό socket πριν κλείσει
            prev.emit?.('session:revoked', { reason: 'new-connection' });
          } catch {}
          try { prev.disconnect(true); } catch {}
        }
      }
      driverSockets.set(userId, socket.id);
    }

    // Rooms
    if (userRole === 'driver') {
      await socket.join(`driver:${userId}`);
      await socket.join('drivers');
      console.log('[WS] joined rooms:', { driverId: userId, rooms: [`driver:${userId}`, 'drivers'] });
    }

    console.log('[WS] connected:', {
      socketId: socket.id,
      userId,
      userRole,
      from: socket.handshake.address,
      ua: socket.handshake.headers['user-agent'],
    });

    // Driver απαντά με θέση: payload { pingId, lat, lng, accuracy?, stale? }
    socket.on('driver:pos:pong', async (payload = {}) => {
      if (socket.data.userRole !== 'driver') return;

      let data = payload;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); }
        catch {
          console.log('[WS] pong bad JSON string:', { fromDriver: socket.data.userId, payload });
          return;
        }
      }

      console.log('[WS] pong recv:', { fromDriver: socket.data.userId, payload: data });

      const driverId = Number(socket.data.userId);
      const lat = Number(data.lat);
      const lng = Number(data.lng);

      if (!Number.isFinite(driverId) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.log('[WS] pong invalid coords/driverId');
        return;
      }

      try {
        const updated = await DriversRepo.updatePosition(driverId, lat, lng);
        console.log('[WS] db position updated:', updated);
      } catch {
        // swallow DB errors
      }
    });

    socket.on('disconnect', (reason) => {
      // Καθάρισμα mapping μόνο αν ο χάρτης δείχνει αυτό το socket
      if (userRole === 'driver' && driverSockets.get(userId) === socket.id) {
        driverSockets.delete(userId);
      }
      console.log('[WS] disconnected:', { socketId: socket.id, reason });
    });
  });

  // Hub API για το υπόλοιπο app
  hub = {
    io,
    notifyDriverProposal(driverId, payload) {
      io.to(`driver:${driverId}`).emit('ride:proposal', payload);
      console.log('[WS] emitting ride:proposal to', `driver:${driverId}`, payload);
    },
    notifyDriverProposalExpired(driverId, payload) {
      // payload: { rideId }
      io.to(`driver:${driverId}`).emit('ride:proposal:expired', payload);
      console.log('[WS] emitting ride:proposal:expired to', `driver:${driverId}`, payload);
    },
    pingDriverPosition(driverId, payload) {
      io.to(`driver:${driverId}`).emit('driver:pos:ping', payload);
    },
    pingAllDrivers(payload) {
      io.to('drivers').emit('driver:pos:ping', payload);
    },
  };

  return io;
}

function getHub() {
  return hub;
}

module.exports = { initWs, getHub };
