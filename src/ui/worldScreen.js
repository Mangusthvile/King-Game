// The main screen for an open world: top bar, management tabs, content area
// and the right-hand detail panel.
import { h, restoreFocus } from './dom.js';
import { canUndo, canRedo, undo, redo, getSaveStatus } from '../data/store.js';
import { renderSettingsTab } from './settingsTab.js';
import { renderLogTab } from './logTab.js';
import { getSystemTabs } from '../systems/registry.js';
import { getNavigation, navigate } from './navigation.js';

// Built-in tabs. Tabs without a render function are placeholders until a
// system in /src/systems provides a tab with the same id.
const BASE_TABS = [
  { id: 'world', label: 'World Map', stage: 1 },
  { id: 'region', label: 'Region Map', stage: 2 },
  { id: 'biome', label: 'Biome Map', stage: 2 },
  { id: 'buildings', label: 'Buildings', stage: 3 },
  { id: 'followers', label: 'Followers', stage: 4 },
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
