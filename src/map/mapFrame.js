// Linked map levels. A Region's map covers exactly its footprint on the
// World Map, and a Biome's map its footprint on the Region Map: each parent
// cell becomes mapScale x mapScale cells on the child map, centered on cell
// 0, 0. The same rule works at every level.
//
// Inherited base layer: a child map shows the parent's terrain (the
// parent's own paint, or what the parent itself inherits) under its
// footprint, scaled up. It is worked out from the parent every time the map
// is drawn, so painting a parent updates its children at once. The child's
// own paint is drawn on top and is never changed by this.
import { cellKey } from './grid.js';
import { objectFor } from './containerTypes.js';
import { DEFAULT_MAP_SCALE } from '../data/schema.js';

// Where a container's map sits relative to its footprint on its parent's map:
//   { obj, scale, minX, minY, width, height }   (obj = its placed object on the parent map)
// or null for the World (no parent) or a container with no footprint.
export function childGeometry(world, container) {
  const obj = objectFor(world, container);
  if (!obj) return null;
  const scale = container.mapScale || DEFAULT_MAP_SCALE;
  const width = obj.w * scale;
  const height = obj.h * scale;
  return { obj, scale, minX: -Math.floor(width / 2), minY: -Math.floor(height / 2), width, height };
}

// The tile shown at a cell of a container's map: its own paint, else the
// inherited base (looked up on the parent, and its parent, and so on).
// undefined = nothing painted anywhere above it.
export function terrainAt(world, container, x, y) {
  const own = container.tiles[cellKey(x, y)];
  if (own !== undefined) return own;
  const g = childGeometry(world, container);
  if (!g) return undefined;
  const dx = Math.floor((x - g.minX) / g.scale);
  const dy = Math.floor((y - g.minY) / g.scale);
  if (dx < 0 || dy < 0 || dx >= g.obj.w || dy >= g.obj.h) return undefined; // outside the footprint
  return terrainAt(world, world.containers[g.obj.containerId], g.obj.x + dx, g.obj.y + dy);
}

// Returns { bounds, backdrop, board } for a child map, or null if it has no
// footprint to measure (then the map is unbounded).
//   bounds:   { minX, minY, maxX, maxY } in child map cells (max is exclusive)
//   backdrop: [{ x, y, size, tileId }] one square per parent cell that shows terrain
//   board:    true = draw it as a framed board and limit panning (Biome Map)
export function mapFrame(world, container, { board = false } = {}) {
  const g = childGeometry(world, container);
  if (!g) return null;
  const { obj, scale, minX, minY } = g;
  const bounds = { minX, minY, maxX: minX + g.width, maxY: minY + g.height };
  const parent = world.containers[obj.containerId];
  const backdrop = [];
  for (let dy = 0; dy < obj.h; dy++) {
    for (let dx = 0; dx < obj.w; dx++) {
      const tileId = terrainAt(world, parent, obj.x + dx, obj.y + dy);
      if (tileId !== undefined) backdrop.push({ x: minX + dx * scale, y: minY + dy * scale, size: scale, tileId });
    }
  }
  return { bounds, backdrop, board };
}

// The area the camera may show on a framed board: the board itself, grown
// to include any object left outside its edge, so nothing becomes unreachable.
export function boardPanBox(world, container, bounds) {
  const box = { ...bounds };
  for (const id of container.placedObjectIds) {
    const o = world.placedObjects[id];
    if (!o) continue;
    box.minX = Math.min(box.minX, o.x);
    box.minY = Math.min(box.minY, o.y);
    box.maxX = Math.max(box.maxX, o.x + o.w);
    box.maxY = Math.max(box.maxY, o.y + o.h);
  }
  return box;
}
