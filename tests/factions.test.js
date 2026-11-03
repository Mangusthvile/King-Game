// Factions (Stage 6.5): the migration from teams to factions
// (src/data/migrations.js, schema 15 -> 16), the per-faction Day Log text,
// and transfers between factions (src/systems/factions/transfers.js).
import { describe, it, expect } from 'vitest';
import '../src/commands/recordCommands.js';
import { migrateWorld } from '../src/data/migrations.js';
import { createWorld } from '../src/data/schema.js';
import { stanceOf } from '../src/data/factions.js';
import { dayLogText, newEntry } from '../src/data/dayLog.js';
import { transferResources, moveCharacter, transferBuilding } from '../src/systems/factions/transfers.js';

function v15World() {
  return {
    schemaVersion: 15,
    meta: { id: 'w', name: 'Old', currentDay: 8, settings: { markEdited: false, snapshotsKept: 30 } },
    definitions: {
      factions: {},
      teams: { team_ally: { id: 'team_ally', name: 'Ally' }, team_enemy: { id: 'team_enemy', name: 'Enemy' } },
      resourceTypes: {},
    },
    containers: { root: { id: 'root', kind: 'world' } },
    characters: {
      aren: { id: 'aren', name: 'Aren', teamId: 'team_ally', factionId: '' },
      seeker: { id: 'seeker', name: 'Seeker', teamId: 'team_enemy', factionId: '' },
      odd: { id: 'odd', name: 'Odd', teamId: '', factionId: '' },
    },
    buildings: { b: { id: 'b', name: 'Communal Sleeping Hole' } },
    projects: { p: { id: 'p', name: 'Build it' } },
    tasks: {},
    stockpiles: { kingdom: { fruit: 3 }, byLocation: { root: { stone: 2 } } },
    dayLogs: { 8: { id: '8', day: 8, startOfDay: { text: 'SoD' }, entries: [{ id: 'e', kind: 'task', text: 'Task' }] } },
    log: { actions: [{ id: 'a1', day: 8 }], redo: [{ id: 'r' }], snapshots: [] },
  };
}

describe('migration 15 -> 16 (factions)', () => {
  const w = migrateWorld(v15World());

  it('creates the starter factions, Hostile both ways', () => {
    expect(Object.values(w.definitions.factions).map((f) => [f.name, f.type])).toEqual([
      ['Apollyon', 'player'],
      ['Vulture Pack', 'npc'],
      ['Unaligned', 'unaligned'],
    ]);
    expect(stanceOf(w, 'faction_apollyon', 'faction_vulture_pack')).toBe('hostile');
    expect(stanceOf(w, 'faction_vulture_pack', 'faction_apollyon')).toBe('hostile');
    expect(w.definitions.teams).toBeUndefined();
  });

  it('gives characters a faction from their team, with a history line', () => {
    expect(w.characters.aren.factionId).toBe('faction_apollyon');
    expect(w.characters.seeker.factionId).toBe('faction_vulture_pack');
    expect(w.characters.odd.factionId).toBe('faction_unaligned');
    expect(w.characters.aren.factionHistory).toHaveLength(1);
    expect(w.characters.aren).not.toHaveProperty('teamId');
  });

  it('gives everything else to Apollyon and asks for a review', () => {
    expect(w.stockpiles.stockpile_faction_apollyon).toMatchObject({ ownerFactionId: 'faction_apollyon', placeId: '', counts: { fruit: 3 } });
    expect(w.stockpiles.stockpile_at_root).toMatchObject({ ownerFactionId: 'faction_apollyon', placeId: 'root', counts: { stone: 2 } });
    expect(w.buildings.b.ownerFactionId).toBe('faction_apollyon');
    expect(w.projects.p.ownerFactionId).toBe('faction_apollyon');
    expect(w.dayLogs[8].entries[0].factionId).toBe('faction_apollyon');
    expect(w.dayLogs[8].startOfDays).toEqual({ faction_apollyon: { text: 'SoD' } });
    expect(w.meta.settings.factionReview).toBe(true);
  });

  it('puts an undo wall at the end of the old action log', () => {
    expect(w.log.actions.at(-1).dayBoundary).toBe(true);
    expect(w.log.redo).toEqual([]);
  });
});

