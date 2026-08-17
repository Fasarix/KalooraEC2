const redisClient = require('../config/redis');
const { DIARY_SERVICE_URL } = require('../config/env');
const analyticsService = require('../services/analyticsService');
const { sanitizeForLog } = require('../utils/logSanitizer');

const getDailyAnalytics = async (req, res) => {
  const userId = req.user.id || req.user.userId;
  const date = req.query.date;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const cacheKey = `stats:${userId}:${date}`;
  const today = new Date().toISOString().split('T')[0];
  const isToday = (date === today);

  try {
    // Only use cache for historical dates - current day must always be fresh
    if (!isToday) {
      const cachedStats = await redisClient.get(cacheKey);
      if (cachedStats) {
        const stats = JSON.parse(cachedStats);
        stats.date = stats.date || date;
        console.log(`Cache HIT for key ${sanitizeForLog(cacheKey)}`);
        return res.json({ source: 'cache', stats });
      }
    }

    console.log(`${isToday ? 'Live fetch (today)' : 'Cache MISS'} for key ${sanitizeForLog(cacheKey)}. Fetching from Diary Service...`);
    
    // 5s timeout to prevent cascading failures
    const response = await fetch(`${DIARY_SERVICE_URL}/api/diary?date=${date}`, {
      headers: { 'Authorization': req.headers['authorization'] },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Diary service returned ${response.status}`);
    }

    const diary = await response.json();
    
    const stats = analyticsService.calculateDailyStats(diary, date);

    // Cache only historical dates (they don't change); skip cache for today
    if (!isToday) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(stats));
    }

    res.json({ source: 'database', stats });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Server error while processing analytics' });
  }
};

// Fix F-02: Single batch request for range analytics to eliminate N+1 problem
const getPeriodAnalytics = async (req, res) => {
  const userId = req.user.id || req.user.userId;
  const period = req.query.period || 'weekly';
  const currentDateStr = req.query.date || new Date().toISOString().split('T')[0];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDateStr)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const daysCount = period === 'monthly' ? 30 : 7;
  const currentDate = new Date(currentDateStr);

  const currentStartDate = new Date(currentDate);
  currentStartDate.setDate(currentStartDate.getDate() - (daysCount - 1));
  const currentStartStr = currentStartDate.toISOString().split('T')[0];

  const prevEndDate = new Date(currentStartDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevEndStr = prevEndDate.toISOString().split('T')[0];

  const prevStartDate = new Date(currentStartDate);
  prevStartDate.setDate(prevStartDate.getDate() - daysCount);
  const prevStartStr = prevStartDate.toISOString().split('T')[0];

  try {
    // Single batch call to diary-service for current and previous periods
    const [currentRangeRes, prevRangeRes] = await Promise.all([
      // 5s timeout to prevent cascading failures
      fetch(`${DIARY_SERVICE_URL}/api/diary/range?startDate=${currentStartStr}&endDate=${currentDateStr}`, {
        headers: { 'Authorization': req.headers['authorization'] },
        signal: AbortSignal.timeout(5000)
      }),
      fetch(`${DIARY_SERVICE_URL}/api/diary/range?startDate=${prevStartStr}&endDate=${prevEndStr}`, {
        headers: { 'Authorization': req.headers['authorization'] },
        signal: AbortSignal.timeout(5000)
      })
    ]);

    const currentRangeData = currentRangeRes.ok ? await currentRangeRes.json() : {};
    const prevRangeData = prevRangeRes.ok ? await prevRangeRes.json() : {};

    const { series, averages, comparison, highlights } = analyticsService.calculatePeriodStats(
      currentRangeData, 
      prevRangeData, 
      currentDate, 
      daysCount
    );

    res.json({
      period,
      series,
      averages,
      comparison: {
        ...comparison,
        periodName: period === 'monthly' ? 'mese scorso' : 'settimana scorsa'
      },
      highlights
    });
  } catch (err) {
    console.error('Error fetching period analytics:', err);
    res.status(500).json({ error: 'Server error while calculating period statistics' });
  }
};

module.exports = {
  getDailyAnalytics,
  getPeriodAnalytics
};
