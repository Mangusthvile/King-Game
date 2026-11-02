// What each map tool does with the mouse. Every handler gets the map view
// (see mapView.js) and the cell under the cursor. Tools only build commands
// and hand them to dispatch; they never change the world themselves.
import { dispatch } from '../data/store.js';
import { cellKey, isSpaceFree, lineCells, objectAtCell } from './grid.js';
import { paintTiles, removeObject, moveObject } from './mapCommands.js';
import { newPlacement, objectName, placementTypeId, sizedPlaceable, withFootprint } from './placement.js';
import { confirmRemoval } from './containerTree.js';

// key = keyboard shortcut. W, A, S and D are kept free for panning.
export const TOOLS = [
  { id: 'select', label: 'Select', key: 'v', hint: 'Click to select, drag to move. Drag empty space to pan.' },
  { id: 'pan', label: 'Pan', key: 'h', hint: 'Drag to move the view.' },
  { id: 'paint', label: 'Paint', key: 'b', hint: 'Click or drag to paint tiles.' },
  { id: 'erase', label: 'Erase', key: 'e', hint: 'Click or drag to erase tiles.' },
  { id: 'place', label: 'Place', key: 'p', hint: 'Click to place at default size, or drag to draw its size.' },
  { id: 'remove', label: 'Remove', key: 'x', hint: 'Click an object to remove it.' },
];

const objectAt = (view, cell) => objectAtCell(view.occupancy, cell.x, cell.y);

// ---- Select and move ----

const select = {
  down(view, cell, sx, sy) {
    const id = objectAt(view, cell);
    if (!id) {
      view.select(null);
      view.startPan(sx, sy);
      return;
    }
    view.select(id);
    const obj = view.world.placedObjects[id];
    view.drag = { type: 'move', id, grabX: cell.x - obj.x, grabY: cell.y - obj.y };
  },
  move(view, cell) {
    const obj = view.world.placedObjects[view.drag.id];
    const x = cell.x - view.drag.grabX;
    const y = cell.y - view.drag.grabY;
    const moved = x !== obj.x || y !== obj.y;
    view.ghost = moved
      ? { x, y, w: obj.w, h: obj.h, ok: isSpaceFree(view.layerOf(obj), x, y, obj.w, obj.h, obj.id) && view.inBounds(x, y, obj.w, obj.h) }
      : null;
  },
  up(view) {
    const { ghost, drag } = view;
    view.ghost = null;
    if (!ghost || !ghost.ok) return; // dropped on another object: snap back
    const obj = view.world.placedObjects[drag.id];
    const move = moveObject(view.world, obj.id, ghost.x, ghost.y, objectName(view.world, obj));
    dispatch(withFootprint(view.world, obj, { x: ghost.x, y: ghost.y }, move));
  },
};

// ---- Paint and erase (one command per stroke) ----

function brushTile(view) {
  return view.state.tool === 'erase' ? null : view.state.tileTypeId;
}

const brush = {
  down(view, cell) {
    if (view.state.tool === 'paint' && !view.state.tileTypeId) return; // no tile type chosen
    // Cells outside the map's edges (Region Map) are skipped.
    view.stroke = new Map(view.inBounds(cell.x, cell.y) ? [[cellKey(cell.x, cell.y), brushTile(view)]] : []);
    view.drag = { type: 'stroke', last: cell };
  },
  move(view, cell) {
    const tile = brushTile(view);
    const { last } = view.drag;
    for (const c of lineCells(last.x, last.y, cell.x, cell.y)) {
      if (view.inBounds(c.x, c.y)) view.stroke.set(cellKey(c.x, c.y), tile);
    }
    view.drag.last = cell;
  },
  up(view) {
    const stroke = view.stroke;
    view.stroke = null;
    const tileName = view.world.definitions.tileTypes[view.state.tileTypeId]?.name ?? '';
    const command = paintTiles(view.world, view.container.id, stroke, tileName);
    if (command) dispatch(command);
  },
};

// ---- Place ----

// With the default size of the chosen type (a building type's footprint).
function currentPlaceable(view) {
  const p = view.placeables.find((x) => x.id === view.state.placeableId);
  return sizedPlaceable(view.world, view.state, p);
}

// Click to place at the default size, or drag a rectangle to choose the size.
function placeGhost(view, p, start, end) {
  const dragged = end && (end.x !== start.x || end.y !== start.y);
  const x = dragged ? Math.min(start.x, end.x) : start.x;
  const y = dragged ? Math.min(start.y, end.y) : start.y;
  const w = dragged ? Math.abs(end.x - start.x) + 1 : p.w;
  const h = dragged ? Math.abs(end.y - start.y) + 1 : p.h;
  const layer = p.layer === 'zone' ? view.occupancy.zone : view.occupancy.solid;
  return { x, y, w, h, ok: isSpaceFree(layer, x, y, w, h) && view.inBounds(x, y, w, h) };
}

const place = {
  hover(view, cell) {
    const p = currentPlaceable(view);
    view.ghost = p && placeGhost(view, p, cell);
  },
  down(view, cell) {
    const p = currentPlaceable(view);
    if (!p) return;
    view.drag = { type: 'place', start: cell };
    view.ghost = placeGhost(view, p, cell);
  },
  move(view, cell) {
    view.ghost = placeGhost(view, currentPlaceable(view), view.drag.start, cell);
  },
  up(view) {
    const p = currentPlaceable(view);
    const g = view.ghost;
    if (!p || !g || !g.ok) return;
    const typeId = placementTypeId(view.world, view.state, p);
    const command = newPlacement(view.world, view.container.id, { ...p, w: g.w, h: g.h }, g.x, g.y, typeId);
    view.state.selectedId = command.payload.object.id; // select what was just placed
    dispatch(command);
  },
};

// ---- Remove ----

const remove = {
  down(view, cell) {
    const id = objectAt(view, cell);
    if (!id || !confirmRemoval(view.world, id)) return;
    view.drag = null; // the confirm dialog may swallow the mouse release
    if (view.state.selectedId === id) view.state.selectedId = null;
    dispatch(removeObject(view.world, id));
  },
};

export const toolHandlers = { select, pan: {}, paint: brush, erase: brush, place, remove };
