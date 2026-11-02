// Draws one frame of a map: tiles, grid lines, objects and tool previews.
// Only what is inside the visible cell range is drawn.
import { cellToScreen, visibleRange } from './camera.js';
import { cellKey, parseKey, objectsIn } from './grid.js';
import { getSprite } from './sprites.js';

const COLORS = {
  background: '#121212',
  grid: 'rgba(255, 255, 255, 0.06)',
  gridFar: 'rgba(255, 255, 255, 0.035)', // cell lines when zoomed far out
  gridMajor: 'rgba(255, 255, 255, 0.14)', // every 10th line
  axis: 'rgba(217, 179, 122, 0.45)', // the x = 0 and y = 0 lines
  unknownTile: '#ff00ff', // a tile whose type was deleted
  hover: 'rgba(255, 255, 255, 0.25)',
  selected: '#ffe28a',
  ghostOk: 'rgba(95, 191, 85, 0.45)',
  ghostBad: 'rgba(194, 74, 74, 0.55)',
  eraseMark: 'rgba(0, 0, 0, 0.6)',
};

// view: { camera, selectedId, hoverCell, ghost, stroke, objectName(obj), displayOf(obj) }
//   displayOf: 'block' (filled square) or 'outline' (border and name only)
//   ghost:  { x, y, w, h, ok } preview of a place or move
//   stroke: Map of cell key -> tile id (or null) for the brush stroke in progress
export function drawMap(ctx, width, height, world, container, view) {
  const cam = view.camera;
  ctx.imageSmoothingEnabled = false; // pixel art
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  const range = visibleRange(cam, width, height);
  drawTiles(ctx, world, container.tiles, range, cam);
  if (view.stroke) drawStroke(ctx, world, view.stroke, cam);
  drawGrid(ctx, range, cam, width, height);

  for (const obj of objectsIn(world, container)) {
    if (!overlapsRange(obj, range)) continue;
    const draw = view.displayOf(obj) === 'outline' ? drawOutlineObject : drawObject;
    draw(ctx, obj, view.objectName(obj), cam, obj.id === view.selectedId);
  }

  if (view.hoverCell && !view.ghost) {
    fillCells(ctx, cam, view.hoverCell.x, view.hoverCell.y, 1, 1, COLORS.hover);
  }
  if (view.ghost) {
    const g = view.ghost;
    fillCells(ctx, cam, g.x, g.y, g.w, g.h, g.ok ? COLORS.ghostOk : COLORS.ghostBad);
  }
}

function overlapsRange(obj, r) {
  return obj.x <= r.maxX && obj.x + obj.w > r.minX && obj.y <= r.maxY && obj.y + obj.h > r.minY;
}

function fillCells(ctx, cam, x, y, w, h, color) {
  const a = cellToScreen(cam, x, y);
  const b = cellToScreen(cam, x + w, y + h);
  ctx.fillStyle = color;
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
}

function tileColor(world, tileId) {
  return world.definitions.tileTypes[tileId]?.color ?? COLORS.unknownTile;
}

function drawTile(ctx, world, x, y, tileId, cam) {
  const sprite = getSprite(world.definitions.tileTypes[tileId]?.spriteKey);
  if (sprite) {
    const p = cellToScreen(cam, x, y);
    ctx.drawImage(sprite, p.x, p.y, cam.zoom, cam.zoom);
  } else {
    fillCells(ctx, cam, x, y, 1, 1, tileColor(world, tileId));
  }
}

function drawTiles(ctx, world, tiles, range, cam) {
  const visibleCount = (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
  const keys = Object.keys(tiles);
  // Loop over whichever is smaller: the cells on screen, or the painted cells.
  if (visibleCount < keys.length) {
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        const tileId = tiles[cellKey(x, y)];
        if (tileId !== undefined) drawTile(ctx, world, x, y, tileId, cam);
      }
    }
  } else {
    for (const key of keys) {
      const { x, y } = parseKey(key);
      if (x < range.minX || x > range.maxX || y < range.minY || y > range.maxY) continue;
      drawTile(ctx, world, x, y, tiles[key], cam);
    }
  }
}

// The stroke being painted right now, before it becomes a command.
function drawStroke(ctx, world, stroke, cam) {
  for (const [key, tileId] of stroke) {
    const { x, y } = parseKey(key);
    if (tileId === null) fillCells(ctx, cam, x, y, 1, 1, COLORS.eraseMark);
    else drawTile(ctx, world, x, y, tileId, cam);
  }
}

