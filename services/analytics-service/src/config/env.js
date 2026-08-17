try {
  require('dotenv').config();
} catch (e) {
  // dotenv not present in production container
}

const requiredEnvVars = ['JWT_SECRET'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`CRITICAL ERROR: Environment variable ${varName} is missing.`);
    process.exit(1);
  }
});

if (process.env.JWT_SECRET.length < 32) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is insecure (must be >= 32 characters).');
  process.exit(1);
}

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';
const redisPassword = process.env.REDIS_PASSWORD || process.env.REDIS_AUTH_TOKEN || '';
const isRedisTls = process.env.REDIS_TLS === 'true' || redisHost.includes('cache.amazonaws.com');
const defaultRedisProtocol = isRedisTls ? 'rediss' : 'redis';
const defaultRedisUrl = redisPassword
  ? `${defaultRedisProtocol}://:${encodeURIComponent(redisPassword)}@${redisHost}:${redisPort}`
  : `${defaultRedisProtocol}://${redisHost}:${redisPort}`;

module.exports = {
  PORT: process.env.PORT || 5003,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_URL: process.env.REDIS_URL || defaultRedisUrl,
  REDIS_PASSWORD: redisPassword,
  REDIS_TLS: isRedisTls,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  SQS_QUEUE_URL: process.env.SQS_QUEUE_URL || '',
  DIARY_SERVICE_URL: process.env.DIARY_SERVICE_URL || 'http://diary-service:5002',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};
