// Placeholder look for a building until Stage 9: a block in its category's
// color, patterned by construction stage, with its name and a progress bar.
//   Empty Site:         dashed outline only
//   Foundation:         hatched
//   Under Construction: lower part filled, the rest hatched
//   Completed:          solid block
import { drawLabel } from '../../map/renderer.js';
import { shownStage } from './stages.js';

const OUTLINE = '#000';
const BAR_BACK = 'rgba(0, 0, 0, 0.65)';
const BAR_FILL = '#7fd36a';

// The block color: the object's own color if the Arbiter set one, else the
// category color of its type.
export function buildingColor(world, obj) {
  const building = world.buildings[obj.refId];
  const type = world.definitions.buildingTypes[building?.buildingTypeId];
  return obj.color || world.definitions.buildingCategories?.[type?.categoryId]?.color || '#888888';
}

// rect: the footprint on screen { x, y, w, h } in pixels.
export function drawBuilding(ctx, world, obj, rect, { name, zoom }) {
  const building = world.buildings[obj.refId];
  const type = world.definitions.buildingTypes[building?.buildingTypeId];
  const stage = building ? shownStage(building, type) : 'completed';
  const color = buildingColor(world, obj);
  const { x, y, w, h } = rect;
  const edge = Math.max(2, Math.min(4, Math.floor(zoom / 8)));

  if (stage === 'emptySite') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([Math.max(4, zoom / 3), Math.max(3, zoom / 5)]);
    outline(ctx, rect, color, edge);
    ctx.setLineDash([]);
  } else if (stage === 'foundation') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x, y, w, h);
    hatch(ctx, rect, color, zoom);
    outline(ctx, rect, color, edge);
  } else if (stage === 'underConstruction') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x, y, w, h);
    hatch(ctx, rect, color, zoom);
    // Filled from the bottom up, more as progress grows (but always partly).
    const share = Math.min(0.85, Math.max(0.35, (building?.constructionProgress ?? 50) / 100));
    const filled = Math.round(h * share);
    ctx.fillStyle = color;
    ctx.fillRect(x, y + h - filled, w, filled);
    outline(ctx, rect, color, edge);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; // darker bottom edge, like other blocks
    ctx.fillRect(x, y + h - Math.max(2, zoom / 8), w, Math.max(2, zoom / 8));
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  if (building && w >= 16 && h >= 16) progressBar(ctx, rect, building.constructionProgress, zoom);
  drawLabel(ctx, name, x + w / 2, y + h / 2 - Math.min(4, h / 10), w, stage !== 'completed');
}

// A dark line under a colored one, so the edge reads on any tile.
function outline(ctx, { x, y, w, h }, color, edge) {
  ctx.lineWidth = edge + 2;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeRect(x + edge / 2, y + edge / 2, w - edge, h - edge);
  ctx.lineWidth = edge;
  ctx.strokeStyle = color;
  ctx.strokeRect(x + edge / 2, y + edge / 2, w - edge, h - edge);
}

// Diagonal stripes clipped to the footprint.
function hatch(ctx, { x, y, w, h }, color, zoom) {
  const gap = Math.max(5, Math.floor(zoom / 3));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.floor(zoom / 14));
  ctx.beginPath();
  for (let i = -h; i < w; i += gap) {
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

function progressBar(ctx, { x, y, w, h }, progress, zoom) {
  const inset = Math.max(3, Math.floor(zoom / 6));
  const barH = Math.max(3, Math.floor(zoom / 8));
  const barW = w - inset * 2;
  const share = Math.min(1, Math.max(0, Number(progress) / 100 || 0));
  const top = Math.round(y + h - inset - barH);
  ctx.fillStyle = BAR_BACK;
  ctx.fillRect(Math.round(x + inset) - 1, top - 1, barW + 2, barH + 2);
  ctx.fillStyle = BAR_FILL;
  ctx.fillRect(Math.round(x + inset), top, Math.round(barW * share), barH);
}
