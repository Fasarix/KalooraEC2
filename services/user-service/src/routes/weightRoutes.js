const express = require('express');
const { recordWeight, getWeightHistory, updateWeightEntry, deleteWeightEntry } = require('../controllers/weightController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/weight', authenticateToken, recordWeight);
router.get('/weight-history', authenticateToken, getWeightHistory);
router.put('/weight-history/:id', authenticateToken, updateWeightEntry);
router.delete('/weight-history/:id', authenticateToken, deleteWeightEntry);

module.exports = router;
