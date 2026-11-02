// The mini preview drawn inside a Region's outline on the World Map (or a
// Biome's outline on the Region Map): the child's own paint and objects,
// shrunk to fit its footprint. The inherited base is not drawn again, since
// it is the parent's terrain that is already under the outline.
import { parseKey, objectsIn } from './grid.js';
import { childGeometry } from './mapFrame.js';

// Rectangles in parent cells, relative to the object's top-left corner, so
// the preview follows the object while it is dragged:
//   [{ x, y, w, h, color, outline }]   outline = draw only the edge (zones)
// null if the object doesn't stand for a child map.
export function childPreview(world, obj) {
  const child = obj.refId && world.containers[obj.refId];
  if (!child || child.parentId !== obj.containerId) return null;
  const g = childGeometry(world, child);
  if (!g) return null;
  const s = g.scale;
  const tileTypes = world.definitions.tileTypes;
  const rects = [];
  for (const [key, tileId] of Object.entries(child.tiles)) {
    const { x, y } = parseKey(key);
    rects.push({ x: (x - g.minX) / s, y: (y - g.minY) / s, w: 1 / s, h: 1 / s, color: tileTypes[tileId]?.color ?? '#ff00ff' });
  }
  for (const o of objectsIn(world, child)) {
    // Zones (Biomes, Areas) as outlines, everything else as small blocks.
    const isContainer = !!world.containers[o.refId];
    rects.push({ x: (o.x - g.minX) / s, y: (o.y - g.minY) / s, w: o.w / s, h: o.h / s, color: o.color || '#bbbbbb', outline: isContainer });
  }
  return rects;
}
