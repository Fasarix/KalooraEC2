const { Pool } = require('pg');
const { DATABASE_URL } = require('../config/env');

const poolConfig = {
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const fs = require('fs');
const path = require('path');

const rdsCaPath = path.join(__dirname, '../../global-bundle.pem');
const hasRdsCa = fs.existsSync(rdsCaPath);

// Abilita la crittografia in-transit autenticata (SSL/TLS) con validazione CA per Amazon RDS
if (process.env.PGSSLMODE === 'require' || DATABASE_URL.includes('rds.amazonaws.com') || process.env.NODE_ENV === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: hasRdsCa,
    ...(hasRdsCa ? { ca: fs.readFileSync(rdsCaPath).toString() } : {})
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
