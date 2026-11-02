// Builds new placed objects (and the records they stand for), and answers
// small questions about placed objects that both tools and panels need.
import { newId } from '../data/ids.js';
import { createContainer } from '../data/schema.js';
import { findFreeSpot } from './grid.js';
import { placeObject } from './mapCommands.js';
import { typesFor } from './containerTypes.js';

// A "placeable" is an entry from a map's placeables.json, for example
// { id: 'region', kind: 'region', w: 6, h: 4, color, defaultName, createsContainer }.
// fixedTypeId (optional) always gives what it creates that type, for
// example a Settlement is a Biome of the Settlement type.
// typeId: the Region / Biome type for what it creates ('' = none). The
// type's color and default fields are copied on.
// Returns the placeObject command; the new object's id is command.payload.object.id.
export function newPlacement(world, containerId, placeable, x, y, typeId = '') {
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
  // Regions, Biomes and Areas are real containers (Regions and Biomes can be entered).
  let record = null;
  if (placeable.createsContainer) {
    record = createContainer({
      kind: placeable.createsContainer,
      parentId: containerId,
      name: placeable.defaultName,
    });
    const type = typesFor(world, record.kind)[typeId];
    if (type) {
      record.typeId = type.id;
      record.customFields = structuredClone(type.defaultFields ?? {});
      object.color = type.color;
    }
    object.refId = record.id;
  }
  return placeObject(world, object, record);
}

// A copy of an object in the nearest free spot. Returns null if there is no room.
// layer: the occupancy layer the object is in (see grid.js).
// fits: extra test for the new spot (staying inside the map's bounds).
export function duplicatePlacement(world, objectId, layer, fits) {
  const source = world.placedObjects[objectId];
  const spot = findFreeSpot(layer, source.x, source.y, source.w, source.h, fits);
  if (!spot) return null;

  const object = { ...structuredClone(source), id: newId('obj'), x: spot.x, y: spot.y };
  let record = null;
  const sourceRecord = source.refId && world.containers[source.refId];
  if (sourceRecord) {
    record = {
      ...structuredClone(sourceRecord),
      id: newId(sourceRecord.kind),
      name: `${sourceRecord.name} (copy)`,
      // Stage 2 note: the copy starts empty inside; biomes are not copied yet.
      placedObjectIds: [],
    };
    object.refId = record.id;
  } else {
    object.label = `${source.label} (copy)`;
  }
  return placeObject(world, object, record);
}

// Which type the Place tool will give a new Region or Biome: the
// placeable's fixed type, else the one picked in the toolbar, else the first.
export function placementTypeId(world, state, placeable) {
  if (!placeable?.createsContainer) return '';
  const types = typesFor(world, placeable.createsContainer);
  if (placeable.fixedTypeId) return types[placeable.fixedTypeId] ? placeable.fixedTypeId : '';
  const chosen = state.placeTypeIds[placeable.id];
  return types[chosen] ? chosen : Object.keys(types)[0] ?? '';
}

// The placeable an object was made from, to know how to draw it. A
// placeable with a fixed type (Settlement) wins when the record has that
// type; otherwise the first placeable of the same kind.
export function placeableFor(world, placeables, obj) {
  const typeId = world.containers[obj.refId]?.typeId;
  const sameKind = placeables.filter((p) => p.kind === obj.kind);
  return sameKind.find((p) => p.fixedTypeId && p.fixedTypeId === typeId) ?? sameKind.find((p) => !p.fixedTypeId) ?? sameKind[0];
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
