// Calculate daily targets
const calculateTargets = (weight, height, age, gender, activityLevel) => {
  let bmr = 0;
  if (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'm') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  let multiplier = 1.2;
  if (activityLevel === 'moderate') multiplier = 1.55;
  if (activityLevel === 'active') multiplier = 1.725;

  const calories = Math.round(bmr * multiplier);
  const carbs = Math.round((calories * 0.50) / 4);
  const protein = Math.round((calories * 0.20) / 4);
  const fat = Math.round((calories * 0.30) / 9);

  return { calories, carbs, protein, fat };
};

module.exports = { calculateTargets };
