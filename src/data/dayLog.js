// The Day Log (CLAUDE.md, Resolution Logs): every Resolution Log of a day,
// in order, plus the Arbiter's free-text narration between them. Each
// entry belongs to a faction, so each faction has its own day.
//
// world.dayLogs[day] = { id: String(day), day, startOfDays, entries: [entry] }
//   startOfDays: { factionId: record } the Start of Day record of each Player
//            faction (systems/time/startOfDay.js): { sparkOfChange,
//            sparkOfBalance, followersOffered, followersDecision, dayEvent,
//            notes, text }. Its text is shown and copied at the top of the day.
//   entry: { id, kind: 'resolution' | 'task' | 'dayEnd' | 'transfer' | 'narration',
//            method ('project', later 'harvest'...; 'task' for a simple
//            task, 'advanceDay' for the "Day N ended" summary, 'transfer'
//            for a move between factions; '' for narration),
//            refId (the record it belongs to, e.g. a Project; '' for narration),
//            factionId (the faction whose day it is in; '' = every faction's),
//            text }
//
// Every change is a command (addRecord / setField on 'dayLogs'), so it undoes.
import { newId } from './ids.js';
import { addRecord, setField } from '../commands/recordCommands.js';
import { factionList } from './factions.js';

export function dayEntries(world, day) {
  return world.dayLogs?.[String(day)]?.entries ?? [];
}

// A faction's entries ('' = all of them). Entries for every faction
// (factionId '') are in each faction's day.
export function factionEntries(world, day, factionId) {
  return dayEntries(world, day).filter((e) => !factionId || !e.factionId || e.factionId === factionId);
}

// Days that have a Day Log, oldest first.
export function loggedDays(world) {
  return Object.values(world.dayLogs ?? {})
    .map((d) => d.day)
    .sort((a, b) => a - b);
}

export function newEntry(kind, text, { method = '', refId = '', factionId = '' } = {}) {
  return { id: newId('logEntry'), kind, method, refId, factionId, text };
}

// How many Resolution Logs of a method this day already has (to number the
// next one: "Project Roll 2").
export function resolutionCount(world, day, method) {
  return dayEntries(world, day).filter((e) => e.kind === 'resolution' && e.method === method).length;
}

// A command that sets one field of a day's record (creating the day if needed).
function setDayField(world, day, field, value) {
  const id = String(day);
  if (!world.dayLogs?.[id]) return addRecord('dayLogs', { id, day, entries: [], startOfDays: {}, [field]: value });
  return setField(world, 'dayLogs', id, field, value, `Day ${day} Log`);
}

// A command that sets a day's whole entry list (creating the day if needed).
function setEntries(world, day, entries) {
  return setDayField(world, day, 'entries', entries);
}

export function startOfDay(world, day, factionId) {
  return world.dayLogs?.[String(day)]?.startOfDays?.[factionId] ?? null;
}

// record = null removes it.
export function setStartOfDay(world, day, factionId, record) {
  const all = { ...(world.dayLogs?.[String(day)]?.startOfDays ?? {}) };
  if (record) all[factionId] = record;
  else delete all[factionId];
  return setDayField(world, day, 'startOfDays', all);
}

// Adds an entry at index (default: the end of the day).
export function addDayLogEntry(world, day, entry, index = null) {
  const entries = [...dayEntries(world, day)];
  entries.splice(index ?? entries.length, 0, entry);
  return setEntries(world, day, entries);
}

// Adds several entries at the end of the day in ONE command (two
// addDayLogEntry commands in one batch would undo each other).
export function addDayLogEntries(world, day, entries) {
  return setEntries(world, day, [...dayEntries(world, day), ...entries]);
}

export function updateDayLogEntry(world, day, entryId, text) {
  return setEntries(world, day, dayEntries(world, day).map((e) => (e.id === entryId ? { ...e, text } : e)));
}

export function removeDayLogEntry(world, day, entryId) {
  return setEntries(world, day, dayEntries(world, day).filter((e) => e.id !== entryId));
}

const joinTexts = (texts) =>
  texts
    .map((text) => (text ?? '').trim())
    .filter(Boolean)
    .join('\n\n');

// One faction's day: its Start of Day record first, then its entries.
function oneFactionText(world, day, factionId) {
  return joinTexts([startOfDay(world, day, factionId)?.text, ...factionEntries(world, day, factionId).map((e) => e.text)]);
}

// The whole day as one text, ready to paste into the day's write-up.
// factionId: that faction's day. '' (All factions): every faction's day
// under a heading, then entries that belong to no faction.
export function dayLogText(world, day, factionId = '') {
  if (factionId) return oneFactionText(world, day, factionId);
  const entries = dayEntries(world, day);
  const parts = factionList(world).map((f) => {
    const text = joinTexts([startOfDay(world, day, f.id)?.text, ...entries.filter((e) => e.factionId === f.id).map((e) => e.text)]);
    return text ? `######## ${f.name} ########\n\n${text}` : '';
  });
  const known = new Set(factionList(world).map((f) => f.id));
  const shared = joinTexts(entries.filter((e) => !e.factionId || !known.has(e.factionId)).map((e) => e.text));
  if (shared) parts.push(`######## Every faction ########\n\n${shared}`);
  return joinTexts(parts);
}