// Procedural grid lines: nothing is stored, they are worked out from the camera.
// Shown at every zoom level; when zoomed far out the cell lines get fainter
// so they don't drown out the map, while every 10th line stays clear.
function drawGrid(ctx, range, cam, width, height) {
  const minor = cam.zoom < 8 ? COLORS.gridFar : COLORS.grid;
  const lineColor = (n) => (n === 0 ? COLORS.axis : n % 10 === 0 ? COLORS.gridMajor : minor);
  for (let x = range.minX; x <= range.maxX + 1; x++) {
    ctx.fillStyle = lineColor(x);
    ctx.fillRect(cellToScreen(cam, x, 0).x, 0, 1, height);
  }
  for (let y = range.minY; y <= range.maxY + 1; y++) {
    ctx.fillStyle = lineColor(y);
    ctx.fillRect(0, cellToScreen(cam, 0, y).y, width, 1);
  }
}

// An object is drawn with its sprite if one exists, otherwise as a colored
// square with a short label (CLAUDE.md: objects must work without sprites).
function drawObject(ctx, obj, name, cam, selected) {
  const a = cellToScreen(cam, obj.x, obj.y);
  const b = cellToScreen(cam, obj.x + obj.w, obj.y + obj.h);
  const w = b.x - a.x;
  const h = b.y - a.y;

  const sprite = getSprite(obj.spriteKey);
  if (sprite) {
    ctx.drawImage(sprite, a.x, a.y, w, h);
  } else {
    ctx.fillStyle = obj.color || '#888888';
    ctx.fillRect(a.x, a.y, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; // darker bottom edge for a pixel-block look
    ctx.fillRect(a.x, b.y - Math.max(2, cam.zoom / 8), w, Math.max(2, cam.zoom / 8));
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x + 1, a.y + 1, w - 2, h - 2);
  }

  if (selected) {
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 3;
    ctx.strokeRect(a.x - 2, a.y - 2, w + 4, h + 4);
  }

  drawLabel(ctx, name, a.x + w / 2, a.y + h / 2, w);
}

// Outline style (Regions on the World Map): only a border and the name, so
// the painted terrain underneath stays visible. A sprite, if set, still wins.
function drawOutlineObject(ctx, obj, name, cam, selected) {
  if (getSprite(obj.spriteKey)) return drawObject(ctx, obj, name, cam, selected);
  const a = cellToScreen(cam, obj.x, obj.y);
  const b = cellToScreen(cam, obj.x + obj.w, obj.y + obj.h);
  const w = b.x - a.x;
  const h = b.y - a.y;
  const thick = Math.max(2, Math.min(4, Math.floor(cam.zoom / 8)));

  ctx.lineWidth = thick + 2; // dark edge so the border reads on any tile color
  ctx.strokeStyle = '#000';
  ctx.strokeRect(a.x + thick / 2, a.y + thick / 2, w - thick, h - thick);
  ctx.lineWidth = thick;
  ctx.strokeStyle = obj.color || '#888888';
  ctx.strokeRect(a.x + thick / 2, a.y + thick / 2, w - thick, h - thick);

  if (selected) {
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(a.x - 3, a.y - 3, w + 6, h + 6);
    ctx.setLineDash([]);
  }

  drawLabel(ctx, name, a.x + w / 2, a.y + h / 2, w, true);
}

// backed = draw a dark box behind the text so it reads over painted tiles.
function drawLabel(ctx, text, cx, cy, maxWidth, backed = false) {
  if (!text || maxWidth < 16) return;
  const size = Math.max(10, Math.min(14, Math.floor(maxWidth / 6)));
  ctx.font = `${size}px Consolas, 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let label = text;
  // Shorten long names to fit the object.
  while (label.length > 1 && ctx.measureText(label).width > maxWidth - 6) label = label.slice(0, -1);
  if (label !== text) label = label.slice(0, -1) + '…';
  if (backed) {
    const tw = Math.ceil(ctx.measureText(label).width) + 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(Math.round(cx - tw / 2), Math.round(cy - size / 2 - 3), tw, size + 6);
  }
  ctx.fillStyle = '#000';
  ctx.fillText(label, Math.round(cx) + 1, Math.round(cy) + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, Math.round(cx), Math.round(cy));
}
