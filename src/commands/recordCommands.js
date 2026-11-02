// Generic commands that work on any record collection, so every system can
// edit fields and add/remove records without writing its own commands.
// A collection is named by a path into the world, for example "containers",
// "placedObjects" or "definitions.tileTypes".
import { registerCommand, createCommand } from './registry.js';

export function getCollection(world, path) {
  return path.split('.').reduce((obj, key) => obj[key], world);
}

// Re-inserts a key at a position, so undoing a removal restores the
// original order (plain objects keep keys in insertion order).
export function insertAt(obj, key, value, index) {
  const entries = Object.entries(obj);
  for (const [k] of entries) delete obj[k];
  entries.splice(Math.min(index, entries.length), 0, [key, value]);
  for (const [k, v] of entries) obj[k] = v;
}

// ---- setField: change one field of one record ----

registerCommand('setField', {
  label: (p) => `Set ${p.field} of ${p.name || p.id} to ${JSON.stringify(p.newValue)}`,
  doFn: (world, p) => {
    getCollection(world, p.path)[p.id][p.field] = structuredClone(p.newValue);
  },
  undoFn: (world, p) => {
    getCollection(world, p.path)[p.id][p.field] = structuredClone(p.oldValue);
  },
});

// name is only used for the Log text.
export function setField(world, path, id, field, newValue, name = '') {
  const oldValue = getCollection(world, path)[id][field];
  return createCommand('setField', { path, id, field, oldValue, newValue, name });
}

// ---- addRecord / removeRecord ----

registerCommand('addRecord', {
  label: (p) => `Added ${p.record.name || p.record.id}`,
  doFn: (world, p) => {
    getCollection(world, p.path)[p.record.id] = structuredClone(p.record);
  },
  undoFn: (world, p) => {
    delete getCollection(world, p.path)[p.record.id];
  },
});

registerCommand('removeRecord', {
  label: (p) => `Removed ${p.record.name || p.record.id}`,
  doFn: (world, p) => {
    delete getCollection(world, p.path)[p.record.id];
  },
  undoFn: (world, p) => {
    insertAt(getCollection(world, p.path), p.record.id, structuredClone(p.record), p.index);
  },
});

export function addRecord(path, record) {
  return createCommand('addRecord', { path, record: structuredClone(record) });
}

export function removeRecord(world, path, id) {
  const collection = getCollection(world, path);
  return createCommand('removeRecord', {
    path,
    record: structuredClone(collection[id]),
    index: Object.keys(collection).indexOf(id),
  });
}

// ---- batch: several commands that undo and redo as ONE step ----
// Each inner command is built before the batch runs, so two inner commands
// must not change the same field (the second would remember the wrong old value).

registerCommand('batch', {
  label: (p) => p.label,
  doFn: (world, p) => {
    for (const c of p.commands) createCommand(c.type, c.payload).do(world);
  },
  undoFn: (world, p) => {
    for (const c of [...p.commands].reverse()) createCommand(c.type, c.payload).undo(world);
  },
});

// commands may contain nulls (skipped), so callers can add steps conditionally.
export function batch(label, commands) {
  const steps = commands.filter(Boolean).map((c) => ({ type: c.type, payload: c.payload }));
  return createCommand('batch', { label, commands: steps });
}
