const express = require('express');
const cors = require('cors');

// Import Configs
const { PORT, CORS_ORIGIN } = require('./src/config/env');
const redisClient = require('./src/config/redis');

// Import Routes & Consumers
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const { startConsumer, stopConsumer } = require('./src/consumers/diaryEventConsumer');

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
  res.json({ status: 'UP', service: 'analytics-service' });
});

app.use('/api/analytics', analyticsRoutes);

const server = app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
  // Start SQS event consumer
  startConsumer(redisClient);
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down analytics-service gracefully...`);
  stopConsumer();
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        if (redisClient && redisClient.isOpen) {
          await redisClient.quit();
          console.log('Redis client closed.');
        }
      } catch (err) {
        console.error('Error closing Redis client:', err);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
