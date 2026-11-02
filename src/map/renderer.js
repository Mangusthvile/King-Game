// Draws one frame of a map: tiles, grid lines, objects and tool previews.
// Only what is inside the visible cell range is drawn.
import { cellToScreen, visibleRange } from './camera.js';
import { cellKey, parseKey, objectsIn } from './grid.js';
import { getSprite } from './sprites.js';
import { drawPreview, drawTooltip, drawBoardFrame } from './linkedDrawing.js';

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
  outside: 'rgba(0, 0, 0, 0.6)', // beyond the edge of a bounded map
  outsideBoard: 'rgba(0, 0, 0, 0.72)', // beyond a framed board (Biome Map)
  edge: '#d9b37a',
  board: '#241d17', // a framed board's unpainted ground
};

// view: { camera, selectedId, hoverCell, ghost, stroke, objectName(obj), displayOf(obj), isZone(obj) }
//   isZone:    zones (Areas) are drawn first, underneath everything on top of them
//   bounds:    optional { minX, minY, maxX, maxY } edges of a bounded map (Region Map)
//   backdrop:  optional [{ x, y, size, tileId }] big squares drawn under the map's own tiles
//              (the inherited base layer, see mapFrame.js)
//   board:     draw the bounds as a framed board (Biome Map)
//   previewOf: optional (obj) => [{ x, y, w, h, color, outline }] or null, the
//              mini preview of a child map drawn inside an outlined object
//   hoverLabel: optional { text, x, y } name shown beside the hovered cell
//   displayOf: 'block' (filled square) or 'outline' (border and name only)
//   customDraw: optional (obj) => draw(ctx, rect, { name, zoom }) or null, for
//              kinds that draw their own placeholder (buildings). A sprite still wins.
//   ghost:  { x, y, w, h, ok } preview of a place or move
//   stroke: Map of cell key -> tile id (or null) for the brush stroke in progress
export function drawMap(ctx, width, height, world, container, view) {
  const cam = view.camera;
  ctx.imageSmoothingEnabled = false; // pixel art
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  const range = visibleRange(cam, width, height);
  if (view.board && view.bounds) {
    const b = view.bounds;
    fillCells(ctx, cam, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY, COLORS.board);
  }
  for (const b of view.backdrop ?? []) drawTile(ctx, world, b.x, b.y, b.tileId, cam, b.size);
  drawTiles(ctx, world, container.tiles, range, cam);
  if (view.stroke) drawStroke(ctx, world, view.stroke, cam);
  drawGrid(ctx, range, cam, width, height);
  if (view.bounds) drawOutside(ctx, view.bounds, cam, width, height, view.board);

  const objects = objectsIn(world, container);
  const isZone = view.isZone ?? (() => false);
  const ordered = [...objects.filter(isZone), ...objects.filter((o) => !isZone(o))];
  for (const obj of ordered) {
    if (!overlapsRange(obj, range)) continue;
    const selected = obj.id === view.selectedId;
    const custom = !getSprite(obj.spriteKey) && view.customDraw?.(obj);
    if (custom) {
      drawCustom(ctx, obj, view.objectName(obj), cam, selected, custom);
      continue;
    }
    const outline = view.displayOf(obj) === 'outline';
    if (outline) drawPreview(ctx, obj, view.previewOf?.(obj), cam);
    const draw = outline ? drawOutlineObject : drawObject;
    draw(ctx, obj, view.objectName(obj), cam, selected);
  }

  if (view.hoverCell && !view.ghost) {
    fillCells(ctx, cam, view.hoverCell.x, view.hoverCell.y, 1, 1, COLORS.hover);
  }
  if (view.ghost) {
    const g = view.ghost;
    fillCells(ctx, cam, g.x, g.y, g.w, g.h, g.ok ? COLORS.ghostOk : COLORS.ghostBad);
  }
  if (view.hoverLabel) drawTooltip(ctx, view.hoverLabel, cam, width);
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

// size: how many cells wide the tile is drawn (1, or mapScale for a backdrop square).
function drawTile(ctx, world, x, y, tileId, cam, size = 1) {
  const sprite = getSprite(world.definitions.tileTypes[tileId]?.spriteKey);
  if (sprite) {
    const p = cellToScreen(cam, x, y);
    ctx.drawImage(sprite, p.x, p.y, cam.zoom * size, cam.zoom * size);
  } else {
    fillCells(ctx, cam, x, y, size, size, tileColor(world, tileId));
  }
}

// Shades everything beyond a bounded map's edges and outlines the edge.
// board = a thick frame around it, like a game board (Biome Map).
function drawOutside(ctx, bounds, cam, width, height, board = false) {
  const a = cellToScreen(cam, bounds.minX, bounds.minY);
  const b = cellToScreen(cam, bounds.maxX, bounds.maxY);
  const clamp = (n) => Math.max(0, n);
  ctx.fillStyle = board ? COLORS.outsideBoard : COLORS.outside;
  ctx.fillRect(0, 0, width, clamp(a.y)); // above
  ctx.fillRect(0, b.y, width, clamp(height - b.y)); // below
  ctx.fillRect(0, a.y, clamp(a.x), b.y - a.y); // left
  ctx.fillRect(b.x, a.y, clamp(width - b.x), b.y - a.y); // right
  if (board) return drawBoardFrame(ctx, a, b);
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(a.x - 1, a.y - 1, b.x - a.x + 2, b.y - a.y + 2);
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
// When zoomed far out the cell lines get fainter so they don't drown out
// the map, while every 10th line stays clear. Below 4px per cell only every
// 10th line is drawn (a line every cell would cover the map).
function drawGrid(ctx, range, cam, width, height) {
  const minor = cam.zoom < 4 ? null : cam.zoom < 8 ? COLORS.gridFar : COLORS.grid;
  const lineColor = (n) => (n === 0 ? COLORS.axis : n % 10 === 0 ? COLORS.gridMajor : minor);
  for (let x = range.minX; x <= range.maxX + 1; x++) {
    if (!lineColor(x)) continue;
    ctx.fillStyle = lineColor(x);
    ctx.fillRect(cellToScreen(cam, x, 0).x, 0, 1, height);
  }
  for (let y = range.minY; y <= range.maxY + 1; y++) {
    if (!lineColor(y)) continue;
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

// A kind that draws itself gets its screen rectangle; the selection box is
// drawn here so it looks the same everywhere.
function drawCustom(ctx, obj, name, cam, selected, draw) {
  const a = cellToScreen(cam, obj.x, obj.y);
  const b = cellToScreen(cam, obj.x + obj.w, obj.y + obj.h);
  const rect = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  ctx.save();
  draw(ctx, rect, { name, zoom: cam.zoom });
  ctx.restore();
  if (selected) {
    ctx.strokeStyle = COLORS.selected;
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
  }
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
export function drawLabel(ctx, text, cx, cy, maxWidth, backed = false) {
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