function twoFactionWorld() {
  const w = createWorld('Test');
  w.definitions.resourceTypes.fruit = { id: 'fruit', name: 'Fruit', tags: ['Food'], customFields: {} };
  w.definitions.resourceTypes.bone = { id: 'bone', name: 'Bone', tags: [], customFields: {} };
  w.stockpiles.a = { id: 'a', name: '', ownerFactionId: 'faction_apollyon', placeId: '', counts: { fruit: 5 } };
  w.stockpiles.v = { id: 'v', name: '', ownerFactionId: 'faction_vulture_pack', placeId: '', counts: { bone: 4 } };
  w.characters.c = { id: 'c', name: 'Aren', factionId: 'faction_apollyon', factionHistory: [{ factionId: 'faction_apollyon', fromDay: 1, toDay: null, reason: '' }] };
  w.buildings.b = { id: 'b', name: 'Hut', ownerFactionId: 'faction_apollyon' };
  return w;
}

describe('transfers between factions', () => {
  it('trades resources both ways and logs it for both factions', () => {
    const w = twoFactionWorld();
    const cmd = transferResources(w, { kind: 'trade', fromStockpileId: 'a', toStockpileId: 'v', resourceTypeId: 'fruit', count: 2, returnResourceTypeId: 'bone', returnCount: 3, note: 'Peace offering' });
    cmd.do(w);
    expect(w.stockpiles.a.counts).toEqual({ fruit: 3, bone: 3 });
    expect(w.stockpiles.v.counts).toEqual({ bone: 1, fruit: 2 });
    const entries = w.dayLogs[1].entries;
    expect(entries.map((e) => e.factionId)).toEqual(['faction_apollyon', 'faction_vulture_pack']);
    expect(entries[0].text).toContain('Apollyon traded 2 Fruit');
    expect(entries[0].text).toContain('for 3 Bone');
    cmd.undo(w);
    expect(w.stockpiles.a.counts).toEqual({ fruit: 5 });
  });

  it('logs a loss for one faction only', () => {
    const w = twoFactionWorld();
    transferResources(w, { kind: 'loss', fromStockpileId: 'a', resourceTypeId: 'fruit', count: 9 }).do(w);
    expect(w.stockpiles.a.counts.fruit).toBe(0);
    expect(w.dayLogs[1].entries).toHaveLength(1);
  });

  it('moves a character and closes their old history line', () => {
    const w = twoFactionWorld();
    w.meta.currentDay = 4;
    moveCharacter(w, 'c', 'faction_vulture_pack', 'Captured').do(w);
    expect(w.characters.c.factionId).toBe('faction_vulture_pack');
    expect(w.characters.c.factionHistory).toEqual([
      { factionId: 'faction_apollyon', fromDay: 1, toDay: 4, reason: '' },
      { factionId: 'faction_vulture_pack', fromDay: 4, toDay: null, reason: 'Captured' },
    ]);
    expect(w.dayLogs[4].entries).toHaveLength(2);
  });

  it('transfers a building', () => {
    const w = twoFactionWorld();
    transferBuilding(w, 'b', 'faction_vulture_pack').do(w);
    expect(w.buildings.b.ownerFactionId).toBe('faction_vulture_pack');
  });
});

describe('Day Log per faction', () => {
  it('copies one faction, or every faction under a heading', () => {
    const w = createWorld('Test');
    w.dayLogs[1] = {
      id: '1',
      day: 1,
      startOfDays: { faction_apollyon: { text: 'Start' } },
      entries: [newEntry('task', 'Mine', { factionId: 'faction_apollyon' }), newEntry('task', 'Theirs', { factionId: 'faction_vulture_pack' }), newEntry('narration', 'Shared')],
    };
    expect(dayLogText(w, 1, 'faction_apollyon')).toBe('Start\n\nMine\n\nShared');
    const all = dayLogText(w, 1);
    expect(all).toContain('######## Apollyon ########\n\nStart\n\nMine');
    expect(all).toContain('######## Vulture Pack ########\n\nTheirs');
    expect(all).toContain('######## Every faction ########\n\nShared');
  });
});
