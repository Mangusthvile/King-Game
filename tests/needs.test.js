// End-of-day needs (src/rules/needs.js, tables/needs.json), from the
// Arbiter's Stage 6 brief: 1 Food per character per day, a food's Food
// value per unit, Hunger back to max when fed, -1 and Hungry when not.
import { describe, it, expect } from 'vitest';
import { isFood, foodValueOf, foodNeeded, foodProvided, hungerAfter, conditionsAfterMeal, conditionCountdown, proposeMeal } from '../src/rules/needs.js';

describe('food', () => {
  it('counts a resource as food by its Food tag', () => {
    expect(isFood({ tags: ['Food'] })).toBe(true);
    expect(isFood({ tags: ['[Food]', 'Fruit'] })).toBe(true);
    expect(isFood({ tags: ['Wood'] })).toBe(false);
    expect(isFood({})).toBe(false);
  });

  it('uses the Food value per unit, default 1', () => {
    expect(foodValueOf({ foodValue: 3 })).toBe(3); // Metal Dragon Fruit
    expect(foodValueOf({})).toBe(1);
  });

  it('needs 1 Food per character per day', () => {
    expect(foodNeeded(10)).toBe(10);
    expect(foodProvided([{ count: 2, foodValue: 3 }, { count: 4, foodValue: 1 }])).toBe(10);
  });

  it('proposes eating foods in order until the need is met', () => {
    expect(proposeMeal([{ count: 5, foodValue: 3 }, { count: 10, foodValue: 1 }], 10)).toEqual([4, 0]);
    expect(proposeMeal([{ count: 2, foodValue: 3 }, { count: 10, foodValue: 1 }], 10)).toEqual([2, 4]);
    expect(proposeMeal([{ count: 1, foodValue: 1 }], 5)).toEqual([1]); // not enough food
  });
});

describe('hunger', () => {
  it('returns to max when fed', () => {
    expect(hungerAfter({ current: 2, max: 5 }, true)).toMatchObject({ current: 5, atRisk: false });
  });

  it('goes down by 1 when unfed, flagging 0 as at risk', () => {
    expect(hungerAfter({ current: 3, max: 5 }, false)).toMatchObject({ current: 2, atRisk: false });
    expect(hungerAfter({ current: 1, max: 5 }, false)).toMatchObject({ current: 0, atRisk: true });
    expect(hungerAfter({ current: 0, max: 5 }, false)).toMatchObject({ current: 0, atRisk: true });
  });

  it('leaves a character with no Hunger set alone', () => {
    expect(hungerAfter({ current: null, max: null }, false)).toMatchObject({ current: null, changed: false });
  });

  it('adds Hungry when unfed and counts the days', () => {
    const one = conditionsAfterMeal([], false);
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ name: 'Hungry', modifier: '-1 to all rolls per day without food', daysWithoutFood: 1 });
    const two = conditionsAfterMeal(one, false);
    expect(two).toHaveLength(1);
    expect(two[0].daysWithoutFood).toBe(2);
  });

  it('removes Hungry when fed, unless told to keep it', () => {
    const hungry = conditionsAfterMeal([{ name: 'Wounded' }], false);
    expect(conditionsAfterMeal(hungry, true)).toEqual([{ name: 'Wounded' }]);
    expect(conditionsAfterMeal(hungry, true, { removeHungry: false })).toHaveLength(2);
  });
});

describe('condition countdown', () => {
  it('counts durations down by 1 and proposes removal at 0', () => {
    const rows = conditionCountdown([{ name: 'Bruised', durationDays: 2 }, { name: 'Cut', durationDays: 1 }, { name: 'Cursed', durationDays: null }]);
    expect(rows).toEqual([
      { index: 0, name: 'Bruised', before: 2, after: 1, expires: false },
      { index: 1, name: 'Cut', before: 1, after: 0, expires: true },
    ]);
  });
});
