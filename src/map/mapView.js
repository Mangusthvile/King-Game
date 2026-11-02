// The interactive map: a canvas plus toolbar and status line, for any one
// container (World, Region or Sub-Area). Holds only view state (camera, tool,
// selection, the drag in progress); world changes go through commands.
import { h } from '../ui/dom.js';
import { dispatch } from '../data/store.js';
import { centeredCamera, screenToCell, panBy, zoomAt } from './camera.js';
import { buildOccupancy } from './grid.js';
import { drawMap } from './renderer.js';
import { onSpriteLoad } from './sprites.js';
import { TOOLS, toolHandlers } from './tools.js';
import { removeObject } from './mapCommands.js';
import { duplicatePlacement, objectName } from './placement.js';
import { renderToolbar } from './mapToolbar.js';
import { renderMapDetail } from './mapPanels.js';

const PAN_SPEED = 600; // screen pixels per second for WASD / arrow keys

// Kept outside the view so they survive redraws of the screen. Every
// container remembers its own camera.
const cameras = new Map(); // containerId -> { x, y, zoom }
const state = { tool: 'select', tileTypeId: null, placeableId: null, selectedId: null };

let activeView = null; // the map currently on screen, for keyboard shortcuts

// detailPanel: the right-hand panel element this view fills in.
// placeables: what the Place tool can put on this map (from a JSON table).
export function mountMapView({ world, containerId, placeables, detailPanel }) {
  activeView?.destroy();
  const container = world.containers[containerId];
  fixStaleState(world, containerId, placeables);

  const canvas = h('canvas', { class: 'map-canvas' });
  const ctx = canvas.getContext('2d');
  const toolbar = h('div', { class: 'map-toolbar' });
  const wrap = h('div', { class: 'map-canvas-wrap' }, canvas);
  const status = h('div', { class: 'map-status small' });
  const root = h('div', { class: 'map-view' }, toolbar, wrap, status);

  let frame = 0;
  const view = {
    world,
    container,
    placeables,
    state,
    canvas,
    occupancy: buildOccupancy(world, container),
    drag: null, // { type: 'pan' | 'move' | 'stroke', ... } while the mouse is held
    hoverCell: null,
    ghost: null,
    stroke: null,
    get camera() {
      return cameras.get(containerId);
    },
    set camera(cam) {
      cameras.set(containerId, cam);
    },
    requestDraw() {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), draw()));
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
      if (!state.selectedId) return;
      const id = state.selectedId;
      state.selectedId = null;
      dispatch(removeObject(world, id));
    },
    duplicateSelected() {
      if (!state.selectedId) return;
      const command = duplicatePlacement(world, state.selectedId);
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
      resizeObserver.disconnect();
      stopSpriteListener();
      cancelAnimationFrame(frame);
      if (activeView === view) activeView = null;
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
      displayOf: (obj) => placeables.find((p) => p.kind === obj.kind)?.display ?? 'block',
    });
    const cell = view.hoverCell ? `Cell ${view.hoverCell.x}, ${view.hoverCell.y}` : 'Cell -';
    const tool = TOOLS.find((t) => t.id === state.tool);
    status.textContent = `${cell}   |   Zoom ${view.camera.zoom}px   |   ${tool.hint}`;
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
  activeView = view;
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

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- Keyboard (registered once for the whole app) ----

const PAN_KEYS = {
  w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
  arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0],
};
const heldKeys = new Set();
let panLoopRunning = false;

function liveView() {
  return activeView && activeView.canvas.isConnected ? activeView : null;
}

window.addEventListener('keydown', (e) => {
  const view = liveView();
  if (!view || e.target.matches?.('input, textarea, select')) return;
  const key = e.key.toLowerCase();

  if (e.ctrlKey || e.metaKey) {
    if (key === 'd') {
      e.preventDefault(); // otherwise the browser bookmarks the page
      view.duplicateSelected();
    }
    return; // Ctrl+Z / Ctrl+Y are handled in main.js
  }
  if (PAN_KEYS[key]) {
    e.preventDefault();
    heldKeys.add(key);
    startPanLoop();
  } else if (key === 'delete' || key === 'backspace') {
    e.preventDefault();
    view.removeSelected();
  } else if (key === 'escape') {
    view.cancel();
  } else {
    const tool = TOOLS.find((t) => t.key === key);
    if (tool) view.setTool(tool.id);
  }
});

window.addEventListener('keyup', (e) => heldKeys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => heldKeys.clear());

// Pans smoothly every frame while a pan key is held.
function startPanLoop() {
  if (panLoopRunning) return;
  panLoopRunning = true;
  let last = performance.now();
  const step = (now) => {
    const view = liveView();
    if (!view || heldKeys.size === 0) {
      panLoopRunning = false;
      return;
    }
    const seconds = Math.min(0.1, (now - last) / 1000);
    last = now;
    let dx = 0;
    let dy = 0;
    for (const key of heldKeys) {
      dx += PAN_KEYS[key][0];
      dy += PAN_KEYS[key][1];
    }
    // panBy moves the content, so move it opposite to the direction we look.
    view.camera = panBy(view.camera, -dx * PAN_SPEED * seconds, -dy * PAN_SPEED * seconds);
    view.requestDraw();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
