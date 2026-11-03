// Seed data import plan (src/systems/characters/seedImport.js), on the
// Arbiter's real seed files in references/.
import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/data/schema.js';
import { buildImportPlan } from '../src/systems/characters/seedImport.js';
import bodyFile from '../references/body-types.json';
import charFile from '../references/test-characters.json';

const world = createWorld('Test');
const plan = buildImportPlan(world, bodyFile, charFile);
const byName = (name) => plan.characters.find((p) => p.character.name === name).character;
const entry = (key, name) => plan.entries[key].find((p) => p.name === name)?.entry;

describe('libraries', () => {
  it('adds every seed entry and reuses Baseliner and Vulture', () => {
    expect(plan.entries.bodyTypes.filter((p) => p.status === 'new')).toHaveLength(16);
    expect(plan.entries.skills.filter((p) => p.status === 'new')).toHaveLength(9);
    expect(plan.entries.traits.filter((p) => p.status === 'new')).toHaveLength(6);
    expect(plan.entries.equipment.filter((p) => p.status === 'new')).toHaveLength(13);
    expect(plan.entries.species.filter((p) => p.status !== 'existing')).toHaveLength(0);
  });

  it('flags nothing: every name the characters use is in the seed lists', () => {
    expect(Object.values(plan.entries).flat().filter((p) => p.status === 'created')).toEqual([]);
  });

  it('links Body Types to species and granted Traits', () => {
    const ironScout = entry('bodyTypes', 'Iron Scout');
    expect(ironScout.speciesId).toBe('species_baseliner');
    expect(ironScout.grantsTraitIds).toEqual([entry('traits', 'Weak Danger Premonition').id]);
    expect(entry('bodyTypes', 'Swift Vault').maxLevel).toBeNull();
  });
});

describe('characters', () => {
  it('imports all 10', () => expect(plan.characters.filter((p) => p.include)).toHaveLength(10));

  it('links Aren by name and keeps his stats and manual combat profile', () => {
    const aren = byName('Aren');
    expect(aren.bodyTypeId).toBe(entry('bodyTypes', 'Iron Brute').id);
    expect([aren.bodyTypeLevel, aren.bodyLevel, aren.STR, aren.SPD, aren.TOU]).toEqual([1, 3, 5, 1, 3]);
    expect(aren.skills).toEqual([{ skillId: entry('skills', 'Spear Warrior').id, tier: 'T1', level: 6 }]);
    expect(aren.health).toEqual({ current: 4, max: 4 });
    // Stamina max = Base Stamina 1 + FLOOR((SPD - 1) / 2): SPD 1 gives 1, SPD 8 gives 4.
    expect([aren.staminaRemaining, aren.staminaMax]).toEqual([1, 1]);
    expect([byName('Sena').SPD, byName('Sena').staminaMax, byName('Sena').staminaMaxOverride]).toEqual([8, 4, false]);
    expect(aren.hunger).toEqual({ current: 5, max: 5 });
    expect(aren.combat.attack).toBe('d6 +5');
  });

  it('keeps Doran\'s note and his Wooden Shield', () => {
    const doran = byName('Doran');
    expect(doran.notes).toMatch(/Weak Danger Premonition/);
    expect(doran.armorId).toBe(entry('equipment', 'Wooden Shield').id);
  });

  it('gives Vultures their Mask, Vault Value and Essence notes, and blank Hunger', () => {
    const seeker = byName('Seeker of the Horizon');
    const fields = Object.fromEntries(Object.values(seeker.customFields).map((f) => [f.name, f.value]));
    expect(fields).toEqual({ Mask: 'Mask of the Thrower (T1)', 'Vault Value': 174, 'Essence notes': 'Current Vault Value: 174.' });
    expect(seeker.hunger).toEqual({ current: null, max: null });
    expect(seeker.traits).toEqual([{ traitId: entry('traits', 'Pact of the Continuing Shot').id, note: '' }]);
  });
});

describe('unknown names', () => {
  it('creates and flags a library entry for a name nobody defined', () => {
    const p = buildImportPlan(world, { bodyTypes: [] }, { characters: [{ name: 'X', species: 'Baseliner', skills: [{ name: 'Basket Weaving', tier: 'T1', level: 2 }] }] });
    expect(p.entries.skills[0]).toMatchObject({ name: 'Basket Weaving', status: 'created' });
    expect(p.characters[0].flags[0]).toMatch(/Basket Weaving/);
  });
});
