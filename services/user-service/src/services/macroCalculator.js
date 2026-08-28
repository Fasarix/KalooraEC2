// Calculate daily targets based on physical metrics, activity level and personal goal
const calculateTargets = (weight, height, age, gender, activityLevel, goal = 'maintenance') => {
  let bmr = 0;
  const isMale = (gender || '').toLowerCase() === 'male' || (gender || '').toLowerCase() === 'm';
  if (isMale) {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  let multiplier = 1.2;
  if (activityLevel === 'moderate') multiplier = 1.55;
  if (activityLevel === 'active') multiplier = 1.725;

  const tdee = bmr * multiplier;
  const normalizedGoal = (goal || 'maintenance').toLowerCase();

  let calories;
  let carbsPct = 0.50;
  let proteinPct = 0.20;
  let fatPct = 0.30;

  if (normalizedGoal === 'lose_weight' || normalizedGoal === 'perdere_peso' || normalizedGoal === 'cut' || normalizedGoal === 'lose') {
    // 500 kcal deficit with safety floor of 1200 kcal
    calories = Math.max(1200, Math.round(tdee - 500));
    carbsPct = 0.40;
    proteinPct = 0.30;
    fatPct = 0.30;
  } else if (normalizedGoal === 'gain_mass' || normalizedGoal === 'mettere_massa' || normalizedGoal === 'bulk' || normalizedGoal === 'gain') {
    // 350 kcal surplus
    calories = Math.round(tdee + 350);
    carbsPct = 0.50;
    proteinPct = 0.25;
    fatPct = 0.25;
  } else {
    // maintenance
    calories = Math.round(tdee);
    carbsPct = 0.50;
    proteinPct = 0.20;
    fatPct = 0.30;
  }

  const carbs = Math.round((calories * carbsPct) / 4);
  const protein = Math.round((calories * proteinPct) / 4);
  const fat = Math.round((calories * fatPct) / 9);

  return { calories, carbs, protein, fat };
};

module.exports = { calculateTargets };
