const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { JWT_SECRET } = require('../config/env');
const { calculateTargets } = require('../services/macroCalculator');

const register = async (req, res) => {
  const { email, password, name, age, gender, height, weight, activityLevel, goal, fastingProtocol, enabledMeals } = req.body;

  if (!email || !password || !name || !age || !gender || !height || !weight || !activityLevel) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const userGoal = goal || 'maintenance';
    const hashedPassword = await bcrypt.hash(password, 10);
    const targets = calculateTargets(parseFloat(weight), parseFloat(height), parseInt(age), gender, activityLevel, userGoal);
    const fProtocol = fastingProtocol || 'none';
    const eMeals = enabledMeals || 'breakfast,lunch,dinner,snack';

    const insertQuery = `
      INSERT INTO users (email, password, name, age, gender, height, weight, activity_level, goal, daily_calories, target_carbs, target_protein, target_fat, fasting_protocol, enabled_meals)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, email, name, age, gender, height, weight, activity_level, goal, daily_calories, target_carbs, target_protein, target_fat, fasting_protocol, enabled_meals;
    `;

    const result = await pool.query(insertQuery, [
      email, hashedPassword, name, parseInt(age), gender,
      parseFloat(height), parseFloat(weight), activityLevel, userGoal,
      targets.calories, targets.carbs, targets.protein, targets.fat,
      fProtocol, eMeals
    ]);

    const newUser = result.rows[0];

    await pool.query(
      'INSERT INTO weight_history (user_id, weight, date) VALUES ($1, $2, CURRENT_DATE)',
      [newUser.id, parseFloat(weight)]
    );

    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        activityLevel: user.activity_level,
        goal: user.goal || 'maintenance',
        dailyCalories: user.daily_calories,
        targetCarbs: user.target_carbs,
        targetProtein: user.target_protein,
        targetFat: user.target_fat,
        fastingProtocol: user.fasting_protocol || 'none',
        enabledMeals: user.enabled_meals || 'breakfast,lunch,dinner,snack'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

module.exports = { register, login };
