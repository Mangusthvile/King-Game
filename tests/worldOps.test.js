// New worlds from existing ones (src/data/worldOps.js) and the preview shown
// before restoring (src/data/worldPreview.js).
import { describe, it, expect } from 'vitest';
import '../src/commands/worldCommands.js';
import { checkedWorld } from '../src/data/exportImport.js';
import { duplicateWorld, templateWorld, renameSavedWorld } from '../src/data/worldOps.js';
import { worldPreview } from '../src/data/worldPreview.js';
import { checkAfterMigration } from '../src/data/validate.js';
import { oldSave } from './fixtures/oldSaves.js';

const sample = () => {
  const w = checkedWorld(oldSave(17));
  w.log.snapshots = [{ id: 'snap', kind: 'dayEnd', day: 7, takenAt: '2026-01-01T00:00:00.000Z', label: 'Day 7, before Advance Day', actionCount: 0, world: structuredClone({ ...w, log: undefined }) }];
  return w;
};

describe('duplicate a world', () => {
  const original = sample();
  const copy = duplicateWorld(original);

  it('gets its own id and name, and leaves the original alone', () => {
    expect(copy.meta.id).not.toBe(original.meta.id);
    expect(copy.meta.name).toBe('Old world v17 (copy)');
    expect(original.meta.name).toBe('Old world v17');
    expect(copy.characters).toEqual(original.characters);
  });

  it("changes the snapshots' ids too, so restoring one stays in the copy", () => {
    expect(copy.log.snapshots[0].world.meta.id).toBe(copy.meta.id);
    expect(original.log.snapshots[0].world.meta.id).toBe(original.meta.id);
  });
});

describe('new world from a template', () => {
  const source = sample();
  const w = templateWorld(source, 'What If');

  it("copies the libraries and rules, not the characters, map or history", () => {
    expect(w.definitions.species).toEqual(source.definitions.species);
    expect(w.definitions.buildingTypes).toEqual(source.definitions.buildingTypes);
    expect(Object.keys(w.characters)).toHaveLength(0);
    expect(Object.keys(w.buildings)).toHaveLength(0);
    expect(Object.keys(w.containers)).toHaveLength(1);
    expect(w.log.actions).toHaveLength(0);
    expect(w.meta.currentDay).toBe(1);
  });

  it("gives the template's Apollyon a new First Sky King", () => {
    const bearers = Object.values(w.crownBearers);
    expect(bearers).toHaveLength(1);
    expect(bearers[0].factionId).toBe('faction_apollyon');
    expect(w.crownBearers.bearer_sky).toBeUndefined();
  });

  it('is a complete world', () => {
    expect(checkAfterMigration(w)).toEqual([]);
  });
});

describe('rename a saved world', () => {
  it('goes through the renameWorld command, so it is in the action log', () => {
    const w = renameSavedWorld(sample(), 'Kingdom');
    expect(w.meta.name).toBe('Kingdom');
    expect(w.containers.root.name).toBe('Kingdom');
    expect(w.log.actions.at(-1)).toMatchObject({ type: 'renameWorld', payload: { oldName: 'Old world v17', newName: 'Kingdom' } });
  });
});

describe('restore preview', () => {
  it('says what a world holds', () => {
    const lines = worldPreview(sample());
    expect(lines[0]).toBe('Old world v17, Day 8');
    expect(lines).toContain('1 Region(s), 1 Biome(s), 0 Area(s)');
    expect(lines).toContain('2 living character(s)');
    expect(lines).toContain('1 building(s), 1 Project(s), 0 task(s)');
  });
});
