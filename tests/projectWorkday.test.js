// A whole Project workday: the draft, the Resolution Log, Accept as one
// undoable command, and migration 11 -> 12. Uses the current campaign's
// Communal Sleeping Hole (30 of 75 Workload) as the example.
import { describe, it, expect } from 'vitest';
import { migrateWorld } from '../src/data/migrations.js';
import { createWorld, createContainer } from '../src/data/schema.js';
import { createCommand } from '../src/commands/registry.js';
import '../src/commands/recordCommands.js';
import { createProject } from '../src/systems/projects/projectModel.js';
import { newParticipant, resolveDraft, typeRoll, typeEventRoll, newDraft } from '../src/systems/projects/workdayDraft.js';
import { workdayLogText, workdayLogScript, WORKDAY_STOPS } from '../src/systems/projects/workdayLog.js';
import { acceptWorkday, acceptBlocker } from '../src/systems/projects/workdayAccept.js';
import { dayEntries } from '../src/data/dayLog.js';

function testWorld() {
  const world = createWorld('Test');
  world.meta.currentDay = 8;
  const biome = { ...createContainer({ kind: 'biome', parentId: world.meta.rootContainerId, name: 'Jade Garden' }), dangerLevel: 'Low' };
  const area = createContainer({ kind: 'area', parentId: biome.id, name: 'Building Site' });
  world.containers[biome.id] = biome;
  world.containers[area.id] = area;
  world.definitions.skills.digger = { id: 'digger', name: 'Digger', tier: 'T1' };
  world.characters.king = { id: 'king', name: 'King', alive: true, staminaRemaining: 4, staminaMax: 4, skills: [{ skillId: 'digger', tier: 'T1', level: 3 }], conditions: [], assignmentProjectId: '' };
  world.characters.kie = { id: 'kie', name: 'Kie', alive: true, staminaRemaining: 1, staminaMax: 1, skills: [], conditions: [], assignmentProjectId: '' };
  world.buildings.hole = { id: 'hole', name: 'Communal Sleeping Hole', projectId: '', constructionProgress: 40, forcedStage: '', buildingTypeId: '' };
  const project = { ...createProject(world, { name: 'Communal Sleeping Hole', sizeLabel: 'Small', workloadRequired: 75 }), workloadCurrent: 30, siteBuildingId: 'hole', locationContainerId: area.id };
  world.projects[project.id] = project;
  return { world, project };
}

// King: 4 Stamina, Digger T1 Lv3 -> 4d6 +2 each. Kie: 1 Stamina, no Skill -> 1d4.
function rolledDraft(world, project) {
  const draft = newDraft(world, project);
  const king = { ...newParticipant('king', 4), skillId: 'digger' };
  const kie = newParticipant('kie', 1);
  draft.participants = [king, kie];
  [5, 1, 6, 4].forEach((n, i) => typeRoll(world, king, i, n));
  typeRoll(world, kie, 0, 3);
  typeEventRoll(draft, 17);
  return draft;
}

