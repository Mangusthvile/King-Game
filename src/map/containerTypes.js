// Region, Biome and Area types (definitions.regionTypes / biomeTypes / areaTypes).
// A type is { id, name, color, defaultFields, customFields }.
import { createCommand } from '../commands/registry.js';
import { getCollection, setField, batch } from '../commands/recordCommands.js';

export const TYPE_PATHS = {
  region: 'definitions.regionTypes',
  biome: 'definitions.biomeTypes',
  area: 'definitions.areaTypes',
};

export function typesFor(world, kind) {
  return TYPE_PATHS[kind] ? getCollection(world, TYPE_PATHS[kind]) : {};
}

// The placed object that shows a container on its parent's map.
export function objectFor(world, container) {
  const parent = world.containers[container.parentId];
  return parent?.placedObjectIds.map((id) => world.placedObjects[id]).find((o) => o?.refId === container.id);
}

// Default fields of a type that the container doesn't have yet (matched by
// id or by name), as addCustomField commands.
function missingDefaultFields(container, type) {
  const names = new Set(Object.values(container.customFields).map((f) => f.name.toLowerCase()));
  return Object.entries(type.defaultFields ?? {})
    .filter(([fieldId, f]) => !container.customFields[fieldId] && !names.has(f.name.toLowerCase()))
    .map(([fieldId, field]) =>
      createCommand('addCustomField', { path: 'containers', id: container.id, fieldId, field: structuredClone(field) }),
    );
}

// Changing a type is one undo step: set the type, recolor the map object to
// the type's color, and add the type's default fields that are missing.
// Existing custom fields are never removed.
export function changeType(world, container, typeId) {
  const type = typesFor(world, container.kind)[typeId];
  const obj = objectFor(world, container);
  return batch(`Set type of "${container.name}" to ${type?.name ?? 'none'}`, [
    setField(world, 'containers', container.id, 'typeId', typeId, container.name),
    type && obj && obj.color !== type.color ? setField(world, 'placedObjects', obj.id, 'color', type.color, container.name) : null,
    ...(type ? missingDefaultFields(container, type) : []),
  ]);
}

// How many containers use a type (for the delete warning).
export function countUsing(world, typeId) {
  return Object.values(world.containers).filter((c) => c.typeId === typeId).length;
}
