// The interactive map: a canvas plus toolbar and status line, for any one
// container (World, Region or Biome). Holds only view state (camera, tool,
// selection, the drag in progress); world changes go through commands.
import { h } from '../ui/dom.js';
import { dispatch } from '../data/store.js';
import { centeredCamera, zoomAt, clampCamera } from './camera.js';
import { buildOccupancy, objectAtCell, fitsBounds, isSpaceFree } from './grid.js';
import { attachPointerEvents } from './mapPointer.js';
import { boardPanBox } from './mapFrame.js';
import { drawMap } from './renderer.js';
import { onSpriteLoad } from './sprites.js';
import { TOOLS } from './tools.js';
import { getCamera, setCamera } from './cameraStore.js';
import { getActiveView, setActiveView } from './mapKeyboard.js';
import { removeObject, setFootprint } from './mapCommands.js';
import { duplicatePlacement, objectName, placeableFor, withFootprint } from './placement.js';
import { objectKind, extraPlaceables, mapBadge } from './objectKinds.js';
import { childPreview } from './childPreview.js';
import { renderToolbar } from './mapToolbar.js';
import { renderMapDetail } from './mapPanels.js';
import { confirmRemoval } from './containerTree.js';
import { enterContainer } from '../ui/navigation.js';
import { clearPaintSelection, eraseSelectedPaint, selectionOutline, selectionHint } from './paintBlock.js';

// Kept outside the view so they survive redraws of the screen.
// placeTypeIds: the Region / Biome type chosen for each placeable.
// paintSelection: the Ctrl+drag box around paint (paintBlock.js).
const state = { tool: 'select', tileTypeId: null, placeableId: null, placeTypeIds: {}, selectedId: null, paintSelection: null };
const selections = new Map(); // containerId -> selected object id, so each map keeps its selection

// Selects an object on a map before that map is opened (the Buildings
// tab's "Show" button).
export function rememberSelection(containerId, objectId) {
  // Close the last map first: closing saves its own selection, which would
  // otherwise overwrite this one.
  getActiveView()?.destroy();
  selections.set(containerId, objectId);
}

