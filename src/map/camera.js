// Camera math for the map canvas. Pure functions, no drawing.
// A camera is { x, y, zoom }:
//   x, y  = the world position (in cells) shown at the canvas top-left corner
//   zoom  = how many screen pixels one cell takes. Always a whole number so
//           pixel art and grid lines stay crisp.

// 2 and 3 let a whole Biome board fit on screen.
export const ZOOM_LEVELS = [2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
export const DEFAULT_ZOOM = 24;

// A camera that puts cell (cx, cy) in the middle of a canvas of the given size.
export function centeredCamera(cx, cy, width, height, zoom = DEFAULT_ZOOM) {
  return { x: cx + 0.5 - width / 2 / zoom, y: cy + 0.5 - height / 2 / zoom, zoom };
}

export function screenToWorld(cam, sx, sy) {
  return { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };
}

// Which cell is under a screen pixel.
export function screenToCell(cam, sx, sy) {
  const w = screenToWorld(cam, sx, sy);
  return { x: Math.floor(w.x), y: Math.floor(w.y) };
}

// The screen pixel of a cell's top-left corner. Rounded so edges land on
// whole pixels.
export function cellToScreen(cam, cx, cy) {
  return {
    x: Math.round((cx - cam.x) * cam.zoom),
    y: Math.round((cy - cam.y) * cam.zoom),
  };
}

// The range of cells that are at least partly on screen.
export function visibleRange(cam, width, height) {
  return {
    minX: Math.floor(cam.x),
    minY: Math.floor(cam.y),
    maxX: Math.floor(cam.x + width / cam.zoom),
    maxY: Math.floor(cam.y + height / cam.zoom),
  };
}

// Moves the camera by a number of screen pixels (used for drag and WASD).
export function panBy(cam, dxPixels, dyPixels) {
  return { ...cam, x: cam.x - dxPixels / cam.zoom, y: cam.y - dyPixels / cam.zoom };
}

// One zoom step in or out (direction +1 or -1), keeping the world point under
// the cursor (sx, sy) in the same place on screen.
export function zoomAt(cam, sx, sy, direction) {
  const index = ZOOM_LEVELS.indexOf(cam.zoom);
  const current = index === -1 ? ZOOM_LEVELS.indexOf(DEFAULT_ZOOM) : index;
  const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, current + direction));
  const zoom = ZOOM_LEVELS[next];
  if (zoom === cam.zoom) return cam;
  const anchor = screenToWorld(cam, sx, sy);
  return { x: anchor.x - sx / zoom, y: anchor.y - sy / zoom, zoom };
}

// Keeps the view on a box { minX, minY, maxX, maxY } (in cells) plus a
// margin of marginPx screen pixels on every side. Along an axis where the
// whole box fits on screen, the box is centered instead. Used for the
// Biome Map's framed board.
export function clampCamera(cam, box, width, height, marginPx = 64) {
  const m = marginPx / cam.zoom;
  const axis = (pos, view, lo, hi) => (hi - lo <= view ? (lo + hi) / 2 - view / 2 : Math.min(Math.max(pos, lo), hi - view));
  return {
    ...cam,
    x: axis(cam.x, width / cam.zoom, box.minX - m, box.maxX + m),
    y: axis(cam.y, height / cam.zoom, box.minY - m, box.maxY + m),
  };
}
