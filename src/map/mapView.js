// The interactive map: a canvas plus toolbar and status line, for any one
// container (World, Region or Biome). Holds only view state (camera, tool,
// selection, the drag in progress); world changes go through commands.
import { h } from '../ui/dom.js';
import { dispatch } from '../data/store.js';
import { centeredCamera, screenToCell, panBy, zoomAt } from './camera.js';
import { buildOccupancy, objectAtCell, fitsBounds, isSpaceFree } from './grid.js';
import { drawMap } from './renderer.js';
import { onSpriteLoad } from './sprites.js';
import { TOOLS, toolHandlers } from './tools.js';
import { getCamera, setCamera } from './cameraStore.js';
import { getActiveView, setActiveView } from './mapKeyboard.js';
import { removeObject, setFootprint } from './mapCommands.js';
import { duplicatePlacement, objectName, placeableFor, withFootprint } from './placement.js';
import { objectKind, extraPlaceables } from './objectKinds.js';
import { renderToolbar } from './mapToolbar.js';
import { renderMapDetail } from './mapPanels.js';
import { confirmRemoval } from './containerTree.js';
import { enterContainer } from '../ui/navigation.js';

// Kept outside the view so they survive redraws of the screen.
// placeTypeIds: the Region / Biome type chosen for each placeable.
const state = { tool: 'select', tileTypeId: null, placeableId: null, placeTypeIds: {}, selectedId: null };
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
// frame:      optional { bounds, backdrop } for a map with edges (the Region
//             Map, see regionFrame.js). Nothing can be painted or placed
//             outside bounds; backdrop is drawn underneath the map.
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
      setCamera(containerId, cam);
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
      } else {
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
    drawMap(ctx, canvas.width, canvas.height, world, container, {
      camera: view.camera,
      selectedId: state.selectedId,
      hoverCell: view.hoverCell,
      ghost: view.ghost,
      stroke: view.stroke,
      objectName: (obj) => objectName(world, obj),
      // Each map's placeables.json decides how a kind is drawn there.
      displayOf: (obj) => placeableFor(world, placeables, obj)?.display ?? 'block',
      isZone,
      // A registered kind (a building) draws its own placeholder.
      customDraw: (obj) => {
        const draw = objectKind(obj.kind)?.draw;
        return draw && ((ctx, rect, opts) => draw(ctx, world, obj, rect, opts));
      },
      bounds: frame?.bounds,
      backdrop: frame?.backdrop,
    });
    const cell = view.hoverCell ? `Cell ${view.hoverCell.x}, ${view.hoverCell.y}` : 'Cell -';
    const tool = TOOLS.find((t) => t.id === state.tool);
    status.textContent = `${cell}   |   Zoom ${view.camera.zoom}px   |   ${view.notice ?? tool.hint}`;
    status.classList.toggle('notice', !!view.notice);
  }

  // The canvas is drawn at its on-screen size, so one canvas pixel is one CSS pixel.
  const resizeObserver = new ResizeObserver(() => {
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    if (!view.camera) {
      view.camera = centeredCamera(0, 0, canvas.width, canvas.height);
      view.refreshUi(); // shows the zoom level now that there is a camera
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

function attachPointerEvents(view, canvas) {
  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { sx, sy, cell: screenToCell(view.camera, sx, sy) };
  };
  const tool = () => toolHandlers[view.state.tool];

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const { sx, sy, cell } = local(e);
    // Middle or right drag always pans, whatever the tool.
    if (e.button === 1 || e.button === 2 || view.state.tool === 'pan') view.startPan(sx, sy);
    else if (e.button === 0) tool().down?.(view, cell, sx, sy);
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
