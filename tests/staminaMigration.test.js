// Migration 10 -> 11 (src/data/migrations.js): the daily Speed value moves
// into Stamina; SPD, the combat stat, is left alone.
import { describe, it, expect } from 'vitest';
import { migrateWorld } from '../src/data/migrations.js';

function v10World() {
  return {
    schemaVersion: 10,
    meta: {},
    definitions: { species: { b: { id: 'b', name: 'Baseliner' }, v: { id: 'v', name: 'Vulture' } } },
    characters: {
      aren: { id: 'aren', speciesId: 'b', SPD: 1, speedRemaining: 1 },
      sena: { id: 'sena', speciesId: 'b', SPD: 8, speedRemaining: 8 },
      seeker: { id: 'seeker', speciesId: 'v', SPD: 5, speedRemaining: 3 },
    },
  };
}

describe('migration 10 -> 11 (Stamina)', () => {
  const w = migrateWorld(v10World());

  it('gives Baseliner a Base Stamina of 1 and leaves other species unset', () => {
    expect(w.definitions.species.b.baseStamina).toBe(1);
    expect(w.definitions.species.v.baseStamina).toBeNull();
  });

  it('copies the daily Speed value into Stamina remaining and keeps SPD', () => {
    expect(w.characters.sena).toMatchObject({ id: 'sena', speciesId: 'b', SPD: 8, staminaRemaining: 8, staminaMax: 1 });
    expect(w.characters.sena).not.toHaveProperty('speedRemaining');
  });

  it('uses the copied value as Stamina max when the species has no default', () => {
    expect(w.characters.seeker.staminaMax).toBe(3);
  });
});
