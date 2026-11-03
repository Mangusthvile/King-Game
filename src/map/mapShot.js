// Map screenshots, drawn straight from the map data onto a canvas (not a
// copy of the screen), so they can be cropped and drawn without the grid.
// crop:
//   'view'     what the map shows on screen now
//   'edge'     the whole map: a Region or Biome Map's edge, or everything
//              painted or placed on the World Map
//   'selected' the selected Region, Biome or Area outline
import { ZOOM_LEVELS } from './camera.js';

const MAX_SIDE = 8192; // pixels; browsers refuse much bigger canvases

// The cells to draw for a crop, or null if there is nothing to crop to.
export function cropRect(view, crop) {
  if (crop === 'selected') {
    const obj = view.world.placedObjects[view.state.selectedId];
    return obj ? { x: obj.x, y: obj.y, w: obj.w, h: obj.h } : null;
  }
  if (crop === 'edge') {
    const b = view.frameBounds;
    if (b) return { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
    return contentRect(view);
  }
  return null;
}

// Everything painted or placed on an unbounded map (the World Map).
function contentRect(view) {
  const xs = [];
  const ys = [];
  for (const key of Object.keys(view.container.tiles)) {
    const [x, y] = key.split(',').map(Number);
    xs.push(x, x + 1);
    ys.push(y, y + 1);
  }
  for (const id of view.container.placedObjectIds) {
    const o = view.world.placedObjects[id];
    if (!o) continue;
    xs.push(o.x, o.x + o.w);
    ys.push(o.y, o.y + o.h);
  }
  if (!xs.length) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Draws the map into a new canvas. The current zoom is kept unless the
// result would be too big, then the next smaller zoom level that fits.
export function mapShot(view, { crop = 'view', hideGrid = false } = {}) {
  const rect = crop === 'view' ? null : cropRect(view, crop);
  const canvas = document.createElement('canvas');
  let camera = view.camera;
  if (rect) {
    const fits = (z) => rect.w * z <= MAX_SIDE && rect.h * z <= MAX_SIDE;
    const zoom = fits(camera.zoom) ? camera.zoom : [...ZOOM_LEVELS].reverse().find(fits) ?? ZOOM_LEVELS[0];
    camera = { x: rect.x, y: rect.y, zoom };
    canvas.width = rect.w * zoom;
    canvas.height = rect.h * zoom;
  } else {
    canvas.width = view.canvas.width;
    canvas.height = view.canvas.height;
  }
  const ctx = canvas.getContext('2d');
  view.drawShot(ctx, canvas.width, canvas.height, camera, { hideGrid });
  return canvas;
}
