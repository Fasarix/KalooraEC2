const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// GET /api/analytics/daily
router.get('/daily', authenticateToken, analyticsController.getDailyAnalytics);

// GET /api/analytics/period?period=weekly|monthly&date=YYYY-MM-DD
router.get('/period', authenticateToken, analyticsController.getPeriodAnalytics);

module.exports = router;
