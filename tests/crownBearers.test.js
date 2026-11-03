// Crown Bearers (Stage 6.6): the Connectivity table against RULES.md, the
// migration to schema 17, Change vessel, a vessel's death, and Connectivity
// history (src/systems/crownBearers/crownModel.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import '../src/commands/recordCommands.js';
import { migrateWorld } from '../src/data/migrations.js';
import { createWorld } from '../src/data/schema.js';
import { parseConnectivitySection, defaultConnectivity, connectivityLevel, clampConnectivity } from '../src/rules/connectivity.js';
import { factionConnectivity } from '../src/data/crownBearers.js';
import { changeVessel, vesselDeathCommands, setConnectivity, crownLocationText } from '../src/systems/crownBearers/crownModel.js';
import { markDead } from '../src/systems/characters/death.js';
import '../src/systems/crownBearers/index.js'; // registers the death hook

describe('Connectivity table', () => {
  it('matches RULES.md word for word', () => {
    const fromRules = parseConnectivitySection(readFileSync('RULES.md', 'utf8'));
    expect(fromRules).toHaveLength(10);
    expect(defaultConnectivity().levels.map(({ level, description }) => ({ level, description }))).toEqual(fromRules);
  });

  it('gives each level its reminder and keeps levels within 1 to 10', () => {
    expect(connectivityLevel(null, 5).description).toContain('They cannot use the Spark of Change.');
    expect(clampConnectivity(12)).toBe(10);
    expect(clampConnectivity(0)).toBe(1);
    expect(clampConnectivity('')).toBeNull();
  });
});

const bearerOf = (w) => Object.values(w.crownBearers)[0];

describe('migration 16 -> 17 (Crown Bearers)', () => {
  const old = createWorld('Old');
  delete old.crownBearers;
  delete old.crowns;
  delete old.definitions.connectivity;
  old.schemaVersion = 16;
  old.definitions.factions.faction_apollyon.authorityLevel = 2;
  const w = migrateWorld(old);

  it('creates the First Sky King for Apollyon with the Crown of Authority and no vessel', () => {
    const b = bearerOf(w);
    expect(b).toMatchObject({ name: 'First Sky King', factionId: 'faction_apollyon', vesselId: '', status: 'withoutVessel', authorityLevel: 2 });
    expect(w.crowns[b.crownId]).toMatchObject({ name: 'Crown of Authority', attunedBearerId: b.id, location: { kind: 'vessel' } });
    expect(w.definitions.connectivity.levels).toHaveLength(10);
  });

  it('connects a player to it at Connectivity 9', () => {
    const links = factionConnectivity(w, 'faction_apollyon');
    expect(links).toHaveLength(1);
    expect(links[0].level).toBe(9);
    expect(links[0].player.factionIds).toEqual(['faction_apollyon']);
  });
});

function worldWithVessel() {
  const w = createWorld('Test');
  w.meta.currentDay = 5;
  w.characters.aren = { id: 'aren', name: 'Aren', alive: true, containers: [] };
  w.characters.sena = { id: 'sena', name: 'Sena', alive: true };
  changeVessel(w, bearerOf(w), 'aren').do(w);
  return w;
}

describe('vessels', () => {
  it('Change vessel closes the old line and opens a new one', () => {
    const w = worldWithVessel();
    const b = bearerOf(w);
    expect(b).toMatchObject({ vesselId: 'aren', status: 'inVessel' });
    w.meta.currentDay = 7;
    const cmd = changeVessel(w, b, 'sena', 'Gave up the Crown');
    cmd.do(w);
    expect(b.vesselHistory).toEqual([
      { characterId: 'aren', name: 'Aren', fromDay: 5, toDay: 7, ended: 'Gave up the Crown' },
      { characterId: 'sena', name: 'Sena', fromDay: 7, toDay: null, ended: '' },
    ]);
    cmd.undo(w);
    expect(b.vesselId).toBe('aren');
  });

  it("a vessel's death leaves the Crown Bearer without a vessel, in the same undo step", () => {
    const w = worldWithVessel();
    const b = bearerOf(w);
    const cmd = markDead(w, w.characters.aren, 'Fell', 6);
    cmd.do(w);
    expect(b).toMatchObject({ vesselId: '', status: 'withoutVessel' });
    expect(b.vesselHistory[0]).toMatchObject({ toDay: 6, ended: 'Died: Fell' });
    expect(crownLocationText(w, w.crowns[b.crownId])).toBe('Worn by the vessel (no vessel now)');
    cmd.undo(w);
    expect(b).toMatchObject({ vesselId: 'aren', status: 'inVessel' });
  });

  it('only touches the Crown Bearers of that vessel', () => {
    const w = worldWithVessel();
    expect(vesselDeathCommands(w, w.characters.sena, '', 6)).toEqual([]);
  });
});

describe('Connectivity history', () => {
  it('records the day, old level, new level and reason', () => {
    const w = createWorld('Test');
    w.meta.currentDay = 3;
    const player = Object.values(w.players)[0];
    setConnectivity(w, player, 0, 7, 'Refused an order').do(w);
    expect(player.connections[0].connectivity).toBe(7);
    expect(player.connections[0].history).toEqual([{ day: 3, oldLevel: 9, newLevel: 7, reason: 'Refused an order' }]);
  });
});
