const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTargets } = require('../src/services/macroCalculator');

test('calculates maintenance targets for male with moderate activity level', () => {
  const result = calculateTargets(80, 180, 25, 'male', 'moderate', 'maintenance');
  // BMR = 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
  // TDEE = 1805 * 1.55 = 2797.75 -> 2798 kcal
  assert.equal(result.calories, 2798);
  // Carbs: 50% = 1399 / 4 = 350g
  assert.equal(result.carbs, 350);
  // Protein: 20% = 559.6 / 4 = 140g
  assert.equal(result.protein, 140);
  // Fat: 30% = 839.4 / 9 = 93g
  assert.equal(result.fat, 93);
});

test('calculates lose_weight (deficit) targets with higher protein ratio', () => {
  const maintenance = calculateTargets(80, 180, 25, 'male', 'moderate', 'maintenance');
  const lose = calculateTargets(80, 180, 25, 'male', 'moderate', 'lose_weight');
  
  // Deficit should be 500 kcal
  assert.equal(lose.calories, maintenance.calories - 500);
  assert.equal(lose.calories, 2298);
  // 40% Carbs = 919.2 / 4 = 230g
  assert.equal(lose.carbs, 230);
  // 30% Protein = 689.4 / 4 = 172g
  assert.equal(lose.protein, 172);
  // 30% Fat = 689.4 / 9 = 77g
  assert.equal(lose.fat, 77);
});

test('calculates gain_mass (surplus) targets', () => {
  const maintenance = calculateTargets(80, 180, 25, 'male', 'moderate', 'maintenance');
  const gain = calculateTargets(80, 180, 25, 'male', 'moderate', 'gain_mass');
  
  // Surplus should be 350 kcal
  assert.equal(gain.calories, maintenance.calories + 350);
  assert.equal(gain.calories, 3148);
  // 50% Carbs = 1574 / 4 = 394g
  assert.equal(gain.carbs, 394);
  // 25% Protein = 787 / 4 = 197g
  assert.equal(gain.protein, 197);
  // 25% Fat = 787 / 9 = 87g
  assert.equal(gain.fat, 87);
});

test('calculates targets for female with default sedentary activity level', () => {
  const result = calculateTargets(60, 165, 30, 'female', 'sedentary');
  // BMR = 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
  // TDEE = 1320.25 * 1.2 = 1584.3 -> 1584 kcal
  assert.equal(result.calories, 1584);
  assert.ok(result.carbs > 0);
  assert.ok(result.protein > 0);
  assert.ok(result.fat > 0);
});


