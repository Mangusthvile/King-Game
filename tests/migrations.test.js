// Every earlier schemaVersion loads correctly (Stage 7, data safety): an
// old save from each version (tests/fixtures/oldSaves.js) is checked and
// upgraded, passes the checks a current world must pass, and keeps its data.
import { describe, it, expect } from 'vitest';
import { migrateWorld } from '../src/data/migrations.js';
import { SCHEMA_VERSION, defaultArbiterOnlyFields } from '../src/data/schema.js';
import { checkedWorld } from '../src/data/exportImport.js';
import { checkAfterMigration, checkBeforeMigration, WorldFileError } from '../src/data/validate.js';
import { oldSave } from './fixtures/oldSaves.js';

const versions = Array.from({ length: SCHEMA_VERSION - 1 }, (_, i) => i + 1);

describe.each(versions)('a save from schema version %i', (v) => {
  const raw = oldSave(v);
  const w = checkedWorld(raw);
  const byName = (name) => Object.values(w.containers).find((c) => c.name === name);
  const factionOf = (id) => w.definitions.factions[w.characters[id].factionId]?.name;

  it('passes the checks before and after upgrading', () => {
    expect(checkBeforeMigration(raw)).toEqual([]);
    expect(w.schemaVersion).toBe(SCHEMA_VERSION);
    expect(checkAfterMigration(w)).toEqual([]);
  });

  it('does not change the save it was given', () => {
    expect(raw.schemaVersion).toBe(v);
  });

  it('keeps its map: the Region, its Biome and the marker', () => {
    expect(w.meta.name).toBe(`Old world v${v}`);
    expect(w.meta.currentDay).toBe(8);
    const kie = byName("Kie's Grove");
    const jade = byName('Jade Garden');
    expect(kie.kind).toBe('region');
    expect(jade).toMatchObject({ kind: 'biome', parentId: kie.id, mapScale: 8 });
    expect(w.placedObjects.obj_jade.kind).toBe('biome');
    expect(w.placedObjects.obj_marker.label).toBe('Tower of Apocalypse');
    expect(w.containers.root.tiles['0,0']).toBe('tile_grass');
  });

  it('keeps its action log', () => {
    expect(w.log.actions.map((a) => a.id)).toEqual(['action_1']);
  });

  it('has the Player View settings with nothing set by hand yet', () => {
    expect(w.fieldVisibility).toEqual({});
    expect(w.meta.settings.arbiterOnlyFields).toEqual(defaultArbiterOnlyFields());
  });

  it('keeps discovery: places and resources found before discovery existed count as found', () => {
    expect(byName('Jade Garden').discovered).toBe(v < 7);
    if (v >= 4) expect(byName('Jade Garden').resources[0].known).toBe(v < 7);
  });

  it.runIf(v >= 6)('keeps the building, owned by Apollyon', () => {
    expect(w.buildings.building_hole).toMatchObject({ name: 'Communal Sleeping Hole', constructionProgress: 40, ownerFactionId: 'faction_apollyon' });
  });

  it.runIf(v >= 9)('keeps the characters, in their factions', () => {
    expect(Object.keys(w.characters)).toEqual(['char_king', 'char_seeker']);
    expect(factionOf('char_king')).toBe('Apollyon');
    expect(factionOf('char_seeker')).toBe('Vulture Pack');
    expect(w.characters.char_king.notes).toBe('Secret notes');
    expect(w.characters.char_king).not.toHaveProperty('teamId');
    expect(w.characters.char_king).not.toHaveProperty('speedRemaining');
  });

  it.runIf(v >= 9)('has Stamina from the formula for saves from before it (and keeps later values)', () => {
    // King: Baseliner, SPD 4 -> 1 + FLOOR(3 / 2) = 2. Saves from v14 on
    // already had the formula, so their stored value is kept.
    expect(w.characters.char_king.staminaMax).toBe(v < 14 ? 2 : 4);
    expect(w.definitions.species.species_baseliner.baseStamina).toBe(1);
  });

  it.runIf(v >= 12)('keeps the Project and the Day Log', () => {
    expect(w.projects.proj_hole).toMatchObject({ workloadCurrent: 30, workloadRequired: 75, ownerFactionId: 'faction_apollyon' });
    expect(w.dayLogs[8].entries[0]).toMatchObject({ text: 'Day 8 project roll', factionId: 'faction_apollyon' });
  });

  it.runIf(v >= 15)("keeps the stockpiles as Apollyon's", () => {
    const piles = Object.values(w.stockpiles);
    expect(piles.find((s) => s.placeId === '')).toMatchObject({ ownerFactionId: 'faction_apollyon', counts: { res_puff: 12 } });
    expect(piles.find((s) => s.placeId === 'jade').counts).toEqual({ res_puff: 3 });
  });

  it('has a Crown Bearer for Apollyon with a connected player', () => {
    const bearers = Object.values(w.crownBearers);
    expect(bearers).toHaveLength(1);
    const links = Object.values(w.players).flatMap((p) => p.connections);
    expect(links[0].crownBearerId).toBe(bearers[0].id);
    expect(links[0].connectivity).toBe(v >= 17 ? 8 : 9);
  });
});

describe('import checks', () => {
  const problemsOf = (raw) => {
    try {
      checkedWorld(raw);
      return [];
    } catch (err) {
      expect(err).toBeInstanceOf(WorldFileError);
      return err.problems;
    }
  };

  it('says when a file is not a world at all', () => {
    expect(problemsOf([1, 2])).toEqual(['The file is not a world (it holds no JSON object).']);
    expect(problemsOf({ hello: 'there' }).join(' ')).toMatch(/no schemaVersion/);
  });

  it('says when a world is from a newer app', () => {
    expect(problemsOf({ ...oldSave(17), schemaVersion: SCHEMA_VERSION + 1 }).join(' ')).toMatch(/newer version of the app/);
  });

  it('lists every missing part', () => {
    const raw = oldSave(17);
    delete raw.meta.name;
    delete raw.containers;
    const problems = problemsOf(raw);
    expect(problems).toContain('meta.name (the world name) is missing.');
    expect(problems).toContain('The "containers" section is missing.');
  });

  it('finds damage that only shows after upgrading', () => {
    const raw = oldSave(17);
    raw.containers.jade.parentId = 'gone';
    expect(problemsOf(raw)).toEqual(['Jade Garden belongs to a place that does not exist.']);
  });

  it('drops the world file sync block', () => {
    const w = checkedWorld({ ...oldSave(17), sync: { revision: 4 } });
    expect(w).not.toHaveProperty('sync');
  });

  it('migrateWorld still refuses a version with no migration', () => {
    expect(() => migrateWorld({ schemaVersion: 0 })).toThrow(/No migration/);
  });
});
