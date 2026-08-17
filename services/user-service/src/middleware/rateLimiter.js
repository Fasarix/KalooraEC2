const rateLimit = require('express-rate-limit');

// Rate limiter for authentication endpoints (15 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: 'Troppi tentativi. Riprova tra qualche minuto.' }
});

module.exports = { authLimiter };
