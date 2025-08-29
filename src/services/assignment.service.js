// ======================================================================
// File: src/services/assignment.service.js   (ΕΝΗΜΕΡΩΜΕΝΟ)
// ======================================================================
const { v4: uuidv4 } = require('uuid');
const { drivers, mockRideRequests } = require('../data/memory');

// rideId -> { candidates:[{driverId,distKm}], idx, status, payload, acceptedDriverId?, updatedAt? }
const assignments = new Map();

function toRad(x) { return (x * Math.PI) / 180; }
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - (s1 + s2)));
  return R * c;
}

// Στο mock θεωρούμε fresh ακόμη κι αν λείπει lastSeen.
function isFresh(lastSeenIso) {
  if (!lastSeenIso) return true;
  const FRESH_MINUTES = 5;
  return (Date.now() - new Date(lastSeenIso).getTime()) <= FRESH_MINUTES * 60 * 1000;
}

function getAvailableDriversWithDistance(target, limit = 10) {
  const pool = drivers.filter(d =>
    d.role === 'driver' &&
    d.status === 'available' &&          // ΜΟΝΟ διαθέσιμοι
    d.location && isFresh(d.lastSeen)
  );
  const enriched = pool.map(d => ({
    driverId: d.id,
    distKm: haversineKm(
      { lat: +target.lat, lng: +target.lng },
      { lat: +d.location.lat, lng: +d.location.lng }
    )
  }));
  enriched.sort((a,b) => a.distKm - b.distKm);
  return enriched.slice(0, limit);
}

function createRideSnapshot({ firstName, lastName, phone, email, address, coordinates }) {
  const rideId = uuidv4();
  return {
    id: rideId,
    passenger: { firstName, lastName, phone, email, address },
    pickup: { lat: +coordinates.lat, lng: +coordinates.lng }
  };
}

function pushMockRequest(rideId, driverId, payload) {
  // why: αποφευγούμε διπλό awaiting στον ίδιο οδηγό
  for (const rr of mockRideRequests) {
    if (rr.assignedDriverId === driverId && rr.status === 'awaiting_response') rr.status = 'rejected';
  }
  mockRideRequests.push({
    id: rideId,
    assignedDriverId: driverId,
    status: 'awaiting_response',
    notifiedAt: new Date().toISOString(),
    location: payload.pickup,
    firstName: payload.passenger.firstName,
    lastName: payload.passenger.lastName,
    phone: payload.passenger.phone,
    address: payload.passenger.address,
    email: payload.passenger.email
  });
}

function assignToCurrent(rideId) {
  const state = assignments.get(rideId);
  if (!state) return null;
  if (state.idx >= state.candidates.length) return null;
  const candidate = state.candidates[state.idx];
  pushMockRequest(rideId, candidate.driverId, state.payload);
  state.updatedAt = new Date().toISOString();
  return candidate;
}

function nextCandidate(rideId) {
  const state = assignments.get(rideId);
  if (!state) return null;
  state.idx += 1;
  if (state.idx >= state.candidates.length) return null;
  return assignToCurrent(rideId);
}

function startAssignment(input) {
  const ride = createRideSnapshot(input);
  const candidates = getAvailableDriversWithDistance(input.coordinates, 10);
  assignments.set(ride.id, {
    candidates,
    idx: 0,
    status: 'in_progress',
    payload: ride,
    updatedAt: new Date().toISOString()
  });
  const first = assignToCurrent(ride.id);
  return { rideId: ride.id, firstCandidate: first, candidatesCount: candidates.length };
}

// result: 'accepted' | 'exhausted' | 'cancelled'
function completeAssignment(rideId, result, { driverId } = {}) {
  const state = assignments.get(rideId);
  if (!state) return;
  state.status = result;
  if (result === 'accepted' && driverId) state.acceptedDriverId = driverId;
  state.updatedAt = new Date().toISOString();
}

function getAssignment(rideId) {
  return assignments.get(rideId) || null;
}

module.exports = {
  assignments,
  startAssignment,
  nextCandidate,
  completeAssignment,
  getAssignment
};
