// Commands for editing any map (World, Region or Biome): painting tiles and
// placing, removing and moving objects. Every payload stores copies of the
// old and new data, so undo works even after reloading the world.
import { registerCommand, createCommand } from '../commands/registry.js';
import { collectInside } from './containerTree.js';

// ---- Paint / erase tiles ----
// One command per brush stroke, so a whole drag undoes in one step.
// cells: [{ key, oldTile, newTile }], a tile of null means "no tile".

function setTile(tiles, key, tileId) {
  if (tileId === null) delete tiles[key];
  else tiles[key] = tileId;
}

registerCommand('paintTiles', {
  label: (p) =>
    p.cells[0]?.newTile === null
      ? `Erased ${p.cells.length} tile(s)`
      : `Painted ${p.cells.length} tile(s) with ${p.tileName}`,
  doFn: (world, p) => {
    const tiles = world.containers[p.containerId].tiles;
    for (const c of p.cells) setTile(tiles, c.key, c.newTile);
  },
  undoFn: (world, p) => {
    const tiles = world.containers[p.containerId].tiles;
    for (const c of p.cells) setTile(tiles, c.key, c.oldTile);
  },
});

// stroke: Map of cell key -> new tile id (or null to erase).
// Returns null if nothing would change.
export function paintTiles(world, containerId, stroke, tileName = '') {
  const tiles = world.containers[containerId].tiles;
  const cells = [];
  for (const [key, newTile] of stroke) {
    const oldTile = tiles[key] ?? null;
    if (oldTile !== newTile) cells.push({ key, oldTile, newTile });
  }
  if (cells.length === 0) return null;
  return createCommand('paintTiles', { containerId, cells, tileName });
}

// ---- Place / remove objects ----
// Payload: { object, record, index, inner }
//   object: the placed object (position, size, look)
//   record: an optional record the object represents, for example the
//           Region container behind a Region on the World Map
//   index:  position in the host container's placedObjectIds list
//   inner:  { containers, objects } everything inside the record (the
//           Biomes of a Region and every object on their maps), so
//           removing a Region removes, and undo restores, all of it

function addPlaced(world, p) {
  world.placedObjects[p.object.id] = structuredClone(p.object);
  world.containers[p.object.containerId].placedObjectIds.splice(p.index, 0, p.object.id);
  if (p.record) world.containers[p.record.id] = structuredClone(p.record);
  for (const c of p.inner?.containers ?? []) world.containers[c.id] = structuredClone(c);
  for (const o of p.inner?.objects ?? []) world.placedObjects[o.id] = structuredClone(o);
}

function deletePlaced(world, p) {
  delete world.placedObjects[p.object.id];
  const ids = world.containers[p.object.containerId].placedObjectIds;
  const at = ids.indexOf(p.object.id);
  if (at !== -1) ids.splice(at, 1);
  if (p.record) delete world.containers[p.record.id];
  for (const c of p.inner?.containers ?? []) delete world.containers[c.id];
  for (const o of p.inner?.objects ?? []) delete world.placedObjects[o.id];
}

const nameOf = (p) => p.record?.name || p.object.label || p.object.kind;

registerCommand('placeObject', {
  label: (p) => `Placed ${p.object.kind} "${nameOf(p)}" at ${p.object.x}, ${p.object.y}`,
  doFn: addPlaced,
  undoFn: deletePlaced,
});

registerCommand('removeObject', {
  label: (p) => `Removed ${p.object.kind} "${nameOf(p)}"`,
  doFn: deletePlaced,
  undoFn: addPlaced,
});

export function placeObject(world, object, record = null) {
  const index = world.containers[object.containerId].placedObjectIds.length;
  return createCommand('placeObject', {
    object: structuredClone(object),
    record: record && structuredClone(record),
    index,
  });
}

export function removeObject(world, objectId) {
  const object = world.placedObjects[objectId];
  const record = object.refId ? world.containers[object.refId] ?? null : null;
  return createCommand('removeObject', {
    object: structuredClone(object),
    record: record && structuredClone(record),
    index: world.containers[object.containerId].placedObjectIds.indexOf(objectId),
    inner: record ? structuredClone(collectInside(world, record.id)) : null,
  });
}

// ---- Move ----

registerCommand('moveObject', {
  label: (p) => `Moved "${p.name}" from ${p.from.x}, ${p.from.y} to ${p.to.x}, ${p.to.y}`,
  doFn: (world, p) => Object.assign(world.placedObjects[p.id], p.to),
  undoFn: (world, p) => Object.assign(world.placedObjects[p.id], p.from),
});

export function moveObject(world, id, x, y, name = '') {
  const obj = world.placedObjects[id];
  return createCommand('moveObject', { id, from: { x: obj.x, y: obj.y }, to: { x, y }, name });
}
