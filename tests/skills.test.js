// Theories and Skill Tiers (src/rules/skills.js), using the RULES.md
// examples: Theory of Fire at 100% became the T1 Skill Firestarter Lv1;
// T1 to T2 combines 5 related Theories at 100%; T2 to T3 combines 5 T1
// Skills; the Level bonus is +0 at Lv1 up to +9 at Lv10.
import { describe, it, expect } from 'vitest';
import { isTheoryComplete, tierNumber, tierUpSource, tierUpCandidates, convertTheoryToSkill, tierUpSkill, skillBonus, COMBINE_COUNT } from '../src/rules/skills.js';

const theory = (name, percent) => ({ name, percent });
const skill = (skillId, tier, level = 1) => ({ skillId, tier, level });

describe('Skill Bonus', () => {
  it('is Level - 1: +0 at Lv1, +5 at Lv6, +9 at Lv10', () => {
    expect(skillBonus(1)).toBe(0);
    expect(skillBonus(6)).toBe(5);
    expect(skillBonus(10)).toBe(9);
  });
});

describe('Theory to T1 Skill', () => {
  it('a Theory is complete at 100%', () => {
    expect(isTheoryComplete(theory('Theory of Fire', 100))).toBe(true);
    expect(isTheoryComplete(theory('Theory of Fire', 99))).toBe(false);
  });

  it('Theory of Fire at 100% becomes Firestarter, T1 Lv1', () => {
    const result = convertTheoryToSkill([theory('Theory of Fire', 100), theory('Theory of Combat', 5)], [], 0, { skillId: 'firestarter' });
    expect(result.skills).toEqual([skill('firestarter', 'T1', 1)]);
    expect(result.theories).toEqual([theory('Theory of Combat', 5)]);
  });

  it('can keep the Theory if the Arbiter chooses', () => {
    const result = convertTheoryToSkill([theory('Theory of Fire', 100)], [], 0, { skillId: 'x' }, false);
    expect(result.theories).toHaveLength(1);
  });
});

describe('Tier up', () => {
  it('needs 5 items', () => expect(COMBINE_COUNT).toBe(5));

  it('reads tier labels; special tiers have no number', () => {
    expect(tierNumber('T3')).toBe(3);
    expect(tierNumber('Inner Monster')).toBeNull();
  });

  it('T1 combines Theories, T2 combines T1 Skills, T5 and special tiers are the top', () => {
    expect(tierUpSource('T1')).toEqual({ kind: 'theory', tier: undefined });
    expect(tierUpSource('T2')).toEqual({ kind: 'skill', tier: 1 });
    expect(tierUpSource('T4')).toEqual({ kind: 'skill', tier: 3 });
    expect(tierUpSource('T5')).toBeNull();
    expect(tierUpSource('Inner Monster')).toBeNull();
  });

  it('offers only 100% Theories for a T1 Skill', () => {
    const theories = [theory('A', 100), theory('B', 40), theory('C', 100)];
    expect(tierUpCandidates(theories, [skill('s', 'T1')], 0).map((c) => c.item.name)).toEqual(['A', 'C']);
  });

  it('offers T1 Skills (not itself) for a T2 Skill', () => {
    const skills = [skill('big', 'T2'), skill('a', 'T1'), skill('b', 'T2'), skill('c', 'T1'), skill('m', 'Inner Monster')];
    expect(tierUpCandidates([], skills, 0).map((c) => c.item.skillId)).toEqual(['a', 'c']);
  });

  it('raises the Tier and keeps the Level and the items by default', () => {
    const theories = [1, 2, 3, 4, 5].map((n) => theory(`T${n}`, 100));
    const picks = theories.map((_, index) => ({ kind: 'theory', index }));
    const result = tierUpSkill(theories, [skill('fire', 'T1', 4)], 0, picks);
    expect(result.skills).toEqual([skill('fire', 'T2', 4)]);
    expect(result.theories).toHaveLength(5);
  });

  it('removes the combined items when asked', () => {
    const skills = [skill('big', 'T2'), skill('a', 'T1'), skill('b', 'T1'), skill('keep', 'T3')];
    const result = tierUpSkill([], skills, 0, [{ kind: 'skill', index: 1 }, { kind: 'skill', index: 2 }], true);
    expect(result.skills).toEqual([skill('big', 'T3'), skill('keep', 'T3')]);
  });
});
