// =====================================================
// file: src/controllers/admin/message.controller.js
// =====================================================
const { pool } = require('../../db/pool');
const HttpError = require('../../utils/HttpError');
const AdminMessagesRepo = require('../../repos/adminMessages.repo');

// POST /api/admin/messages  (κρατάει max 2 με transaction)
exports.sendMessage = async (req, res, next) => {
  const adminId = Number(req.user?.id);
  if (!adminId) {
    return next(new HttpError('Δεν είστε συνδεδεμένος.', 401));
  }

  const content = String(req.body?.content || '').trim();
  if (!content) {
    return next(new HttpError('Το μήνυμα δεν μπορεί να είναι κενό.', 400));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Κλειδώνουμε τον πίνακα ώστε να είναι ατομικό το trim+insert
    await client.query('LOCK TABLE public.admin_messages IN EXCLUSIVE MODE');

    const { rows: cntRows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM public.admin_messages'
    );
    const count = cntRows[0]?.count ?? 0;

    if (count >= 2) {
      // Διαγράφουμε το πιο παλιό
      await client.query(`
        DELETE FROM public.admin_messages
        WHERE id = (
          SELECT id FROM public.admin_messages
          ORDER BY created_at ASC, id ASC
          LIMIT 1
        )
      `);
    }

    const { rows } = await client.query(
      `INSERT INTO public.admin_messages (content)
       VALUES ($1)
       RETURNING id, content, created_at`,
      [content]
    );

    await client.query('COMMIT');

    const row = rows[0];
    return res.status(201).json({
      success: true,
      data: {
        message: {
          id: String(row.id),
          content: row.content,
          createdAt: row.created_at
        }
      }
    });
  } catch (_e) {
    await client.query('ROLLBACK');
    return next(new HttpError('Προέκυψε σφάλμα κατά την αποστολή μηνύματος διαχειριστή.', 500));
  } finally {
    client.release();
  }
};
