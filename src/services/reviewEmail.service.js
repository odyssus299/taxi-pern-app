const { pool } = require('../db/pool');
const Mailer = require('./mailer');            // <— Χρησιμοποιούμε αυτό
const HttpError = require('../utils/HttpError');

const PUBLIC_REVIEW_URL_BASE =
  process.env.PUBLIC_REVIEW_URL_BASE || 'http://localhost:3000/review?token=';

/** Φέρνει τα στοιχεία για email review */
async function getReviewEmailPayload(rideId) {
  const sql = `
    SELECT
      r.id, r.review_token, r.review_submitted, r.review_sent_at,
      r.user_id,
      COALESCE(u.email, r.requester_email)              AS customer_email,
      d.first_name || ' ' || d.last_name                AS driver_full_name,
      d.car_number                                      AS car_number
    FROM public.rides r
    JOIN public.drivers d ON d.id = r.driver_id
    LEFT JOIN public.users u ON u.id = r.user_id
    WHERE r.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [rideId]);
  return rows[0] || null;
}

/** Μαρκάρει ότι στάλθηκε email */
async function markSent(rideId) {
  await pool.query(
    `UPDATE public.rides
     SET review_sent_at = NOW()
     WHERE id = $1`,
    [rideId]
  );
}

/** Στέλνει email review για συγκεκριμένο ride (αν υπάρχει παραλήπτης) */
async function sendForRide(rideId) {
  const payload = await getReviewEmailPayload(rideId);
  if (!payload) return { skipped: true, reason: 'ride_not_found' };
  if (payload.review_submitted) return { skipped: true, reason: 'already_reviewed' };

  const to = (payload.customer_email || '').trim();
  if (!to) return { skipped: true, reason: 'no_email' };

  const link = `${PUBLIC_REVIEW_URL_BASE}${encodeURIComponent(payload.review_token)}`;
  const ttlDays = Number(process.env.REVIEW_TOKEN_TTL_DAYS || 20);
  const subject = 'Αξιολογήστε τη διαδρομή σας';
  const html = `
  <p>Γεια σας,</p>
  <p>Ολοκληρώθηκε η διαδρομή σας με τον οδηγό <b>${payload.driver_full_name}</b>
     (πινακίδα <b>${payload.car_number || '-'}</b>).</p>
  <p>Παρακαλούμε πατήστε τον παρακάτω σύνδεσμο για να αφήσετε την αξιολόγησή σας:</p>
  <p><a href="${link}">${link}</a></p>
  <p><em>Σημείωση:</em> ο σύνδεσμος ισχύει για <b>${ttlDays}</b> ημέρες. Μετά θα λήξει και δεν θα μπορεί να χρησιμοποιηθεί.</p>
  <p>Σας ευχαριστούμε!</p>
`;

const text =
  `Γεια σας,\n` +
  `Ολοκληρώθηκε η διαδρομή σας με τον οδηγό ${payload.driver_full_name} ` +
  `(πινακίδα ${payload.car_number || '-'}).\n\n` +
  `Παρακαλούμε ανοίξτε τον παρακάτω σύνδεσμο για να αφήσετε την αξιολόγησή σας:\n` +
  `${link}\n\n` +
  `Σημείωση: ο σύνδεσμος ισχύει για ${ttlDays} ημέρες. ` +
  `Μετά θα λήξει και δεν θα μπορεί να χρησιμοποιηθεί.\n\n` +
  `Σας ευχαριστούμε!`;

  await Mailer.sendMail({ to, subject, text, html }); // <— καλεί το services/mailer.js
  await markSent(rideId);
  return { sent: true, to };
}

module.exports = { sendForRide };