// detailPanel: the right-hand panel element this view fills in.
// placeables: what the Place tool can put on this map (from a JSON table).
// header:     optional element shown above the toolbar (the breadcrumb).
// infoPanels: { [containerKind]: (world, container) => nodes } the info shown
//             when a Region or Biome object is selected.
// idlePanel:  optional (view) => nodes shown when nothing is selected.
// frame:      optional { bounds, backdrop, board } for a map with edges (the
//             Region and Biome Maps, see mapFrame.js). Nothing can be painted
//             or placed outside bounds; backdrop (the inherited base layer) is
//             drawn underneath the map's own paint; board = framed board with
//             panning limited to it (Biome Map).
export function mountMapView({ world, containerId, placeables, detailPanel, header = null, infoPanels = {}, idlePanel = null, frame = null }) {
  getActiveView()?.destroy();
  const container = world.containers[containerId];
  // Systems can add placeables to a kind of map (Buildings on Biome Maps).
  placeables = [...placeables, ...extraPlaceables(container.kind)];
  state.selectedId = selections.get(containerId) ?? null;
  fixStaleState(world, containerId, placeables);

  const canvas = h('canvas', { class: 'map-canvas' });
  const ctx = canvas.getContext('2d');
  const toolbar = h('div', { class: 'map-toolbar' });
  const wrap = h('div', { class: 'map-canvas-wrap' }, canvas);
  const status = h('div', { class: 'map-status small' });
  const root = h('div', { class: 'map-view' }, header, toolbar, wrap, status);

  // Zones (Regions, Biomes, Areas) are outlines that other objects can sit inside.
  const isZone = (obj) => placeableFor(world, placeables, obj)?.layer === 'zone';
  const occupancy = buildOccupancy(world, container, isZone);
  const panBox = frame?.board ? boardPanBox(world, container, frame.bounds) : null;
  const previews = new Map(); // object id -> mini preview of its child map (worked out once per view)

  let drawRequest = 0; // pending requestAnimationFrame id
  const view = {
    world,
    container,
    placeables,
    infoPanels,
    idlePanel,
    state,
    canvas,
    occupancy,
    // The occupancy layer an object blocks others in.
    layerOf: (obj) => (isZone(obj) ? occupancy.zone : occupancy.solid),
    // True if a footprint is inside the map's edges (always, on unbounded maps).
    inBounds: (x, y, w = 1, h = 1) => fitsBounds(frame?.bounds, x, y, w, h),
    drag: null, // { type: 'pan' | 'move' | 'stroke', ... } while the mouse is held
    hoverCell: null,
    ghost: null,
    stroke: null,
    notice: null, // a short message shown in the status line
    get camera() {
      return getCamera(containerId);
    },
    set camera(cam) {
      // On a framed board the view can't wander off the board.
      setCamera(containerId, panBox && canvas.width ? clampCamera(cam, panBox, canvas.width, canvas.height) : cam);
    },
    requestDraw() {
      if (!drawRequest) drawRequest = requestAnimationFrame(() => ((drawRequest = 0), draw()));
    },
    refreshUi() {
      // filter(Boolean) drops empty parts (replaceChildren would print "null").
      toolbar.replaceChildren(...renderToolbar(view).filter(Boolean));
      detailPanel.replaceChildren(...renderMapDetail(view).filter(Boolean));
      canvas.style.cursor = state.tool === 'pan' ? 'grab' : state.tool === 'select' ? 'default' : 'crosshair';
    },
    select(id) {
      if (state.selectedId === id) return;
      state.selectedId = id;
      view.refreshUi();
      view.requestDraw();
    },
    setTool(id) {
      state.tool = id;
      view.ghost = null;
      view.refreshUi();
      view.requestDraw();
    },
    startPan(sx, sy) {
      view.drag = { type: 'pan', lastX: sx, lastY: sy };
    },
    zoomBy(direction) {
      view.camera = zoomAt(view.camera, canvas.width / 2, canvas.height / 2, direction);
      view.refreshUi();
      view.requestDraw();
    },
    centerOnOrigin() {
      view.camera = centeredCamera(0, 0, canvas.width, canvas.height, view.camera.zoom);
      view.requestDraw();
    },
    removeSelected() {
      if (eraseSelectedPaint(view)) return; // Delete with a paint selection erases its paint
      if (!state.selectedId || !confirmRemoval(world, state.selectedId)) return;
      const id = state.selectedId;
      state.selectedId = null;
      dispatch(removeObject(world, id));
    },
    // Opens the map inside a Region or Biome object (next map tab).
    enter(id) {
      const refId = world.placedObjects[id]?.refId;
      if (refId && world.containers[refId]) enterContainer(world, refId);
    },
    enterSelected() {
      if (state.selectedId) view.enter(state.selectedId);
    },
    // Turns a non-square object a quarter turn around its center.
    rotateSelected() {
      const obj = world.placedObjects[state.selectedId];
      if (!obj || obj.w === obj.h) return;
      const rect = {
        x: obj.x + Math.floor((obj.w - obj.h) / 2),
        y: obj.y + Math.floor((obj.h - obj.w) / 2),
        w: obj.h,
        h: obj.w,
      };
      if (!view.inBounds(rect.x, rect.y, rect.w, rect.h)) return view.showNotice('Cannot rotate: it would go past the edge of the map.');
      if (!isSpaceFree(view.layerOf(obj), rect.x, rect.y, rect.w, rect.h, obj.id)) return view.showNotice('Cannot rotate: something is in the way.');
      dispatch(withFootprint(world, obj, rect, setFootprint(world, obj.id, rect, objectName(world, obj), 'Rotated')));
    },
    showNotice(text) {
      view.notice = text;
      view.requestDraw();
      setTimeout(() => {
        if (view.notice === text) view.notice = null;
        view.requestDraw();
      }, 3000);
    },
    duplicateSelected() {
      if (!state.selectedId) return;
      const command = duplicatePlacement(world, state.selectedId, view.layerOf(world.placedObjects[state.selectedId]), view.inBounds);
      if (!command) return;
      state.selectedId = command.payload.object.id;
      dispatch(command);
    },
    cancel() {
      if (view.drag) {
        view.drag = null;
        view.ghost = null;
        view.stroke = null;
        view.requestDraw();
      } else if (!clearPaintSelection(view)) {
        view.select(null);
      }
    },
    destroy() {
      selections.set(containerId, state.selectedId);
      resizeObserver.disconnect();
      stopSpriteListener();
      cancelAnimationFrame(drawRequest);
      if (getActiveView() === view) setActiveView(null);
    },
  };

  function draw() {
    if (!view.camera || canvas.width === 0) return;
    // The name of whatever is under the cursor, shown beside it.
    const hoverId = !view.drag && view.hoverCell && objectAtCell(occupancy, view.hoverCell.x, view.hoverCell.y);
    const hoverObj = hoverId && world.placedObjects[hoverId];
    drawMap(ctx, canvas.width, canvas.height, world, container, {
      camera: view.camera,
      selectedId: state.selectedId,
      hoverCell: view.hoverCell,
      ghost: view.ghost,
      stroke: view.stroke,
      paintSelection: selectionOutline(view),
      objectName: (obj) => objectName(world, obj),
      // Each map's placeables.json decides how a kind is drawn there.
      displayOf: (obj) => placeableFor(world, placeables, obj)?.display ?? 'block',
      isZone,
      // A registered kind (a building) draws its own placeholder.
      customDraw: (obj) => {
        const draw = objectKind(obj.kind)?.draw;
        return draw && ((ctx, rect, opts) => draw(ctx, world, obj, rect, opts));
      },
      // Regions and Biomes show a mini preview of their own map inside their outline.
      previewOf: (obj) => {
        if (!previews.has(obj.id)) previews.set(obj.id, childPreview(world, obj));
        return previews.get(obj.id);
      },
      badgeOf: (obj) => mapBadge(world, obj),
      hoverLabel: hoverObj ? { text: objectName(world, hoverObj), x: view.hoverCell.x, y: view.hoverCell.y } : null,
      bounds: frame?.bounds,
      backdrop: frame?.backdrop,
      board: frame?.board,
    });
    const cell = view.hoverCell ? `Cell ${view.hoverCell.x}, ${view.hoverCell.y}` : 'Cell -';
    const tool = TOOLS.find((t) => t.id === state.tool);
    status.textContent = `${cell}   |   Zoom ${view.camera.zoom}px   |   ${view.notice ?? selectionHint(view) ?? tool.hint}`;
    status.classList.toggle('notice', !!view.notice);
  }

  // The canvas is drawn at its on-screen size, so one canvas pixel is one CSS pixel.
  const resizeObserver = new ResizeObserver(() => {
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    if (!view.camera) {
      view.camera = centeredCamera(0, 0, canvas.width, canvas.height);
      view.refreshUi(); // shows the zoom level now that there is a camera
    } else if (panBox) {
      view.camera = view.camera; // re-applies the board's pan limit for the new size
    }
    draw(); // resizing clears the canvas, so draw right away
  });
  resizeObserver.observe(wrap);
  const stopSpriteListener = onSpriteLoad(() => view.requestDraw());

  attachPointerEvents(view, canvas);
  view.refreshUi();
  setActiveView(view);
  return root;
}

// Drop remembered choices that no longer exist (deleted tile type, undone object...).
function fixStaleState(world, containerId, placeables) {
  if (!world.definitions.tileTypes[state.tileTypeId]) {
    state.tileTypeId = Object.keys(world.definitions.tileTypes)[0] ?? null;
  }
  if (!placeables.some((p) => p.id === state.placeableId)) state.placeableId = placeables[0]?.id ?? null;
  if (world.placedObjects[state.selectedId]?.containerId !== containerId) state.selectedId = null;
}
