const pool = require('./pool');

const initDb = async () => {
  const queryUsers = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      age INTEGER NOT NULL,
      gender VARCHAR(20) NOT NULL,
      height DOUBLE PRECISION NOT NULL,
      weight DOUBLE PRECISION NOT NULL,
      activity_level VARCHAR(50) NOT NULL,
      goal VARCHAR(50) DEFAULT 'maintenance',
      daily_calories INTEGER NOT NULL,
      target_carbs INTEGER NOT NULL,
      target_protein INTEGER NOT NULL,
      target_fat INTEGER NOT NULL,
      fasting_protocol VARCHAR(50) DEFAULT 'none',
      enabled_meals TEXT DEFAULT 'breakfast,lunch,dinner,snack',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const queryWeightHistory = `
    CREATE TABLE IF NOT EXISTS weight_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      weight DOUBLE PRECISION NOT NULL,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const maxRetries = 10;
  const delayMs = 5000;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await pool.query(queryUsers);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS goal VARCHAR(50) DEFAULT 'maintenance';`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fasting_protocol VARCHAR(50) DEFAULT 'none';`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_meals TEXT DEFAULT 'breakfast,lunch,dinner,snack';`);
      await pool.query(queryWeightHistory);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_weight_history_user_date ON weight_history (user_id, date DESC);`);
      console.log('Database tables "users" and "weight_history" initialized with indexes.');
      return;
    } catch (err) {
      console.error(`Error initializing database (attempt ${i}/${maxRetries}):`, err.message);
      if (i === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

module.exports = { initDb };
