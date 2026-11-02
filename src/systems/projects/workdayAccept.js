// Accept: turns the workday proposal into ONE undoable command. It updates
// the Workload (and the linked building), spends each participant's
// Stamina, adds any Conditions from the Event, saves the workday to the
// Project's history and puts its Resolution Log in today's Day Log.
//
// A saved workday (project.workdays[]):
//   { id, day, participants: [{ characterId, name, stamina, skillId, skillName,
//       tier, level, die, bonus, toolBonus, toolNote, rolls, edited, work }],
//     total, eventRoll, eventId, eventName, eventEdited, effect,
//     workloadChange, conditionsAdded, notes, workloadBefore, workloadAfter, log }
import { newId } from '../../data/ids.js';
import { setField, batch } from '../../commands/recordCommands.js';
import { addDayLogEntry, newEntry } from '../../data/dayLog.js';
import { buildingSync } from './projectModel.js';

// Why Accept is not possible yet ('' = it is).
export function acceptBlocker(draft, resolved) {
  if (!resolved.project) return 'This Project no longer exists.';
  if (resolved.missingDie) return 'Pick a Work Die for every participant with a special-tier Skill.';
  if (resolved.total === null) return 'Roll or enter every Work Die first.';
  if (!resolved.event) return 'Roll or enter the Project Event first.';
  if (resolved.overspend.length && !draft.staminaOverride) return 'Someone is spending more Stamina than they have left: tick the override to allow it.';
  return '';
}

function workdayRecord(world, draft, resolved, log) {
  const { working, total, event, before, after } = resolved;
  return {
    id: newId('workday'),
    day: world.meta.currentDay,
    participants: working.map((r) => ({
      characterId: r.p.characterId,
      name: r.name,
      stamina: r.p.stamina,
      skillId: r.skill?.skillId ?? '',
      skillName: r.skillName,
      tier: r.skill?.tier ?? '',
      level: r.skill?.level ?? null,
      die: r.die,
      bonus: r.bonus,
      toolBonus: r.p.toolBonus,
      toolNote: r.p.toolNote,
      rolls: [...r.p.rolls],
      edited: [...r.p.edited],
      work: r.work,
    })),
    total,
    eventRoll: draft.eventRoll,
    eventId: event.id,
    eventName: event.name,
    eventEdited: draft.eventEdited || !!draft.eventOverrideId,
    effect: draft.effect.trim(),
    workloadChange: draft.workloadChange || 0,
    conditionsAdded: structuredClone(draft.conditionsToAdd),
    notes: draft.notes.trim(),
    workloadBefore: before,
    workloadAfter: after,
    log,
  };
}

export function acceptWorkday(world, draft, resolved, log) {
  const { project, working, after } = resolved;
  const record = workdayRecord(world, draft, resolved, log);

  // Stamina: spend it, never below 0 (an override can spend more than is left).
  const stamina = working
    .filter((r) => r.character && r.remaining !== null)
    .map((r) => setField(world, 'characters', r.character.id, 'staminaRemaining', Math.max(0, r.remaining - r.p.stamina), r.name));

  // Conditions from the Event, one command per character.
  const byCharacter = {};
  for (const c of draft.conditionsToAdd) (byCharacter[c.characterId] ??= []).push(c);
  const conditions = Object.entries(byCharacter)
    .filter(([id]) => world.characters[id])
    .map(([id, list]) => {
      const ch = world.characters[id];
      const added = list.map((c) => ({ conditionId: c.conditionId, name: c.name, modifier: c.modifier, durationDays: c.durationDays, note: `Project Event: ${project.name}, Day ${record.day}` }));
      return setField(world, 'characters', id, 'conditions', [...(ch.conditions ?? []), ...added], ch.name);
    });

  return batch(`Workday on "${project.name}": +${record.total} work, ${record.eventName} (${after}/${project.workloadRequired})`, [
    setField(world, 'projects', project.id, 'workloadCurrent', after, project.name),
    setField(world, 'projects', project.id, 'workdays', [...project.workdays, record], project.name),
    project.status === 'planned' ? setField(world, 'projects', project.id, 'status', 'active', project.name) : null,
    buildingSync(world, project, after),
    ...stamina,
    ...conditions,
    addDayLogEntry(world, record.day, newEntry('resolution', log, { method: 'project', refId: project.id })),
  ]);
}
