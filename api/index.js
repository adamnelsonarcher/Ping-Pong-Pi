const express = require('express');
const cors = require('cors');
const getData = require('./getData');
const saveData = require('./saveData');
const deleteAccount = require('./deleteAccount');

const app = express();

/**
 * In production the API and the app share an origin, so no cross-origin request
 * should be arriving at all. ALLOWED_ORIGINS exists for local development and
 * preview deployments.
 *
 * This used to be `origin: '*'` with `credentials: true` — which browsers reject
 * outright, so it was not even doing what it appeared to (docs/AUDIT.md S-04).
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and server-to-server requests have no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

app.get('/api/getData', getData);
app.post('/api/saveData', saveData);
app.post('/api/deleteAccount', deleteAccount);

module.exports = app;
