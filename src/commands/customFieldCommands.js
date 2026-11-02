// Commands for Arbiter-made custom fields. Every instance record has a
// customFields object: { [fieldId]: { name, type, value } }
// where type is 'text' | 'number' | 'boolean'.
import { registerCommand, createCommand } from './registry.js';
import { getCollection, insertAt } from './recordCommands.js';
import { newId } from '../data/ids.js';

function fieldsOf(world, p) {
  const record = getCollection(world, p.path)[p.id];
  record.customFields ??= {}; // older records may not have the object yet
  return record.customFields;
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

export function addCustomField(path, id, name, type = 'text') {
  const field = { name, type, value: defaultValue(type) };
  return createCommand('addCustomField', { path, id, fieldId: newId('field'), field });
}

export function updateCustomField(world, path, id, fieldId, changes) {
  const oldField = getCollection(world, path)[id].customFields[fieldId];
  const newField = { ...oldField, ...changes };
  // Changing the type converts the value so it stays valid.
  if (changes.type && changes.type !== oldField.type) {
    newField.value = convertValue(oldField.value, changes.type);
  }
  return createCommand('updateCustomField', { path, id, fieldId, oldField, newField });
}

export function removeCustomField(world, path, id, fieldId) {
  const fields = getCollection(world, path)[id].customFields;
  return createCommand('removeCustomField', {
    path,
    id,
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
