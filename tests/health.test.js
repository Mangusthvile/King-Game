// Health max formula (src/rules/health.js), checked against the Arbiter's
// test characters in references/test-characters.json, whose Health values
// come from the same formula in the Combat Profiles sheet.
import { describe, it, expect } from 'vitest';
import { healthFormula } from '../src/rules/health.js';
import seed from '../references/test-characters.json';

describe('healthFormula', () => {
  it('rounds up: Aren, Body Lv 3 + STR 5 + TOU 3 = 11 / 3 -> 4', () => {
    expect(healthFormula(3, 5, 3)).toBe(4);
  });

  it('is at least 1', () => {
    expect(healthFormula(0, 0, 0)).toBe(1);
  });

  it('needs all three stats', () => {
    expect(healthFormula(null, 1, 1)).toBeNull();
  });

  it.each(seed.characters.map((c) => [c.name, c]))('matches the sheet for %s', (name, c) => {
    expect(healthFormula(c.bodyLevel, c.STR, c.TOU)).toBe(c.health);
  });
});
