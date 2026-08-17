const express = require('express');
const cors = require('cors');

// Import Config
const { PORT, CORS_ORIGIN } = require('./src/config/env');

// Import DB Pool & Initialization
const pool = require('./src/db/pool');
const { initDb } = require('./src/db/migrations');

// Import Routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const weightRoutes = require('./src/routes/weightRoutes');

// Stateless REST API using Header-based Bearer JWT authentication (immune to CSRF)
const app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
app.set('trust proxy', 1);

app.use(cors({
  origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'user-service' });
});

app.use('/api/users', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users', weightRoutes);

// Initialize DB and start server
let server;
initDb().then(() => {
  server = app.listen(PORT, () => {
    console.log(`User Service running on port ${PORT}`);
  });
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down user-service gracefully...`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      pool.end().then(() => {
        console.log('PostgreSQL pool closed.');
        process.exit(0);
      }).catch((err) => {
        console.error('Error closing PostgreSQL pool:', err);
        process.exit(1);
      });
    });
  } else {
    process.exit(0);
  }
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

