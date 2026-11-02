// The Day Log (CLAUDE.md, Resolution Logs): every Resolution Log of a day,
// in order, plus the Arbiter's free-text narration between them.
//
// world.dayLogs[day] = { id: String(day), day, entries: [entry] }
//   entry: { id, kind: 'resolution' | 'narration',
//            method ('project', later 'harvest'...; '' for narration),
//            refId (the record it belongs to, e.g. a Project; '' for narration),
//            text }
//
// Every change is a command (addRecord / setField on 'dayLogs'), so it undoes.
import { newId } from './ids.js';
import { addRecord, setField } from '../commands/recordCommands.js';

export function dayEntries(world, day) {
  return world.dayLogs?.[String(day)]?.entries ?? [];
}

// Days that have a Day Log, oldest first.
export function loggedDays(world) {
  return Object.values(world.dayLogs ?? {})
    .map((d) => d.day)
    .sort((a, b) => a - b);
}

export function newEntry(kind, text, { method = '', refId = '' } = {}) {
  return { id: newId('logEntry'), kind, method, refId, text };
}

// How many Resolution Logs of a method this day already has (to number the
// next one: "Project Roll 2").
export function resolutionCount(world, day, method) {
  return dayEntries(world, day).filter((e) => e.kind === 'resolution' && e.method === method).length;
}

// A command that sets a day's whole entry list (creating the day if needed).
function setEntries(world, day, entries) {
  const id = String(day);
  if (!world.dayLogs?.[id]) return addRecord('dayLogs', { id, day, entries });
  return setField(world, 'dayLogs', id, 'entries', entries, `Day ${day} Log`);
}

// Adds an entry at index (default: the end of the day).
export function addDayLogEntry(world, day, entry, index = null) {
  const entries = [...dayEntries(world, day)];
  entries.splice(index ?? entries.length, 0, entry);
  return setEntries(world, day, entries);
}

export function updateDayLogEntry(world, day, entryId, text) {
  return setEntries(world, day, dayEntries(world, day).map((e) => (e.id === entryId ? { ...e, text } : e)));
}

export function removeDayLogEntry(world, day, entryId) {
  return setEntries(world, day, dayEntries(world, day).filter((e) => e.id !== entryId));
}

// The whole day as one text, entries separated by a blank line, ready to
// paste into the day's write-up.
export function dayLogText(world, day) {
  return dayEntries(world, day)
    .map((e) => e.text.trim())
    .filter(Boolean)
    .join('\n\n');
}
