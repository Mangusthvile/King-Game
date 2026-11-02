// Builds new placed objects (and the records they stand for), and answers
// small questions about placed objects that both tools and panels need.
import { newId } from '../data/ids.js';
import { createContainer } from '../data/schema.js';
import { buildOccupancy, findFreeSpot } from './grid.js';
import { placeObject } from './mapCommands.js';

// A "placeable" is an entry from a map's placeables.json, for example
// { id: 'region', kind: 'region', w: 6, h: 4, color, defaultName, createsContainer }.
// Returns the placeObject command; the new object's id is command.payload.object.id.
export function newPlacement(world, containerId, placeable, x, y) {
  const object = {
    id: newId('obj'),
    containerId,
    kind: placeable.kind,
    refId: null,
    x,
    y,
    w: placeable.w,
    h: placeable.h,
    spriteKey: placeable.spriteKey || '',
    label: placeable.defaultName,
    color: placeable.color,
    customFields: {},
  };
  // Regions and Sub-Areas are real containers so they can be entered (Stage 2).
  let record = null;
  if (placeable.createsContainer) {
    record = createContainer({
      kind: placeable.createsContainer,
      parentId: containerId,
      name: placeable.defaultName,
    });
    object.refId = record.id;
  }
  return placeObject(world, object, record);
}

// A copy of an object in the nearest free spot. Returns null if there is no room.
export function duplicatePlacement(world, objectId) {
  const source = world.placedObjects[objectId];
  const host = world.containers[source.containerId];
  const spot = findFreeSpot(buildOccupancy(world, host), source.x, source.y, source.w, source.h);
  if (!spot) return null;

  const object = { ...structuredClone(source), id: newId('obj'), x: spot.x, y: spot.y };
  let record = null;
  const sourceRecord = source.refId && world.containers[source.refId];
  if (sourceRecord) {
    record = {
      ...structuredClone(sourceRecord),
      id: newId(sourceRecord.kind),
      name: `${sourceRecord.name} (copy)`,
      // Stage 2 note: the copy starts empty inside; sub-areas are not copied yet.
      placedObjectIds: [],
    };
    object.refId = record.id;
  } else {
    object.label = `${source.label} (copy)`;
  }
  return placeObject(world, object, record);
}

// The name shown on the map: the represented record's name, or the label.
export function objectName(world, obj) {
  const record = obj.refId && world.containers[obj.refId];
  return record ? record.name : obj.label;
}

// Where an object's name and custom fields live: on the record it stands for
// (a Region's container), or on the placed object itself (a Marker).
export function recordFor(world, obj) {
  if (obj.refId && world.containers[obj.refId]) {
    return { path: 'containers', id: obj.refId, nameField: 'name' };
  }
  return { path: 'placedObjects', id: obj.id, nameField: 'label' };
}
