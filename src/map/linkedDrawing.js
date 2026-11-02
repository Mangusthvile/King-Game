// Drawing for linked map levels (see mapFrame.js): the mini preview of a
// child map inside its outline, the name tag of the hovered object, and the
// frame around a framed board (Biome Map). Used by renderer.js.
import { cellToScreen } from './camera.js';

const COLORS = {
  edge: '#d9b37a',
  boardDark: '#3b2414', // the board frame's inner line
  tooltip: 'rgba(16, 12, 9, 0.92)',
};

// The child map's own paint and objects, shrunk into its outline.
export function drawPreview(ctx, obj, rects, cam) {
  if (!rects?.length) return;
  const a = cellToScreen(cam, obj.x, obj.y);
  const b = cellToScreen(cam, obj.x + obj.w, obj.y + obj.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.clip();
  const z = cam.zoom;
  for (const r of rects) {
    const x = a.x + r.x * z;
    const y = a.y + r.y * z;
    // At least one pixel, so tiny objects still show.
    const w = Math.max(1, r.w * z);
    const h = Math.max(1, r.h * z);
    if (r.outline) {
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
    } else {
      ctx.fillStyle = r.color;
      ctx.fillRect(x, y, w, h);
    }
  }
  ctx.restore();
}

// A small name tag just right of and above the hovered cell.
export function drawTooltip(ctx, label, cam, width) {
  const p = cellToScreen(cam, label.x + 1, label.y);
  ctx.font = `12px Consolas, 'Courier New', monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const tw = Math.ceil(ctx.measureText(label.text).width) + 10;
  const x = Math.min(p.x + 4, width - tw - 2);
  const y = Math.max(2, p.y - 20);
  ctx.fillStyle = COLORS.tooltip;
  ctx.fillRect(x, y, tw, 18);
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, 17);
  ctx.fillStyle = '#fff';
  ctx.fillText(label.text, x + 5, y + 9);
}

// Dark outer line, a wide light frame, then a dark inner line, all outside
// the board's cells so nothing on the board is covered.
export function drawBoardFrame(ctx, a, b) {
  const ring = (offset, lineWidth, color) => {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.strokeRect(a.x - offset, a.y - offset, b.x - a.x + offset * 2, b.y - a.y + offset * 2);
  };
  ring(9, 4, '#000');
  ring(5, 6, COLORS.edge);
  ring(1.5, 3, COLORS.boardDark);
}
