// Builds new placed objects (and the records they stand for), and answers
// small questions about placed objects that both tools and panels need.
import { placeName } from '../ui/playerView.js';
import { newId } from '../data/ids.js';
import { createContainer } from '../data/schema.js';
import { findFreeSpot } from './grid.js';
import { placeObject } from './mapCommands.js';
import { typesFor } from './containerTypes.js';
import { objectKind } from './objectKinds.js';
import { getCollection, batch } from '../commands/recordCommands.js';
import { describeCommand } from '../commands/registry.js';

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
  // A registered kind (a building) makes its own record and fills in refId.
  const linked = objectKind(object.kind)?.create?.(world, object, typeId) ?? [];
  return placeObject(world, object, record, linked);
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
  let linked = [];
  const sourceRecord = source.refId && world.containers[source.refId];
  const kind = objectKind(source.kind);
  if (kind?.duplicate) {
    linked = kind.duplicate(world, source, object);
  } else if (sourceRecord) {
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
  return placeObject(world, object, record, linked);
}

// Which type the Place tool will give a new Region or Biome: the
// placeable's fixed type, else the one picked in the toolbar, else the first.
export function placementTypeId(world, state, placeable) {
  const types = typeChoices(world, placeable);
  if (!types) return '';
  if (placeable.fixedTypeId) return types[placeable.fixedTypeId] ? placeable.fixedTypeId : '';
  const chosen = state.placeTypeIds[placeable.id];
  return types[chosen] ? chosen : Object.keys(types)[0] ?? '';
}

// The types the Place tool offers for a placeable: Region / Biome / Area
// types, a registered kind's types (building types), or null for none.
export function typeChoices(world, placeable) {
  if (placeable?.createsContainer) return typesFor(world, placeable.createsContainer);
  return objectKind(placeable?.kind)?.types?.(world) ?? null;
}

// The placeable with the default size of the chosen type, if its kind has
// one (a building type's footprint).
export function sizedPlaceable(world, state, placeable) {
  if (!placeable) return placeable;
  const size = objectKind(placeable.kind)?.defaultSize?.(world, placementTypeId(world, state, placeable));
  return size ? { ...placeable, w: size.w, h: size.h } : placeable;
}

// Wraps a move or resize command with whatever the object's kind needs to
// happen when its footprint changes (a building re-links to the Area under
// it), as one undo step. rect: the new position and/or size.
export function withFootprint(world, obj, rect, command) {
  const next = { x: obj.x, y: obj.y, w: obj.w, h: obj.h, ...rect };
  const extra = objectKind(obj.kind)?.footprintChanged?.(world, obj, next);
  return extra ? batch(describeCommand(command.type, command.payload), [command, extra]) : command;
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
  const place = obj.refId && world.containers[obj.refId];
  if (place) return placeName(world, place); // [???] in Player View while undiscovered
  const rec = recordFor(world, obj);
  return getCollection(world, rec.path)[rec.id]?.[rec.nameField] ?? obj.label;
}

// Where an object's name and custom fields live: on the record it stands for
// (a Region's container), or on the placed object itself (a Marker).
export function recordFor(world, obj) {
  const kindRecord = objectKind(obj.kind)?.record?.(world, obj);
  if (kindRecord) return kindRecord;
  if (obj.refId && world.containers[obj.refId]) {
    return { path: 'containers', id: obj.refId, nameField: 'name' };
  }
  return { path: 'placedObjects', id: obj.id, nameField: 'label' };
}