describe('Project workday', () => {
  it('works out the dice, total, Event and new Workload', () => {
    const { world, project } = testWorld();
    const r = resolveDraft(world, rolledDraft(world, project));
    expect(r.people.map((p) => [p.die, p.bonus, p.work])).toEqual([
      [6, 2, 24],
      [4, 0, 3],
    ]);
    expect(r.total).toBe(27);
    expect(r.event.name).toBe('Boon');
    expect(r.after).toBe(57);
  });

  it('writes the Resolution Log with Stamina wording and every roll', () => {
    const { world, project } = testWorld();
    const draft = rolledDraft(world, project);
    const log = workdayLogText(world, draft, resolveDraft(world, draft));
    expect(log).toContain('Current Workload: 30/75');
    expect(log).toContain('Location: Building Site (Jade Garden)');
    expect(log).toContain('Danger Level: Low');
    expect(log).toContain('King has spent 4 Stamina on this task: (+4d6)');
    expect(log).toContain('- King: Digger (T1 Lv3), Work Die d6, +2 per die');
    expect(log).toContain('King: (5+2)(1+2)(6+2)(4+2) = 24');
    expect(log).toContain('Kie: (3) = 3');
    expect(log).toContain('Total Work Done Today: 27');
    expect(log).toContain('Event Roll (1d20): 17');
    expect(log).toContain('Result: Boon');
    expect(log).toContain('Current Workload: 57/75');
    expect(log).not.toMatch(/Speed/);
  });

  it('pauses the log before the dice, the Event and each typed answer', () => {
    const { world, project } = testWorld();
    const draft = rolledDraft(world, project);
    const { lines, stops } = workdayLogScript(world, draft, resolveDraft(world, draft));
    expect(stops.map((s) => s.name)).toEqual(WORKDAY_STOPS);
    const lineAt = (name) => lines[stops.find((s) => s.name === name).at - 1];
    expect(lineAt('rollDice')).toBe('Kie: 1d4'); // the last "Preparing Work Rolls" line
    expect(lines[stops.find((s) => s.name === 'rollEvent').at]).toMatch(/^Event Roll/);
  });

  it('shows an undiscovered place as [???] (Location Name Not Discovered)', () => {
    const { world, project } = testWorld();
    world.containers[project.locationContainerId].discovered = false;
    const draft = rolledDraft(world, project);
    expect(workdayLogText(world, draft, resolveDraft(world, draft))).toContain('Location: [???] (Location Name Not Discovered)');
  });

  it('needs an override to spend more Stamina than is left', () => {
    const { world, project } = testWorld();
    const draft = rolledDraft(world, project);
    world.characters.king.staminaRemaining = 2;
    expect(acceptBlocker(draft, resolveDraft(world, draft))).toMatch(/override/);
    draft.staminaOverride = true;
    expect(acceptBlocker(draft, resolveDraft(world, draft))).toBe('');
  });

  it('Accept commits everything in one step, and undo restores it', () => {
    const { world, project } = testWorld();
    const before = structuredClone(world);
    const draft = rolledDraft(world, project);
    const resolved = resolveDraft(world, draft);
    const cmd = acceptWorkday(world, draft, resolved, workdayLogText(world, draft, resolved));
    const command = createCommand(cmd.type, cmd.payload);
    command.do(world);

    const p = world.projects[project.id];
    expect(p.workloadCurrent).toBe(57);
    expect(p.status).toBe('active');
    expect(p.workdays).toHaveLength(1);
    expect(p.workdays[0]).toMatchObject({ day: 8, total: 27, eventRoll: 17, eventName: 'Boon', workloadBefore: 30, workloadAfter: 57 });
    expect(p.workdays[0].participants[0]).toMatchObject({ name: 'King', stamina: 4, die: 6, bonus: 2, rolls: [5, 1, 6, 4], work: 24 });
    expect(world.characters.king.staminaRemaining).toBe(0);
    expect(world.characters.kie.staminaRemaining).toBe(0);
    expect(world.buildings.hole.constructionProgress).toBe(76); // 57 / 75
    expect(dayEntries(world, 8)).toHaveLength(1);
    expect(dayEntries(world, 8)[0].text).toContain('Project Roll 1');

    command.undo(world);
    expect(world).toEqual(before);
  });
});

describe('migration 11 -> 12 (Projects)', () => {
  it('adds the Day Log, settings and assigned Project', () => {
    const w = migrateWorld({ schemaVersion: 11, meta: {}, definitions: {}, characters: { a: { id: 'a' } } });
    expect(w.schemaVersion).toBeGreaterThanOrEqual(12);
    expect(w.projects).toEqual({});
    expect(w.dayLogs).toEqual({});
    expect(w.meta.settings).toEqual({ markEdited: false });
    expect(w.characters.a.assignmentProjectId).toBe('');
  });
});
