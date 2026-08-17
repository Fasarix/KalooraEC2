const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTargets } = require('../src/services/macroCalculator');

test('calculates targets for male with moderate activity level', () => {
  const result = calculateTargets(80, 180, 25, 'male', 'moderate');
  assert.ok(result.calories > 0);
  assert.ok(result.carbs > 0);
  assert.ok(result.protein > 0);
  assert.ok(result.fat > 0);
});

test('calculates targets for female with default activity level', () => {
  const result = calculateTargets(60, 165, 30, 'female', 'sedentary');
  assert.ok(result.calories > 0);
});

