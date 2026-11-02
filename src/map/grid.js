// Sparse grid helpers. Only occupied cells are ever stored, keyed by "x,y".

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function parseKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

// Every cell key covered by a footprint with its anchor (top-left) at x, y.
export function footprintKeys(x, y, w, h) {
  const keys = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) keys.push(cellKey(x + dx, y + dy));
  }
  return keys;
}

// The placed objects that live in a container, skipping any missing ids.
export function objectsIn(world, container) {
  return container.placedObjectIds.map((id) => world.placedObjects[id]).filter(Boolean);
}

// Occupancy index: cell key -> objectId, for every cell an object covers.
// It is rebuilt from the world data, never saved, so it can't go out of date.
export function buildOccupancy(world, container) {
  const occupancy = new Map();
  for (const obj of objectsIn(world, container)) {
    for (const key of footprintKeys(obj.x, obj.y, obj.w, obj.h)) occupancy.set(key, obj.id);
  }
  return occupancy;
}

// True if no other object covers any cell of this footprint.
// ignoreId lets an object overlap its own old position while moving.
export function isAreaFree(occupancy, x, y, w, h, ignoreId = null) {
  return footprintKeys(x, y, w, h).every((key) => {
    const owner = occupancy.get(key);
    return owner === undefined || owner === ignoreId;
  });
}

// Finds the nearest free spot for a footprint, searching outward in square
// rings around (x, y). Used by Duplicate so the copy doesn't land on top.
export function findFreeSpot(occupancy, x, y, w, h, maxRadius = 200) {
  // First try right beside the original: right, below, left, above.
  const beside = [
    [x + w, y],
    [x, y + h],
    [x - w, y],
    [x, y - h],
  ];
  for (const [bx, by] of beside) {
    if (isAreaFree(occupancy, bx, by, w, h)) return { x: bx, y: by };
  }
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring edge only
        if (isAreaFree(occupancy, x + dx, y + dy, w, h)) return { x: x + dx, y: y + dy };
      }
    }
  }
  return null;
}

// Every cell on a straight line between two cells, so a fast mouse drag
// still paints a solid stroke (Bresenham's line algorithm).
export function lineCells(x0, y0, x1, y1) {
  const cells = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return cells;
}
