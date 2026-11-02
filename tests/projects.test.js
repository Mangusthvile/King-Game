// Project Resolution Method (src/rules/projects.js), from RULES.md.
import { describe, it, expect } from 'vitest';
import {
  PROJECT_SIZES,
  workDieForTier,
  levelBonus,
  eventForRoll,
  participantWork,
  totalWork,
  workloadAfter,
  buildingProgress,
  isWorkloadReached,
} from '../src/rules/projects.js';
import { rollDie, rollDice, isValidRoll } from '../src/rules/dice.js';

describe('Project Sizes', () => {
  it('match the RULES.md table', () => {
    expect(PROJECT_SIZES.map((s) => [s.name, s.workload])).toEqual([
      ['Minor', 25],
      ['Small', 50],
      ['Moderate', 100],
      ['Large', 250],
      ['Major', 500],
      ['Grand', 1000],
      ['Monumental', 2500],
    ]);
    expect(PROJECT_SIZES.at(-1).orMore).toBe(true);
  });
});

describe('Work Die by relevant Skill Tier', () => {
  it('None d4, T1 d6, T2 d8, T3 d10, T4 d12, T5 d20', () => {
    expect(workDieForTier('')).toBe(4);
    expect(workDieForTier(null)).toBe(4);
    expect(['T1', 'T2', 'T3', 'T4', 'T5'].map(workDieForTier)).toEqual([6, 8, 10, 12, 20]);
  });

  it('has no die for a special tier (the Arbiter picks)', () => {
    expect(workDieForTier('Inner Monster')).toBeNull();
  });
});

describe('Level bonus on every Work Die', () => {
  it('Lv1 adds nothing, then +1 per Level, up to +9', () => {
    expect(levelBonus(1)).toBe(0);
    expect(levelBonus(5)).toBe(4);
    expect(levelBonus(10)).toBe(9);
    expect(levelBonus(14)).toBe(9);
    expect(levelBonus(null)).toBe(0);
  });
});

describe('Project Event (d20)', () => {
  const name = (roll) => eventForRoll(roll)?.name;
  it('1 Catastrophe, 2-5 Setback, 6-15 Nothing Unusual, 16-19 Boon, 20 Breakthrough', () => {
    expect(name(1)).toBe('Catastrophe');
    expect([2, 5].map(name)).toEqual(['Setback', 'Setback']);
    expect([6, 15].map(name)).toEqual(['Nothing Unusual', 'Nothing Unusual']);
    expect([16, 19].map(name)).toEqual(['Boon', 'Boon']);
    expect(name(20)).toBe('Breakthrough');
    expect(eventForRoll(0)).toBeNull();
    expect(eventForRoll(21)).toBeNull();
  });
});

describe('Work totals', () => {
  it('adds the Level bonus to every die', () => {
    // 4 Stamina, T1 Skill at Lv3: 4d6 +2 each. Rolls (5)(1)(6)(4) = 16, +8.
    expect(participantWork({ rolls: [5, 1, 6, 4], bonus: 2 })).toBe(24);
  });

  it('adds the tool bonus once to the work of the day, after the Level bonus on each die', () => {
    // 2d6 at Lv3 (+2 each) with a tool worth +3: (3+2)(3+2) + 3 = 13.
    expect(participantWork({ rolls: [3, 3], bonus: 2, toolBonus: 3 })).toBe(13);
  });

  it('waits until every die has a result', () => {
    expect(participantWork({ rolls: [3, null] })).toBeNull();
    expect(totalWork([{ rolls: [2] }, { rolls: [null] }])).toBeNull();
  });

  it('sums the whole workday', () => {
    expect(totalWork([{ rolls: [5, 1, 6, 4], bonus: 2 }, { rolls: [3], bonus: 0 }])).toBe(27);
  });

  it('applies the Event change and never goes below 0', () => {
    expect(workloadAfter(30, 27)).toBe(57);
    expect(workloadAfter(30, 27, -10)).toBe(47);
    expect(workloadAfter(5, 0, -10)).toBe(0);
  });
});

describe('Linked building progress', () => {
  it('is current / required as a percent, 0 to 100', () => {
    expect(buildingProgress(30, 75)).toBe(40);
    expect(buildingProgress(80, 75)).toBe(100);
    expect(buildingProgress(10, 0)).toBe(0);
  });

  it('knows when the Workload is reached', () => {
    expect(isWorkloadReached(75, 75)).toBe(true);
    expect(isWorkloadReached(74, 75)).toBe(false);
  });
});

describe('Dice', () => {
  it('rolls 1 to sides', () => {
    expect(rollDie(6, () => 0)).toBe(1);
    expect(rollDie(6, () => 0.9999)).toBe(6);
    expect(rollDice(3, 4, () => 0.5)).toEqual([3, 3, 3]);
  });

  it('validates typed-in results', () => {
    expect(isValidRoll(6, 6)).toBe(true);
    expect(isValidRoll(7, 6)).toBe(false);
    expect(isValidRoll(0, 6)).toBe(false);
    expect(isValidRoll(2.5, 6)).toBe(false);
  });
});
