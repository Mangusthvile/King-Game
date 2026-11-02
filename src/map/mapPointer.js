// Mouse and wheel handling for a map view (see mapView.js): pan, zoom at
// the cursor, double-click to enter, and handing clicks and drags to the
// current tool (tools.js). Ctrl+drag selects and moves paint (paintBlock.js).
import { screenToCell, panBy, zoomAt } from './camera.js';
import { objectAtCell } from './grid.js';
import { toolHandlers } from './tools.js';
import { paintBlock, clearPaintSelection } from './paintBlock.js';

const isBlockDrag = (drag) => drag?.type === 'blockSelect' || drag?.type === 'blockMove';

export function attachPointerEvents(view, canvas) {
  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { sx, sy, cell: screenToCell(view.camera, sx, sy) };
  };
  // The handler for the drag in progress: a paint block drag, or the tool.
  const tool = () => (isBlockDrag(view.drag) ? paintBlock : toolHandlers[view.state.tool]);

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const { sx, sy, cell } = local(e);
    // Middle or right drag always pans, whatever the tool.
    if (e.button === 1 || e.button === 2 || view.state.tool === 'pan') view.startPan(sx, sy);
    else if (e.button === 0 && (e.ctrlKey || e.metaKey)) paintBlock.down(view, cell);
    else if (e.button === 0) {
      clearPaintSelection(view); // a plain click ends the paint selection
      tool().down?.(view, cell, sx, sy);
    }
    view.requestDraw();
  });

  canvas.addEventListener('pointermove', (e) => {
    const { sx, sy, cell } = local(e);
    view.hoverCell = cell;
    const drag = view.drag;
    if (drag?.type === 'pan') {
      view.camera = panBy(view.camera, sx - drag.lastX, sy - drag.lastY);
      drag.lastX = sx;
      drag.lastY = sy;
    } else if (drag) {
      tool().move?.(view, cell);
    } else {
      tool().hover?.(view, cell);
    }
    view.requestDraw();
  });

  const finish = (e) => {
    const drag = view.drag;
    if (!drag) return;
    // up() may dispatch a command, which rebuilds the screen with a new view.
    // That's fine: this old view is simply thrown away afterwards.
    if (drag.type !== 'pan') tool().up?.(view, local(e).cell);
    view.drag = null;
    view.requestDraw();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', () => view.cancel());

  canvas.addEventListener('pointerleave', () => {
    view.hoverCell = null;
    if (!view.drag) view.ghost = null;
    view.requestDraw();
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault(); // stop the page from scrolling
      const { sx, sy } = local(e);
      view.camera = zoomAt(view.camera, sx, sy, e.deltaY < 0 ? 1 : -1);
      view.refreshUi();
      view.requestDraw();
    },
    { passive: false },
  );

  // Double-click a Region or Biome to enter it.
  canvas.addEventListener('dblclick', (e) => {
    if (view.state.tool !== 'select') return;
    const { cell } = local(e);
    const id = objectAtCell(view.occupancy, cell.x, cell.y);
    if (id) view.enter(id);
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
