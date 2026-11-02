// The Region Map is not infinite: it covers exactly the Region's footprint
// on the World Map, blown up so each World Map cell becomes mapScale x
// mapScale Region Map cells. The World Map tiles under the Region are drawn,
// scaled up, as the Region Map's background.
import { cellKey } from './grid.js';
import { objectFor } from './containerTypes.js';
import { DEFAULT_MAP_SCALE } from '../data/schema.js';

// Returns { bounds, backdrop }, or null if the Region has no object on the
// World Map to measure (then the Region Map is unbounded, as before).
//   bounds:   { minX, minY, maxX, maxY } in Region Map cells (max is exclusive)
//   backdrop: [{ x, y, size, tileId }] one square per painted World Map cell
export function regionFrame(world, region) {
  const obj = objectFor(world, region);
  if (!obj) return null;
  const scale = region.mapScale || DEFAULT_MAP_SCALE;
  const width = obj.w * scale;
  const height = obj.h * scale;
  // Centered on cell 0, 0 so the default camera shows the middle of the Region.
  const minX = -Math.floor(width / 2);
  const minY = -Math.floor(height / 2);
  const bounds = { minX, minY, maxX: minX + width, maxY: minY + height };

  const worldTiles = world.containers[obj.containerId].tiles;
  const backdrop = [];
  for (let dy = 0; dy < obj.h; dy++) {
    for (let dx = 0; dx < obj.w; dx++) {
      const tileId = worldTiles[cellKey(obj.x + dx, obj.y + dy)];
      if (tileId !== undefined) backdrop.push({ x: minX + dx * scale, y: minY + dy * scale, size: scale, tileId });
    }
  }
  return { bounds, backdrop };
}
