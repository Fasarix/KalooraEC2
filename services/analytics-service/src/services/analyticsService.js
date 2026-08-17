const calculateDailyStats = (diary, date) => {
  let calories = 0, carbs = 0, protein = 0, fat = 0;
  const meals = diary.meals || {};
  
  Object.keys(meals).forEach(mealType => {
    meals[mealType].forEach(item => {
      calories += item.calories || 0;
      carbs += item.carbs || 0;
      protein += item.protein || 0;
      fat += item.fat || 0;
    });
  });

  let exerciseCalories = 0;
  const activities = diary.activities || [];
  activities.forEach(act => {
    exerciseCalories += act.calories || 0;
  });

  const water = diary.water || 0;

  return {
    date,
    calories,
    carbs: Math.round(carbs * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    water,
    exerciseCalories,
    netCalories: Math.max(0, calories - exerciseCalories)
  };
};

const calculatePeriodStats = (currentRangeData, prevRangeData, currentDate, daysCount) => {
  const series = [];
  let totalCals = 0;
  let totalWater = 0;
  let totalExercise = 0;
  const foodFrequency = {};

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const diary = currentRangeData[dateStr] || {};
    let calories = 0, carbs = 0, protein = 0, fat = 0, exerciseCalories = 0;
    
    const meals = diary.meals || {};
    Object.keys(meals).forEach(m => {
      (meals[m] || []).forEach(item => {
        calories += item.calories || 0;
        carbs += item.carbs || 0;
        protein += item.protein || 0;
        fat += item.fat || 0;
        if (item.foodName) {
          foodFrequency[item.foodName] = (foodFrequency[item.foodName] || 0) + 1;
        }
      });
    });

    (diary.activities || []).forEach(act => { exerciseCalories += act.calories || 0; });

    const stats = {
      date: dateStr,
      calories,
      carbs: Math.round(carbs * 10) / 10,
      protein: Math.round(protein * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      water: diary.water || 0,
      exerciseCalories
    };

    series.push(stats);
    totalCals += stats.calories;
    totalWater += stats.water;
    totalExercise += stats.exerciseCalories;
  }

  // Calculate previous period totals from batch data
  let prevTotalCals = 0;
  let prevTotalWater = 0;
  let prevTotalExercise = 0;

  Object.values(prevRangeData).forEach(diary => {
    let c = 0, w = diary.water || 0, e = 0;
    Object.keys(diary.meals || {}).forEach(m => {
      (diary.meals[m] || []).forEach(item => c += item.calories || 0);
    });
    (diary.activities || []).forEach(act => e += act.calories || 0);
    prevTotalCals += c;
    prevTotalWater += w;
    prevTotalExercise += e;
  });

  const calorieDiffPct = prevTotalCals > 0 
    ? Math.round(((totalCals - prevTotalCals) / prevTotalCals) * 100)
    : (totalCals > 0 ? 100 : 0);

  const waterDiffPct = prevTotalWater > 0
    ? Math.round(((totalWater - prevTotalWater) / prevTotalWater) * 100)
    : (totalWater > 0 ? 100 : 0);

  const exerciseDiffPct = prevTotalExercise > 0
    ? Math.round(((totalExercise - prevTotalExercise) / prevTotalExercise) * 100)
    : (totalExercise > 0 ? 100 : 0);

  // Highlights
  let favoriteFood = '-';
  let favoriteFoodCount = 0;
  Object.keys(foodFrequency).forEach(f => {
    if (foodFrequency[f] > favoriteFoodCount) {
      favoriteFoodCount = foodFrequency[f];
      favoriteFood = f;
    }
  });

  let peakActivity = { name: '-', calories: 0, date: '-' };
  let peakProtein = { protein: 0, date: '-' };

  series.forEach(s => {
    if (s.exerciseCalories > peakActivity.calories) {
      peakActivity = { name: 'Allenamento', calories: s.exerciseCalories, date: s.date };
    }
    if (s.protein > peakProtein.protein) {
      peakProtein = { protein: s.protein, date: s.date };
    }
  });

  return {
    series,
    averages: {
      calories: Math.round(totalCals / daysCount),
      water: Math.round(totalWater / daysCount),
      exerciseCalories: Math.round(totalExercise / daysCount)
    },
    comparison: {
      calorieDiffPct,
      waterDiffPct,
      exerciseDiffPct
    },
    highlights: {
      favoriteFood,
      favoriteFoodCount,
      peakActivity,
      peakProtein
    }
  };
};

module.exports = {
  calculateDailyStats,
  calculatePeriodStats
};
