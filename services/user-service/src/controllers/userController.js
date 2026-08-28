const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { calculateTargets } = require('../services/macroCalculator');

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, age, gender, height, weight, activity_level, goal, daily_calories, target_carbs, target_protein, target_fat, fasting_protocol, enabled_meals FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving profile' });
  }
};

const updateProfile = async (req, res) => {
  const { email, name, password, age, gender, height, weight, activityLevel, goal, fastingProtocol, enabledMeals } = req.body;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingUser = userRes.rows[0];

    let newPasswordHash = existingUser.password;
    if (password && password.trim().length > 0) {
      newPasswordHash = await bcrypt.hash(password, 10);
    }

    const newEmail = email || existingUser.email;
    const newName = name || existingUser.name;
    const newAge = age ? parseInt(age) : existingUser.age;
    const newGender = gender || existingUser.gender;
    const newHeight = height ? parseFloat(height) : existingUser.height;
    const newWeight = weight ? parseFloat(weight) : existingUser.weight;
    const newActivity = activityLevel || existingUser.activity_level;
    const newGoal = goal || existingUser.goal || 'maintenance';
    const newFasting = fastingProtocol !== undefined ? fastingProtocol : existingUser.fasting_protocol;
    const newMeals = enabledMeals !== undefined ? enabledMeals : existingUser.enabled_meals;

    const targets = calculateTargets(newWeight, newHeight, newAge, newGender, newActivity, newGoal);

    const updateQuery = `
      UPDATE users 
      SET email = $1, password = $2, name = $3, age = $4, gender = $5, height = $6, weight = $7, 
          activity_level = $8, goal = $9, daily_calories = $10, target_carbs = $11, target_protein = $12, target_fat = $13,
          fasting_protocol = $14, enabled_meals = $15
      WHERE id = $16
      RETURNING id, email, name, age, gender, height, weight, activity_level, goal, daily_calories, target_carbs, target_protein, target_fat, fasting_protocol, enabled_meals;
    `;

    const updatedResult = await pool.query(updateQuery, [
      newEmail, newPasswordHash, newName, newAge, newGender,
      newHeight, newWeight, newActivity, newGoal, targets.calories,
      targets.carbs, targets.protein, targets.fat, newFasting, newMeals, req.user.id
    ]);

    if (newWeight !== existingUser.weight) {
      await pool.query(
        'INSERT INTO weight_history (user_id, weight, date) VALUES ($1, $2, CURRENT_DATE)',
        [req.user.id, newWeight]
      );
    }

    res.json({ message: 'Profile updated successfully', user: updatedResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
};

module.exports = { getProfile, updateProfile };
