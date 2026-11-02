// The main screen for an open world: top bar, management tabs, content area
// and the right-hand detail panel.
import { h, restoreFocus } from './dom.js';
import { canUndo, canRedo, undo, redo, getSaveStatus } from '../data/store.js';
import { renderSettingsTab } from './settingsTab.js';
import { renderLogTab } from './logTab.js';
import { getSystemTabs } from '../systems/registry.js';
import { getNavigation, navigate } from './navigation.js';
import { getSyncState, checkNow, saveFileNow } from '../sync/fileSync.js';
import { getDeviceSettings } from '../sync/deviceSettings.js';

// Built-in tabs. Tabs without a render function are placeholders until a
// system in /src/systems provides a tab with the same id.
const BASE_TABS = [
  { id: 'world', label: 'World Map', stage: 1 },
  { id: 'region', label: 'Region Map', stage: 2 },
  { id: 'biome', label: 'Biome Map', stage: 2 },
  { id: 'buildings', label: 'Buildings', stage: 3 },
  { id: 'characters', label: 'Characters', stage: 4 },
  { id: 'projects', label: 'Projects', stage: 5 },
  { id: 'resources', label: 'Resources', stage: null }, // after the MVP
  { id: 'log', label: 'Log', render: renderLogTab },
  { id: 'settings', label: 'Settings', render: renderSettingsTab },
];

const systemTabs = getSystemTabs();
const TABS = [
  ...BASE_TABS.map((t) => systemTabs.find((s) => s.id === t.id) ?? t),
  ...systemTabs.filter((s) => !BASE_TABS.some((t) => t.id === s.id)),
];

const SAVE_TEXT = { saved: 'Saved', saving: 'Saving...', error: 'Save failed!' };

// The world file button (sync/fileSync.js statuses). 'off' hides it.
const FILE_TEXT = {
  unsupported: 'File: browser unsupported',
  permission: 'File: allow access',
  synced: 'File saved',
  pending: 'File: changes waiting',
  saving: 'File: saving...',
  paused: 'File changed elsewhere!',
  missing: 'File not found!',
  error: 'File save failed!',
};
const FILE_WARN = ['permission', 'paused', 'missing', 'error'];

// What clicking the file button does for each status.
function fileButtonClick() {
  const { status } = getSyncState();
  if (status === 'permission') checkNow(true);
  else if (status === 'pending' || status === 'error') saveFileNow();
  else if (status === 'synced' || status === 'paused') checkNow();
  else navigate({ tab: 'settings' });
}

function fileButtonTitle(sync) {
  const parts = [];
  if (sync.link) parts.push(`World file: ${sync.link.fileName}`);
  if (sync.fileSync?.lastSavedAt) parts.push(`Last saved by ${sync.fileSync.lastSavedBy} at ${new Date(sync.fileSync.lastSavedAt).toLocaleString()}`);
  if (sync.message) parts.push(sync.message);
  if (sync.status === 'pending' && !getDeviceSettings().autosave) parts.push('Autosave is off: click to save to the file.');
  else if (sync.status === 'synced') parts.push('Click to check for changes from other computers.');
  return parts.join('\n');
}

export function renderWorldScreen(root, world, { onBack }) {
  // The open tab lives in navigation.js so map tabs can switch it (entering
  // a Region opens the Region Map tab).
  const activeTab = getNavigation(world).tab;
  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const topBar = h(
    'header',
    { class: 'top-bar' },
    h('button', { class: 'btn small', onclick: onBack }, '< Worlds'),
    h('span', { class: 'label-tag' }, world.meta.name),
    h('span', { class: 'day-badge' }, `Day ${world.meta.currentDay}`),
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn small', disabled: !canUndo(), onclick: undo, title: 'Undo (Ctrl+Z)' }, 'Undo'),
    h('button', { class: 'btn small', disabled: !canRedo(), onclick: redo, title: 'Redo (Ctrl+Y)' }, 'Redo'),
    h('span', { class: 'save-status' }),
    h('button', { class: 'btn small file-status', onclick: fileButtonClick }),
  );
  updateSaveStatus(topBar);

  const tabBar = h(
    'nav',
    { class: 'tab-bar' },
    TABS.map((t) =>
      h(
        'button',
        {
          class: t.id === tab.id ? 'tab active' : 'tab',
          onclick: () => navigate({ tab: t.id }),
        },
        t.label,
      ),
    ),
  );

  const detailPanel = h(
    'aside',
    { class: 'detail-panel frame' },
    h('h2', {}, 'Details'),
    h('p', { class: 'muted' }, 'Select something on a map to see it here.'),
  );

  // Tabs may fill the detail panel themselves (the maps do).
  const content = tab.render ? tab.render(world, { detailPanel }) : placeholder(tab);

  root.replaceChildren(
    h(
      'div',
      { class: 'world-screen' },
      topBar,
      tabBar,
      h('div', { class: 'main-area' }, h('main', { class: 'content' }, content), detailPanel),
    ),
  );
  restoreFocus(root);
}

// Refreshes only the save label, without redrawing the rest of the screen.
export function updateSaveStatus(scope = document) {
  const label = scope.querySelector('.save-status');
  if (!label) return;
  const status = getSaveStatus();
  label.className = `save-status ${status}`;
  label.textContent = SAVE_TEXT[status];

  const fileButton = scope.querySelector('.file-status');
  const sync = getSyncState();
  fileButton.hidden = sync.status === 'off';
  fileButton.className = FILE_WARN.includes(sync.status) ? 'btn small file-status warn' : 'btn small file-status';
  fileButton.textContent = FILE_TEXT[sync.status] ?? '';
  fileButton.title = fileButtonTitle(sync);
}

function placeholder(tab) {
  const when = tab.stage ? `Coming in Stage ${tab.stage}.` : 'Comes after the MVP.';
  return h(
    'div',
    { class: 'placeholder' },
    h('span', { class: 'label-tag' }, tab.label),
    h('p', { class: 'muted' }, when),
  );
}
