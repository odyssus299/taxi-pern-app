require('dotenv').config();
const { Pool } = require('pg');

function parseBool(v, fallback = false) {
  if (typeof v !== 'string') return fallback;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function cfg() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: parseBool(process.env.DB_SSL, false) ? { rejectUnauthorized: false } : false,
      max: 10
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: parseBool(process.env.DB_SSL, false) ? { rejectUnauthorized: false } : false,
    max: 10
  };
}

const pool = new Pool(cfg());

pool.on('error', (err) => {
  console.error('[pg] idle client error:', err); // why: να μη σκάει σιωπηλά
});

async function checkDb() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  if (!rows?.[0]?.ok) throw new Error('DB health check failed');
}

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, checkDb, withTx };