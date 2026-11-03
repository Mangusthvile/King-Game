// System: the app around the world. Worlds (Open: this world's name and
// info and back to the world list; Save File: the world file sync; Import/
// Export: Export JSON and the seed data import; Backups), Display (Theme in
// Stage 8.5; Player View) and Preferences (this computer's Device Name and
// Autosave, and how many snapshots the world keeps).
import { h } from '../../ui/dom.js';
import { closeWorld } from '../../data/store.js';
import { closeFileSync } from '../../sync/fileSync.js';
import { isPlayerView, togglePlayerView } from '../../ui/factionSelector.js';
import { worldPanel, exportPanel, snapshotsPanel } from '../../ui/settingsTab.js';
import { worldFilePanel, backupsPanel, deviceNamePanel, autosavePanel } from '../../ui/fileSettings.js';
import { renderSeedImport } from '../characters/seedImportView.js';

const HELP = {
  worlds: 'Worlds are saved on this computer as you work. Save File keeps one in a synced folder for use on other computers.',
  display: 'How the app looks. The pixel UI kit comes in Stage 8.5.',
  preferences: 'Device Name and Autosave belong to this computer; Snapshots belong to the world.',
};

// A screen: its panels, and a line of help in the side panel.
const screen = (build) => (world, { detailPanel, path }) => {
  detailPanel.replaceChildren(h('h2', {}, 'System'), h('p', { class: 'muted small' }, HELP[path.split('/')[1]] ?? ''));
  const root = h('div', { class: 'tab-page' });
  const refresh = () => root.replaceChildren(...[build(world, refresh)].flat());
  refresh();
  return root;
};

function openPage(world) {
  const back = async () => {
    await closeFileSync();
    await closeWorld();
  };
  return [
    worldPanel(world),
    h('section', { class: 'frame panel' }, h('h2', {}, 'Other worlds'), h('p', { class: 'muted small' }, 'Create, open, import or delete worlds on the world list (the same as "< Worlds" in the top bar).'), h('button', { class: 'btn', onclick: back }, 'Go to the world list')),
  ];
}

function importExportPage(world, refresh) {
  return [exportPanel(world), h('section', { class: 'frame panel' }, h('h2', {}, 'Import seed data'), renderSeedImport(world, refresh))];
}

function playerViewPage(world) {
  const on = isPlayerView(world);
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Player View'),
    h('p', {}, on ? 'Player View is on.' : 'Player View is off.'),
    h('p', { class: 'muted small' }, 'Shows only the selected faction\'s own information, hides "All factions", the Codex and every Arbiter-only control, for screenshots to players. The top bar has the same button.'),
    h('button', { class: on ? 'btn active' : 'btn', onclick: () => togglePlayerView(world) }, on ? 'Turn Player View off' : 'Turn Player View on'),
  );
}

export default {
  id: 'settings',
  name: 'System',
  places: [
    { path: 'system/worlds/open', render: screen(openPage) },
    { path: 'system/worlds/saveFile', render: screen(() => worldFilePanel()) },
    { path: 'system/worlds/importExport', render: screen(importExportPage) },
    { path: 'system/worlds/backups', render: screen(() => backupsPanel()) },
    { path: 'system/display/playerView', render: screen(playerViewPage) },
    { path: 'system/preferences/deviceName', render: screen(() => deviceNamePanel()) },
    { path: 'system/preferences/autosave', render: screen(() => autosavePanel()) },
    { path: 'system/preferences/snapshots', render: screen(snapshotsPanel) },
  ],
};
