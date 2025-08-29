/**
 * Dummy admin endpoints (θα προστατευτούν αργότερα με JWT).
 */
const { drivers, rides, reviews, adminMessages } = require('../../data/memory');

const DriversRepo = require('../../repos/drivers.repo');

const toApi = (row) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  phone: row.phone,
  carNumber: row.car_number,
  status: row.status,
  location: row.lat == null && row.lng == null ? null : { lat: row.lat, lng: row.lng },
  average_rating: Number(row.average_rating),
  ratingCount: Number(row.rating_count),
  role: row.role,
  created_at: row.created_at
});

const removeAccents = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

exports.getOverview = async (_req, res) => {
  res.json({
    success: true,
    data: {
      drivers: drivers.length,
      rides: rides.length,
      reviews: reviews.length,
      lastMessage: adminMessages[0] || null
    }
  });
};

exports.listDrivers = async (req, res, next) => {
  const q = (req.query.search || req.query.q || '').toString().trim();

  let rows;
  try {
    rows = await DriversRepo.getAll();
  } catch (e) {
    return next(e); // «Προέκυψε σφάλμα κατά την ανάκτηση οδηγών.»
  }

  if (!q || q.length < 4) {
    return res.json({ success: true, data: rows.map(toApi) });
  }

  const normQ = removeAccents(q.toLowerCase());
  const filtered = rows.filter((r) => {
    const full = `${r.first_name} ${r.last_name}`;
    const normName = removeAccents(full.toLowerCase());
    return normName.includes(normQ);
  });

  return res.json({ success: true, data: filtered.map(toApi) });
};

exports.broadcastMessage = async (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(422).json({ success: false, errors: { content: ['Το πεδίο είναι υποχρεωτικό.'] } });
  }
  adminMessages.unshift({ id: `msg_${Date.now()}`, content: content.trim(), createdAt: new Date().toISOString() });
  adminMessages.splice(2);
  res.status(201).json({ success: true, data: adminMessages[0] });
};