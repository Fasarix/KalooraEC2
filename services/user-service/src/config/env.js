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

const pgUser = process.env.POSTGRES_USER || 'postgres';
const pgPass = encodeURIComponent(process.env.POSTGRES_PASSWORD || '');
const pgHost = process.env.POSTGRES_HOST || 'localhost';
const pgPort = process.env.POSTGRES_PORT || '5432';
const pgDb = process.env.POSTGRES_DB || 'userdb';

const defaultDbUrl = pgPass ? `postgresql://${pgUser}:${pgPass}@${pgHost}:${pgPort}/${pgDb}` : `postgresql://${pgUser}@${pgHost}:${pgPort}/${pgDb}`;

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT || 5001,
  DATABASE_URL: process.env.DATABASE_URL || defaultDbUrl,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};
