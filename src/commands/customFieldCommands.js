// Commands for Arbiter-made custom fields. Every instance record has a
// customFields object: { [fieldId]: { name, type, value } }
// where type is 'text' | 'number' | 'boolean'.
// The same commands also edit a type's defaultFields (same shape): pass
// key = 'defaultFields'. Payloads without a key mean 'customFields'.
import { registerCommand, createCommand } from './registry.js';
import { getCollection, insertAt } from './recordCommands.js';
import { newId } from '../data/ids.js';

function fieldsOf(world, p) {
  const record = getCollection(world, p.path)[p.id];
  const key = p.key ?? 'customFields';
  record[key] ??= {}; // older records may not have the object yet
  return record[key];
}

registerCommand('addCustomField', {
  label: (p) => `Added custom field "${p.field.name}"`,
  doFn: (world, p) => {
    fieldsOf(world, p)[p.fieldId] = structuredClone(p.field);
  },
  undoFn: (world, p) => {
    delete fieldsOf(world, p)[p.fieldId];
  },
});

registerCommand('updateCustomField', {
  label: (p) =>
    p.oldField.name !== p.newField.name
      ? `Renamed custom field "${p.oldField.name}" to "${p.newField.name}"`
      : `Set custom field "${p.newField.name}" to ${JSON.stringify(p.newField.value)}`,
  doFn: (world, p) => {
    fieldsOf(world, p)[p.fieldId] = structuredClone(p.newField);
  },
  undoFn: (world, p) => {
    fieldsOf(world, p)[p.fieldId] = structuredClone(p.oldField);
  },
});

registerCommand('removeCustomField', {
  label: (p) => `Removed custom field "${p.field.name}"`,
  doFn: (world, p) => {
    delete fieldsOf(world, p)[p.fieldId];
  },
  undoFn: (world, p) => {
    insertAt(fieldsOf(world, p), p.fieldId, structuredClone(p.field), p.index);
  },
});

// ---- Helpers for the UI ----

export function addCustomField(path, id, name, type = 'text', key = 'customFields') {
  const field = { name, type, value: defaultValue(type) };
  return createCommand('addCustomField', { path, id, key, fieldId: newId('field'), field });
}

export function updateCustomField(world, path, id, fieldId, changes, key = 'customFields') {
  const oldField = getCollection(world, path)[id][key][fieldId];
  const newField = { ...oldField, ...changes };
  // Changing the type converts the value so it stays valid.
  if (changes.type && changes.type !== oldField.type) {
    newField.value = convertValue(oldField.value, changes.type);
  }
  return createCommand('updateCustomField', { path, id, key, fieldId, oldField, newField });
}

export function removeCustomField(world, path, id, fieldId, key = 'customFields') {
  const fields = getCollection(world, path)[id][key];
  return createCommand('removeCustomField', {
    path,
    id,
    key,
    fieldId,
    field: structuredClone(fields[fieldId]),
    index: Object.keys(fields).indexOf(fieldId),
  });
}

function defaultValue(type) {
  if (type === 'number') return 0;
  if (type === 'boolean') return false;
  return '';
}

function convertValue(value, type) {
  if (type === 'number') return Number.isFinite(Number(value)) ? Number(value) : 0;
  if (type === 'boolean') return value === true || value === 'true' || Number(value) > 0;
  return String(value);
}
