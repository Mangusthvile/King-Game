// The main screen for an open world (CLAUDE.md, Interface > Navigation):
// the top bar, the main tabs, the sub-tab row, the sub-sub-tab row, the
// content, the right-hand detail panel and the bottom quick bar. Where each
// screen lives is in tabLayout.js; systems fill the slots (systems/registry.js).
import { h, restoreFocus } from './dom.js';
import { canUndo, canRedo, undo, redo, getSaveStatus } from '../data/store.js';
import '../systems/registry.js'; // every system registers its places
import { MAIN_TABS, subTab, placeRender } from './tabLayout.js';
import { getNavigation, navigate, currentPath } from './navigation.js';
import { getSyncState, checkNow, saveFileNow } from '../sync/fileSync.js';
import { getDeviceSettings } from '../sync/deviceSettings.js';
import { factionSelect, isPlayerView, togglePlayerView } from './factionSelector.js';
import { renderQuickBar } from './quickBar.js';
import { reviewPending, renderMigrationReview } from '../systems/factions/migrationReview.js';
import { lockPlayerView, watchPlayerView } from './playerView.js';
import { factionName } from '../data/factions.js';
import { selectedFactionId } from './factionSelector.js';
import { openScreenshotDialog } from './screenshot.js';

// The main tabs shown: Codex (Arbiter only) is hidden in Player View.
export const visibleMainTabs = (world) => MAIN_TABS.filter((m) => !(m.arbiterOnly && isPlayerView(world)));

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

// A row of tab buttons (main, sub or sub-sub).
function tabRow(cls, items, activeId, onPick) {
  return h(
    'nav',
    { class: `${cls}-row` },
    items.map((t) => h('button', { class: t.id === activeId ? `${cls} active` : cls, title: t.title ?? '', onclick: () => onPick(t.id) }, t.icon ? h('span', { class: 'tab-icon' }, t.icon) : null, h('span', {}, t.label))),
  );
}

// An empty slot: a planned screen, or one no system has filled yet.
function placeholder(label, planned) {
  return h('div', { class: 'placeholder' }, h('span', { class: 'label-tag' }, label), h('p', { class: 'muted' }, `Coming in a later stage${planned ? ` (${planned})` : ''}.`));
}

export function renderWorldScreen(root, world, { onBack }) {
  // Player View never shows Codex: fall back to Realm.
  if (getNavigation(world).main === 'codex' && isPlayerView(world)) navigate({ main: 'realm' });
  const nav = getNavigation(world);
  const main = MAIN_TABS.find((m) => m.id === nav.main);
  const sub = subTab(nav.main, nav.sub);
  const subsub = sub.subsubs.find((x) => x.id === nav.subsub);
  const path = currentPath();

  const topBar = h(
    'header',
    { class: 'top-bar' },
    h('button', { class: 'btn small', onclick: onBack }, '< Worlds'),
    h('span', { class: 'label-tag' }, world.meta.name),
    h('span', { class: 'day-badge' }, `Day ${world.meta.currentDay}`),
    h('button', { class: 'btn small primary arbiter-only', title: 'End the day for the whole world (Realm > Today > Advance Day)', onclick: () => navigate({ main: 'realm', sub: 'today', subsub: 'advanceDay' }) }, 'Advance Day'),
    factionSelect(world),
    h('button', { class: isPlayerView(world) ? 'btn small active' : 'btn small', title: 'Player View: only the selected faction, read-only, no Arbiter-only fields or controls (for screenshots)', onclick: () => togglePlayerView(world) }, 'Player View'),
    h('button', { class: 'btn small screenshot-button', title: 'Screenshot: save a PNG of the map, a panel or the whole screen (in Player View)', onclick: () => openScreenshotDialog(world) }, '📷'),
    h('div', { class: 'spacer' }),
    // Player View is read-only: no undo or redo there.
    h('button', { class: 'btn small arbiter-only', disabled: !canUndo(), onclick: undo, title: 'Undo (Ctrl+Z)' }, 'Undo'),
    h('button', { class: 'btn small arbiter-only', disabled: !canRedo(), onclick: redo, title: 'Redo (Ctrl+Y)' }, 'Redo'),
    h('span', { class: 'save-status' }),
    h('button', { class: 'btn small file-status', onclick: fileButtonClick }),
  );
  updateSaveStatus(topBar);

  const mains = visibleMainTabs(world).map((m, i) => ({ ...m, title: `${m.label} (${MAIN_TABS.indexOf(m) + 1})` }));
  const tabs = h(
    'div',
    { class: 'tab-area' },
    tabRow('main-tab', mains, main.id, (id) => navigate({ main: id })),
    tabRow('sub-tab', main.subs, sub.id, (id) => navigate({ sub: id })),
    sub.subsubs.length ? tabRow('subsub-tab', sub.subsubs, nav.subsub, (id) => navigate({ subsub: id })) : null,
  );

  const detailPanel = h(
    'aside',
    { class: 'detail-panel frame' },
    h('h2', {}, 'Details'),
    h('p', { class: 'muted small' }, 'Select something to see it here.'),
  );

  // After the migration to factions, the owner review comes first.
  const render = placeRender(path);
  const planned = subsub?.planned ?? sub.planned;
  const content = reviewPending(world)
    ? renderMigrationReview(world, { detailPanel })
    : render && !planned
      ? render(world, { detailPanel, path })
      : placeholder(subsub?.label ?? sub.label, planned);

  // A banner so Player View is never mistaken for the Arbiter's view.
  const banner = isPlayerView(world)
    ? h('div', { class: 'player-view-banner' }, h('strong', {}, `Player View: ${factionName(world, selectedFactionId(world))}`), h('span', { class: 'small' }, 'Read-only. Arbiter-only fields and other factions are hidden.'), h('button', { class: 'btn tiny', onclick: () => togglePlayerView(world) }, 'Back to Arbiter view'))
    : null;

  root.replaceChildren(
    h(
      'div',
      { class: isPlayerView(world) ? 'world-screen player-view' : 'world-screen' },
      topBar,
      banner,
      tabs,
      h('div', { class: 'main-area' }, h('main', { class: 'content' }, content), detailPanel),
      renderQuickBar(world),
    ),
  );
  lockPlayerView(root, world);
  watchPlayerView(root, world);
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
