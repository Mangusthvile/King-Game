// Stamina max (src/rules/stamina.js), from RULES.md:
//   Stamina = Species Base Stamina + FLOOR((SPD - 1) / 2)
// Baseliner examples: SPD 1-2 = 1, SPD 3-4 = 2, SPD 5-6 = 3, SPD 7-8 = 4.
import { describe, it, expect } from 'vitest';
import { staminaFormula, staminaBreakdown } from '../src/rules/stamina.js';

describe('Stamina formula (Base Stamina 1, a Baseliner)', () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [8, 4],
    [13, 7],
  ])('SPD %i gives %i Stamina', (SPD, stamina) => {
    expect(staminaFormula(1, SPD)).toBe(stamina);
  });

  it('adds the species Base Stamina', () => {
    expect(staminaFormula(3, 4)).toBe(4);
  });

  it('is not worked out without a Base Stamina or SPD', () => {
    expect(staminaFormula(null, 4)).toBeNull();
    expect(staminaFormula(1, null)).toBeNull();
  });

  it('shows its breakdown', () => {
    expect(staminaBreakdown(1, 4).text).toBe('1 base + 1 from SPD 4 = 2');
  });
});

describe('migration 12 -> 13 (Base Stamina)', async () => {
  const { migrateWorld } = await import('../src/data/migrations.js');
  const w = migrateWorld({
    schemaVersion: 12,
    meta: {},
    definitions: { species: { b: { id: 'b', name: 'Baseliner', staminaDefault: 1 } } },
    characters: { sena: { id: 'sena', speciesId: 'b', SPD: 8, staminaMax: 1, staminaRemaining: 1 } },
    log: {
      actions: [{ type: 'batch', payload: { label: 'x', commands: [{ type: 'setField', payload: { path: 'definitions.species', id: 'b', field: 'staminaDefault', oldValue: null, newValue: 1 } }] } }],
      redo: [],
    },
  });

  it('turns the species default Stamina into Base Stamina', () => {
    expect(w.definitions.species.b).toEqual({ id: 'b', name: 'Baseliner', baseStamina: 1 });
  });

  it('starts without an override (then 13 -> 14 applies the formula: SPD 8 gives 4)', () => {
    expect(w.characters.sena).toMatchObject({ staminaMax: 4, staminaMaxOverride: false });
  });

  it('renames the field in old undo entries', () => {
    expect(w.log.actions[0].payload.commands[0].payload.field).toBe('baseStamina');
  });
});

describe('migration 13 -> 14 (apply the formula once)', async () => {
  const { migrateWorld } = await import('../src/data/migrations.js');
  const character = (id, speciesId, SPD, staminaRemaining, staminaMax, staminaMaxOverride = false) => ({ id, speciesId, SPD, staminaRemaining, staminaMax, staminaMaxOverride });
  const w = migrateWorld({
    schemaVersion: 13,
    meta: {},
    definitions: { species: { b: { id: 'b', name: 'Baseliner', baseStamina: 1 }, v: { id: 'v', name: 'Vulture', baseStamina: null } } },
    characters: {
      // As in the Arbiter's roster: remaining copied from the old daily Speed.
      sena: character('sena', 'b', 8, 7, 1),
      aren: character('aren', 'b', 1, 1, 1),
      tired: character('tired', 'b', 5, 1, 1),
      custom: character('custom', 'b', 5, 5, 5, true),
      seeker: character('seeker', 'v', 5, 3, 3),
    },
  });
  const stamina = (id) => [w.characters[id].staminaRemaining, w.characters[id].staminaMax];

  it('sets Stamina max from the formula and caps Stamina remaining', () => {
    expect(stamina('sena')).toEqual([4, 4]);
    expect(stamina('aren')).toEqual([1, 1]);
  });

  it('keeps a lower Stamina remaining (already spent today)', () => {
    expect(stamina('tired')).toEqual([1, 3]);
  });

  it('leaves overridden characters and species without a Base Stamina alone', () => {
    expect(stamina('custom')).toEqual([5, 5]);
    expect(stamina('seeker')).toEqual([3, 3]);
  });
});
