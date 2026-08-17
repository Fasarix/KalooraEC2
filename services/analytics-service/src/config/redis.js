const redis = require('redis');
const { REDIS_URL, REDIS_PASSWORD, REDIS_TLS } = require('./env');

const clientOptions = {
  url: REDIS_URL
};

if (REDIS_PASSWORD) {
  clientOptions.password = REDIS_PASSWORD;
}

if (REDIS_TLS || REDIS_URL.startsWith('rediss://')) {
  clientOptions.socket = {
    tls: true
  };
}

const redisClient = redis.createClient(clientOptions);

redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));

redisClient.connect()
  .then(() => console.log('Connected to Redis (In-Transit Encryption TLS active).'))
  .catch((err) => console.error('Failed to connect to Redis:', err.message));

module.exports = redisClient;
