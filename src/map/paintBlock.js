// Grab and move blocks of paint, with Ctrl held (any tool except Pan):
//   Ctrl+drag             draw a selection box around painted cells
//   Ctrl+drag inside it   move the painted cells in the box (one undo step)
//   Delete                erase the painted cells in the box
//   Esc                   clear the box
// Only the map's own paint moves: the inherited base layer (mapFrame.js)
// belongs to the parent map. Empty cells in the box don't cover anything
// where they land. Like the tools, this only builds commands.
import { dispatch } from '../data/store.js';
import { cellKey } from './grid.js';
import { paintTiles } from './mapCommands.js';

// The box, kept in the map's shared state so it survives screen redraws:
// { containerId, x, y, w, h }. Only shown on the map it was drawn on.
export function paintSelection(view) {
  const sel = view.state.paintSelection;
  return sel?.containerId === view.container.id ? sel : null;
}

export function clearPaintSelection(view) {
  if (!view.state.paintSelection) return false;
  view.state.paintSelection = null;
  view.requestDraw();
  return true;
}

function inside(sel, cell) {
  return sel && cell.x >= sel.x && cell.x < sel.x + sel.w && cell.y >= sel.y && cell.y < sel.y + sel.h;
}

// The painted cells in a box: [{ x, y, tileId }].
function paintedCells(view, sel) {
  const tiles = view.container.tiles;
  const cells = [];
  for (let y = sel.y; y < sel.y + sel.h; y++) {
    for (let x = sel.x; x < sel.x + sel.w; x++) {
      const tileId = tiles[cellKey(x, y)];
      if (tileId) cells.push({ x, y, tileId });
    }
  }
  return cells;
}

// Cell key -> new tile (null = erased) for moving the cells by dx, dy:
// the old cells are cleared first, then the moved cells painted on top.
function moveStroke(cells, dx, dy) {
  const stroke = new Map();
  for (const c of cells) stroke.set(cellKey(c.x, c.y), null);
  for (const c of cells) stroke.set(cellKey(c.x + dx, c.y + dy), c.tileId);
  return stroke;
}

const boxBetween = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x) + 1,
  h: Math.abs(a.y - b.y) + 1,
});

// Pointer handlers, used by mapPointer.js while Ctrl is held.
export const paintBlock = {
  down(view, cell) {
    const sel = paintSelection(view);
    view.select(null); // the box replaces any object selection
    if (inside(sel, cell)) {
      view.drag = { type: 'blockMove', start: cell, cells: paintedCells(view, sel), dx: 0, dy: 0 };
    } else {
      view.drag = { type: 'blockSelect', start: cell };
      view.state.paintSelection = { containerId: view.container.id, ...boxBetween(cell, cell) };
    }
  },
  move(view, cell) {
    const drag = view.drag;
    if (drag.type === 'blockSelect') {
      view.state.paintSelection = { containerId: view.container.id, ...boxBetween(drag.start, cell) };
      return;
    }
    drag.dx = cell.x - drag.start.x;
    drag.dy = cell.y - drag.start.y;
    const moved = drag.dx !== 0 || drag.dy !== 0;
    // The painted cells may not land outside the map's edges.
    drag.ok = drag.cells.every((c) => view.inBounds(c.x + drag.dx, c.y + drag.dy));
    view.stroke = moved ? moveStroke(drag.cells, drag.dx, drag.dy) : null;
  },
  up(view) {
    const drag = view.drag;
    view.stroke = null;
    if (drag.type !== 'blockMove' || (drag.dx === 0 && drag.dy === 0)) return;
    if (!drag.ok) return view.showNotice('Cannot move the paint past the edge of the map.');
    const sel = paintSelection(view);
    // Move the box first: the command redraws the screen.
    view.state.paintSelection = { ...sel, x: sel.x + drag.dx, y: sel.y + drag.dy };
    const command = paintTiles(view.world, view.container.id, moveStroke(drag.cells, drag.dx, drag.dy), '', `Moved ${drag.cells.length} painted tile(s)`);
    if (command) dispatch(command);
  },
};

// Delete with a box: erases its painted cells. Returns false if there is no box.
export function eraseSelectedPaint(view) {
  const sel = paintSelection(view);
  if (!sel) return false;
  const cells = paintedCells(view, sel);
  const command = paintTiles(view.world, view.container.id, new Map(cells.map((c) => [cellKey(c.x, c.y), null])));
  if (command) dispatch(command);
  return true;
}

// For the renderer: the box, moved along while it is being dragged.
// { x, y, w, h, ok }
export function selectionOutline(view) {
  const sel = paintSelection(view);
  if (!sel) return null;
  const drag = view.drag?.type === 'blockMove' ? view.drag : null;
  return { x: sel.x + (drag?.dx ?? 0), y: sel.y + (drag?.dy ?? 0), w: sel.w, h: sel.h, ok: drag?.ok ?? true };
}

// The status line while there is a box.
export function selectionHint(view) {
  const sel = paintSelection(view);
  return sel && `Paint selection ${sel.w} x ${sel.h}: Ctrl+drag inside it to move the paint, Delete to erase it, Esc to clear.`;
}
