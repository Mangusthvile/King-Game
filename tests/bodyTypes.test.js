// Body Type lookups (src/rules/bodyTypes.js), checked against the Arbiter's
// Body Types table in references/body-types.json.
import { describe, it, expect } from 'vitest';
import { proposedStats, differencesFromTable, statsOverCeiling, nextBodyLevel } from '../src/rules/bodyTypes.js';
import seed from '../references/body-types.json';

const type = (name) => seed.bodyTypes.find((b) => b.name === name);

describe('proposedStats', () => {
  it('Iron Brute Lv2 is Body Lv 4, STR 7, SPD 1, TOU 4', () => {
    expect(proposedStats(type('Iron Brute'), 2)).toEqual({ bodyLevel: 4, STR: 7, SPD: 1, TOU: 4 });
  });

  it('Advanced Lv3 is Body Lv 4 with 4 / 4 / 4', () => {
    expect(proposedStats(type('Advanced'), 3)).toEqual({ bodyLevel: 4, STR: 4, SPD: 4, TOU: 4 });
  });

  it('has no proposal for a level the table lacks', () => {
    expect(proposedStats(type('Swift'), 2)).toBeNull();
  });
});

describe('differencesFromTable', () => {
  it('lists only what differs', () => {
    const aren = { bodyLevel: 3, STR: 5, SPD: 1, TOU: 3 };
    expect(differencesFromTable(aren, proposedStats(type('Iron Brute'), 1))).toEqual([]);
    expect(differencesFromTable({ ...aren, STR: 6 }, proposedStats(type('Iron Brute'), 1))).toEqual([{ key: 'STR', current: 6, proposed: 5 }]);
  });
});

describe('statsOverCeiling', () => {
  it('warns above the ceiling: Baseliner Brute caps at 4', () => {
    expect(statsOverCeiling({ STR: 5, SPD: 1, TOU: 4 }, type('Brute'))).toEqual(['STR']);
    expect(statsOverCeiling({ STR: 7, SPD: 1, TOU: 4 }, type('Iron Brute'))).toEqual([]);
  });

  it('never warns when no ceiling is set (Vault Body Types)', () => {
    expect(statsOverCeiling({ STR: 99, SPD: 1, TOU: 1 }, type('Malicious Vault'))).toEqual([]);
  });
});

describe('nextBodyLevel', () => {
  it('stops at maxLevel', () => {
    expect(nextBodyLevel(type('Iron Brute'), 1)).toEqual({ level: 2, row: type('Iron Brute').levels[1] });
    expect(nextBodyLevel(type('Iron Brute'), 2)).toBeNull();
  });

  it('keeps going when the max level is not yet established, even past the table', () => {
    expect(nextBodyLevel(type('Swift Vault'), 3)).toEqual({ level: 4, row: null });
  });
});
