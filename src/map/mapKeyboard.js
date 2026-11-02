// Keyboard shortcuts for the map on screen: WASD panning, tool keys,
// Delete, Esc, Enter and Ctrl+D. Registered once for the whole app.
import { panBy } from './camera.js';
import { TOOLS } from './tools.js';

const PAN_SPEED = 600; // screen pixels per second for WASD / arrow keys

let activeView = null; // the map currently on screen

export function setActiveView(view) {
  activeView = view;
}

export function getActiveView() {
  return activeView;
}

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
  } else if (key === 'enter' && !e.target.matches?.('button')) {
    // (On a focused button, Enter already presses that button.)
    view.enterSelected();
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
