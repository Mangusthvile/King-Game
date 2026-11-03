// The Advance Day proposal and command (src/systems/time/advancePlan.js),
// per faction: the meal from the faction's own stockpiles, Hunger, Hungry,
// condition countdown, Stamina, a "Day N ended" entry per faction, and
// undo of the whole step.
import { describe, it, expect } from 'vitest';
import '../src/commands/recordCommands.js';
import { createWorld } from '../src/data/schema.js';
import { createPlan, resolvePlan, buildAdvance } from '../src/systems/time/advancePlan.js';

const APOLLYON = 'faction_apollyon';
const VULTURES = 'faction_vulture_pack';

function testWorld() {
  const w = createWorld('Test');
  w.meta.currentDay = 8;
  w.definitions.resourceTypes.fruit = { id: 'fruit', name: 'Metal Dragon Fruit', tags: ['Food'], foodValue: 3, customFields: {} };
  w.stockpiles.mine = { id: 'mine', name: '', ownerFactionId: APOLLYON, placeId: '', counts: { fruit: 1 }, notes: '', customFields: {} };
  w.stockpiles.theirs = { id: 'theirs', name: '', ownerFactionId: VULTURES, placeId: '', counts: { fruit: 5 }, notes: '', customFields: {} };
  const base = { alive: true, factionId: APOLLYON, staminaMax: 2, staminaRemaining: 0, hunger: { current: 3, max: 5 }, thirst: { current: 2, max: 3 }, conditions: [] };
  w.characters.a = { ...base, id: 'a', name: 'Aren', conditions: [{ name: 'Bruised', durationDays: 1 }] };
  w.characters.b = { ...base, id: 'b', name: 'Obito', hunger: { current: 1, max: 5 } };
  w.characters.v = { ...base, id: 'v', name: 'Seeker', factionId: VULTURES, conditions: [{ name: 'Cut', durationDays: 2 }] };
  w.characters.d = { ...base, id: 'd', name: 'Dead', alive: false };
  return w;
}

describe('Advance Day per faction', () => {
  const w = testWorld();
  const plan = createPlan(w);
  plan.eaters.b = false; // only 3 Food: Obito goes without
  plan.thirst.a = 'drank';
  const resolved = resolvePlan(w, plan);
  const group = (id) => resolved.groups.find((g) => g.factionId === id);

  it('feeds a faction that tracks needs from its own stockpiles only', () => {
    expect(resolved.groups.map((g) => g.name)).toEqual(['Apollyon', 'Vulture Pack']);
    const apollyon = group(APOLLYON);
    expect(apollyon.living.map((c) => c.name)).toEqual(['Aren', 'Obito']);
    expect(apollyon.meal).toHaveLength(1);
    expect(apollyon.meal[0]).toMatchObject({ stockpileId: 'mine', eat: 1 });
    expect(apollyon.unfed.map((c) => c.name)).toEqual(['Obito']);
  });

  it('skips the meal and needs of a faction that does not track them', () => {
    const vultures = group(VULTURES);
    expect(vultures.settings.trackNeeds).toBe(false);
    expect(vultures.meal).toEqual([]);
    expect(vultures.rows[0].hunger.after).toBe(3);
  });

  it('applies everything as one step, with a log entry per faction', () => {
    const command = buildAdvance(w, plan, resolved);
    expect(command.dayBoundary).toBe(true);
    command.do(w);
    expect(w.meta.currentDay).toBe(9);
    expect(w.stockpiles.mine.counts.fruit).toBe(0);
    expect(w.stockpiles.theirs.counts.fruit).toBe(5);
    expect(w.characters.a.hunger.current).toBe(5);
    expect(w.characters.a.thirst.current).toBe(3);
    expect(w.characters.a.conditions).toEqual([]); // Bruised ran out
    expect(w.characters.b.hunger.current).toBe(0); // flagged, still alive
    expect(w.characters.b.alive).toBe(true);
    expect(w.characters.b.conditions[0]).toMatchObject({ name: 'Hungry', daysWithoutFood: 1 });
    expect(w.characters.v.conditions[0].durationDays).toBe(1); // conditions count down in every faction
    expect(w.characters.v.staminaRemaining).toBe(2); // Vulture Pack uses Stamina
    expect(w.characters.d.staminaRemaining).toBe(0); // the dead are left alone
    const entries = w.dayLogs['8'].entries;
    expect(entries.map((e) => [e.kind, e.factionId])).toEqual([
      ['dayEnd', APOLLYON],
      ['dayEnd', VULTURES],
    ]);
    expect(entries[0].text).toContain('Day 8 Ended: Apollyon\n====='); // the heading keeps its line break
    expect(entries[0].text).toContain('Obito: Hunger 1 -> 0, Hungry (1 day without food) - at risk of death');

    command.undo(w);
    expect(w.meta.currentDay).toBe(8);
    expect(w.stockpiles.mine.counts.fruit).toBe(1);
    expect(w.characters.b.hunger.current).toBe(1);
    expect(w.characters.a.conditions).toEqual([{ name: 'Bruised', durationDays: 1 }]);
    expect(w.dayLogs['8']).toBeUndefined();
  });

  it('does not reset Stamina for a faction that does not use it', () => {
    const w2 = testWorld();
    w2.definitions.factions[VULTURES].usesStamina = false;
    const r = resolvePlan(w2, createPlan(w2));
    expect(r.rows.find((row) => row.c.id === 'v').stamina.after).toBe(0);
  });
});
