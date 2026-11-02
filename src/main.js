// Entry point: decides which screen to show and wires global shortcuts.
import './styles.css';
import './commands/worldCommands.js'; // registers the world command types
import './commands/recordCommands.js'; // generic field / record commands
import './commands/customFieldCommands.js'; // Arbiter-made custom fields
import './systems/registry.js'; // every game system and its commands
import { getWorld, openWorld, closeWorld, subscribe, undo, redo } from './data/store.js';
import { renderWorldList } from './ui/worldListScreen.js';
import { renderWorldScreen, updateSaveStatus } from './ui/worldScreen.js';
import { setNavigationListener } from './ui/navigation.js';
import { attachFileSync, closeFileSync, setSyncCloseHandler } from './sync/fileSync.js';

const root = document.getElementById('app');

// Opening a world also connects it to its world file, if it has one.
function open(world) {
  openWorld(world);
  attachFileSync(world);
}

// Leaving a world saves it to its file and clears the "open on" marker.
async function back() {
  await closeFileSync();
  await closeWorld();
}
setSyncCloseHandler(() => closeWorld()); // "Back to worlds" in the open-elsewhere warning

function render() {
  const world = getWorld();
  if (world) {
    renderWorldScreen(root, world, { onBack: back });
  } else {
    renderWorldList(root, { onOpen: open });
  }
}

// A world change redraws the screen; a save-status change only updates its label.
subscribe((kind) => (kind === 'save' ? updateSaveStatus() : render()));
setNavigationListener(render); // changing tab, or entering a Region / Biome

// Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) for undo and redo, except while typing.
window.addEventListener('keydown', (e) => {
  if (!getWorld() || !(e.ctrlKey || e.metaKey)) return;
  if (e.target.matches('input, textarea, select')) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault();
    redo();
  }
});

render();
