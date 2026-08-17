const express = require('express');
const { body } = require('express-validator');
const { register, login } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validator');

const router = express.Router();

const registerValidation = [
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: 6 }).withMessage('La password deve contenere almeno 6 caratteri'),
  body('name').notEmpty().withMessage('Il nome è obbligatorio'),
  body('age').isInt({ min: 1, max: 120 }).withMessage('Età non valida'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Genere non valido'),
  body('height').isFloat({ min: 50, max: 250 }).withMessage('Altezza non valida'),
  body('weight').isFloat({ min: 20, max: 300 }).withMessage('Peso non valido')
];

const loginValidation = [
  body('email').isEmail().withMessage('Email non valida'),
  body('password').notEmpty().withMessage('La password è obbligatoria')
];

router.post('/register', authLimiter, validate(registerValidation), register);
router.post('/login', authLimiter, validate(loginValidation), login);

module.exports = router;

