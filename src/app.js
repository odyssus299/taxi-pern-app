const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
//const session = require('./middleware/session');
const { notFound, errorHandler } = require('./middleware/error');
const api = require('./routes/index.js');
const adminRoutes = require('./routes/admin/index.js');
const driverRoutes = require('./routes/driver');
const publicRoutes = require('./routes/public');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());                // why: secure headers baseline
app.use(cors({
  origin: true,
  credentials: false, // ❌ δεν χρησιμοποιούμε cookies
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json({ limit: '100kb' })); // why: guard oversized bodies
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev')); // why: request logs
//app.use(session);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);
app.use('/api/admin', adminRoutes);

app.use('/api/driver', driverRoutes);

app.use('/api/public', publicRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;