// Simple tasks: Stamina spent on anything that has no Resolution Method
// yet (harvesting, teaching, scouting... until those systems are built).
// No dice: the Arbiter writes the result in free text.
//
// world.tasks[id]:
//   { id, day, description, locationContainerId, ownerFactionId (whose task;
//     its log goes to that faction's Day Log),
//     participants: [{ characterId, name, stamina }],
//     result, notes, log (the Day Log text), customFields }
//
// The draft (timeView.task) has the same fields plus staminaOverride and
// logText (the Arbiter's edited log, null = generated).
import template from './templates/simpleTask.txt?raw';
import { newId } from '../../data/ids.js';
import { fillTemplate } from '../../rules/logTemplate.js';
import { logPlaceName, dangerAt } from '../../data/places.js';
import { addRecord, removeRecord, setField, batch } from '../../commands/recordCommands.js';
import { addDayLogEntry, removeDayLogEntry, newEntry, dayEntries } from '../../data/dayLog.js';

export const TASK_METHOD = 'task';

export function newTaskDraft(ownerFactionId = '') {
  return { participants: [], ownerFactionId, locationContainerId: '', description: '', result: '', notes: '', staminaOverride: false, logText: null };
}

// The draft with its characters looked up:
//   { rows: [{ p, character, name, remaining, overspend }], overspend: [rows] }
export function resolveTask(world, draft) {
  const rows = draft.participants.map((p) => {
    const character = world.characters[p.characterId];
    const remaining = character?.staminaRemaining ?? null;
    return { p, character, name: character?.name ?? '(removed character)', remaining, overspend: remaining !== null && p.stamina > remaining };
  });
  return { rows, overspend: rows.filter((r) => r.overspend) };
}

// The number this task gets in today's Day Log ("Task 2").
function taskNumber(world, day) {
  return dayEntries(world, day).filter((e) => e.method === TASK_METHOD).length + 1;
}

export function taskLogText(world, draft, resolved) {
  const day = world.meta.currentDay;
  return fillTemplate(template, {
    day,
    taskNumber: taskNumber(world, day),
    description: draft.description.trim() || 'Task',
    location: logPlaceName(world, draft.locationContainerId),
    danger: dangerAt(world, draft.locationContainerId) || 'Not set',
    partySize: resolved.rows.length,
    participantNames: resolved.rows.map((r) => r.name).join(', ') || 'Nobody',
    participants: resolved.rows.map((r) => ({ name: r.name, stamina: r.p.stamina })),
    result: draft.result.trim() || '-',
    notes: draft.notes.trim(),
  }).trim();
}

// Why Accept is not possible yet ('' = it is).
export function taskBlocker(draft, resolved) {
  if (!draft.description.trim()) return 'Describe the task first.';
  if (!resolved.rows.length) return 'Add at least one character.';
  if (resolved.overspend.length && !draft.staminaOverride) return 'Someone is spending more Stamina than they have left: tick the override to allow it.';
  return '';
}

// ONE undoable step: the task record, the Stamina spent, the Day Log entry.
export function acceptTask(world, draft, resolved, log) {
  const day = world.meta.currentDay;
  const record = {
    id: newId('task'),
    day,
    description: draft.description.trim(),
    locationContainerId: draft.locationContainerId,
    ownerFactionId: draft.ownerFactionId ?? '',
    participants: resolved.rows.map((r) => ({ characterId: r.p.characterId, name: r.name, stamina: r.p.stamina })),
    result: draft.result.trim(),
    notes: draft.notes.trim(),
    log,
    customFields: {},
  };
  return batch(`Task "${record.description}" (${record.participants.map((p) => p.name).join(', ')})`, [
    addRecord('tasks', record),
    ...resolved.rows
      .filter((r) => r.character && r.remaining !== null)
      .map((r) => setField(world, 'characters', r.character.id, 'staminaRemaining', Math.max(0, r.remaining - r.p.stamina), r.name)),
    addDayLogEntry(world, day, newEntry(TASK_METHOD, log, { method: TASK_METHOD, refId: record.id, factionId: record.ownerFactionId })),
  ]);
}

// Deletes a task of the current day: gives its Stamina back and removes its
// Day Log entry (one undo step).
export function removeTask(world, task) {
  const entry = dayEntries(world, task.day).find((e) => e.refId === task.id);
  return batch(`Removed task "${task.description}"`, [
    removeRecord(world, 'tasks', task.id),
    ...task.participants
      .filter((p) => world.characters[p.characterId] && task.day === world.meta.currentDay)
      .map((p) => {
        const c = world.characters[p.characterId];
        return setField(world, 'characters', c.id, 'staminaRemaining', (c.staminaRemaining ?? 0) + p.stamina, c.name);
      }),
    entry ? removeDayLogEntry(world, task.day, entry.id) : null,
  ]);
}

export function tasksOnDay(world, day) {
  return Object.values(world.tasks ?? {}).filter((t) => t.day === day);
}
