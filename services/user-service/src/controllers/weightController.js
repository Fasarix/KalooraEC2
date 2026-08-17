const pool = require('../db/pool');
const { calculateTargets } = require('../services/macroCalculator');

const recordWeight = async (req, res) => {
  // Extract weight and date from request body
  const { weight, date } = req.body;

  const numWeight = parseFloat(weight);
  if (isNaN(numWeight) || numWeight <= 0) {
    return res.status(400).json({ error: 'Valid positive weight is required' });
  }

  const logDate = date || new Date().toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  if (logDate > todayStr) {
    return res.status(400).json({ error: 'Non puoi inserire una data futura per il peso.' });
  }

  try {
    await pool.query(
      'INSERT INTO weight_history (user_id, weight, date) VALUES ($1, $2, $3)',
      [req.user.id, numWeight, logDate]
    );

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length > 0) {
      const u = userRes.rows[0];
      const targets = calculateTargets(numWeight, u.height, u.age, u.gender, u.activity_level);

      await pool.query(
        `UPDATE users SET weight = $1, daily_calories = $2, target_carbs = $3, target_protein = $4, target_fat = $5 WHERE id = $6`,
        [numWeight, targets.calories, targets.carbs, targets.protein, targets.fat, req.user.id]
      );
    }

    res.json({ message: 'Weight logged successfully', weight: numWeight, date: logDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error logging weight' });
  }
};

const getWeightHistory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, weight, date, created_at 
       FROM weight_history 
       WHERE user_id = $1 
       ORDER BY date DESC, created_at DESC 
       LIMIT 30`,
      [req.user.id]
    );
    res.json(result.rows.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error retrieving weight history' });
  }
};

const updateWeightEntry = async (req, res) => {
  const { id } = req.params;
  const { weight, date } = req.body;
  if (!weight || !date) return res.status(400).json({ error: 'Weight and date are required' });

  const numWeight = parseFloat(weight);
  const todayStr = new Date().toISOString().split('T')[0];

  if (date > todayStr) {
    return res.status(400).json({ error: 'Non puoi inserire una data futura per il peso.' });
  }

  try {
    await pool.query(
      'UPDATE weight_history SET weight = $1, date = $2 WHERE id = $3 AND user_id = $4',
      [numWeight, date, id, req.user.id]
    );

    // Update current user weight to latest entry
    const latestRes = await pool.query(
      'SELECT weight FROM weight_history WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 1',
      [req.user.id]
    );
    if (latestRes.rows.length > 0) {
      const latestW = latestRes.rows[0].weight;
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        const targets = calculateTargets(latestW, u.height, u.age, u.gender, u.activity_level);
        await pool.query(
          `UPDATE users SET weight = $1, daily_calories = $2, target_carbs = $3, target_protein = $4, target_fat = $5 WHERE id = $6`,
          [latestW, targets.calories, targets.carbs, targets.protein, targets.fat, req.user.id]
        );
      }
    }

    res.json({ message: 'Weight entry updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating weight entry' });
  }
};

const deleteWeightEntry = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM weight_history WHERE id = $1 AND user_id = $2', [id, req.user.id]);

    // Update current user weight to latest entry
    const latestRes = await pool.query(
      'SELECT weight FROM weight_history WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 1',
      [req.user.id]
    );
    if (latestRes.rows.length > 0) {
      const latestW = latestRes.rows[0].weight;
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        const targets = calculateTargets(latestW, u.height, u.age, u.gender, u.activity_level);
        await pool.query(
          `UPDATE users SET weight = $1, daily_calories = $2, target_carbs = $3, target_protein = $4, target_fat = $5 WHERE id = $6`,
          [latestW, targets.calories, targets.carbs, targets.protein, targets.fat, req.user.id]
        );
      }
    }

    res.json({ message: 'Weight entry deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting weight entry' });
  }
};

module.exports = { recordWeight, getWeightHistory, updateWeightEntry, deleteWeightEntry };
