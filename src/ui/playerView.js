// Player View rules, in one place (CLAUDE.md, Interface; Stage 7). Player
// View shows one faction's own information, read-only, for screenshots to
// players:
//   - Arbiter-only fields are hidden. Any field built with the shared field
//     helpers (ui/fields.js) has an eye toggle: its key ("character_1.notes")
//     is stored in world.fieldVisibility (true = Arbiter-only, false = shown).
//     A key not there is Arbiter-only when one of its parts after the record
//     id is in meta.settings.arbiterOnlyFields (notes, customFields, combat,
//     connectivityHistory by default).
//   - Other factions' records are hidden (canSeeFaction).
//   - Undiscovered places show as [???] (placeName); unknown resources are hidden.
//   - Nothing can be changed: the store refuses commands (main.js sets the
//     guard), and lockPlayerView disables the fields on screen.
import { h } from './dom.js';
import { dispatch, getWorld } from '../data/store.js';
import { isPlayerView, selectedFactionId } from './factionSelector.js';
import { setFieldVisibility } from '../commands/visibilityCommands.js';
import { defaultArbiterOnlyFields } from '../data/schema.js';

export const pvActive = (world = getWorld()) => !!world && isPlayerView(world);

// The faction Player View shows ('' when Player View is off).
export const playerFactionId = (world) => (pvActive(world) ? selectedFactionId(world) : '');

// Can a record owned by this faction be shown? Always, outside Player View.
export function canSeeFaction(world, factionId) {
  return !pvActive(world) || factionId === selectedFactionId(world);
}

// ---- Arbiter-only fields ----

export const arbiterOnlyDefaults = (world) => world.meta.settings?.arbiterOnlyFields ?? defaultArbiterOnlyFields();

export function isArbiterOnly(world, key) {
  const chosen = world.fieldVisibility?.[key];
  if (chosen !== undefined) return chosen;
  const defaults = arbiterOnlyDefaults(world);
  return key.split('.').slice(1).some((part) => defaults.includes(part));
}

// True when this field must not be shown right now.
export const hiddenNow = (world, key) => !!key && pvActive(world) && isArbiterOnly(world, key);

// Record collections a field key's first part (the record id) is looked up
// in, so only real record fields get an eye toggle (not dialog drafts).
const COLLECTIONS = ['containers', 'placedObjects', 'buildings', 'characters', 'projects', 'tasks', 'stockpiles', 'players', 'crownBearers', 'crowns'];

export function isRecordKey(world, key) {
  const id = key?.split('.')[0];
  if (!id) return false;
  if (COLLECTIONS.some((c) => world[c]?.[id])) return true;
  return Object.values(world.definitions ?? {}).some((d) => d && typeof d === 'object' && d[id]);
}

// The small eye button next to a field (Arbiter view only).
export function eyeToggle(world, key, label = '') {
  if (!key || pvActive(world) || !isRecordKey(world, key)) return null;
  const hidden = isArbiterOnly(world, key);
  const chosen = world.fieldVisibility?.[key];
  return h(
    'button',
    {
      type: 'button',
      class: hidden ? 'eye-toggle off' : 'eye-toggle',
      title: `${hidden ? 'Arbiter-only: hidden in Player View' : 'Shown in Player View'}${chosen === undefined ? ' (default)' : ''}. Click to ${hidden ? 'show it to players' : 'hide it from players'}.`,
      onclick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch(setFieldVisibility(world, key, !hidden, label));
      },
    },
    hidden ? '◌' : '👁',
  );
}

// A whole section (custom fields, combat profile, Connectivity history)
// under one key: hidden in Player View when Arbiter-only, otherwise shown
// with its eye toggle in the corner.
export function eyeSection(world, key, node, label = '') {
  if (!node) return null;
  if (hiddenNow(world, key)) return null;
  const eye = eyeToggle(world, key, label);
  return eye ? h('div', { class: 'eye-section' }, eye, node) : node;
}

// ---- Places ----

const undiscovered = (world, c) => pvActive(world) && c?.discovered === false && c.kind !== 'world';

// A Region, Biome or Area's name as the screen shows it: [???] in Player
// View while it is undiscovered.
export function placeName(world, c) {
  if (!c) return '';
  return undiscovered(world, c) ? `[${c.undiscoveredName || '???'}]` : c.name;
}

// The info panel of an undiscovered place, in Player View: nothing but its
// undiscovered name. null = show the normal panel.
export function undiscoveredPanel(world, c) {
  if (!undiscovered(world, c)) return null;
  return [h('p', {}, h('strong', {}, placeName(world, c)), ' (Location Name Not Discovered)'), h('p', { class: 'muted small' }, 'This place has not been discovered yet.')];
}

// Resources listed at a place that the screen may show (unknown ones are
// hidden in Player View).
export function shownResources(world, list) {
  return pvActive(world) ? list.filter((r) => r.known !== false) : list;
}

// ---- Read-only screen ----

// Disables every field bound to a record (they have a data-key) and every
// field in the detail panel and Task Cards. Filters and search boxes in the
// content stay usable. The store guard is the real safety; this only makes
// it clear on screen.
// Buttons that change something, by their label ("+ Skill", "Level up
// body", "Change...", "Delete character"). Hidden in Player View; buttons
// that only open or show something (Open, Show, Enter, Copy) stay.
const EDIT_BUTTON = /^(\+|x$|.*\.\.\.$|(level up|tier up|use|apply|return to|mark|revive|delete|remove|change|set|add|rename|reset|accept|roll|reroll|start|new|log a task|link|unlink|assign|transfer|restore|undo|redo|choose|save|import|export|load|read files|discard|put|give|make|disconnect|rebuild|duplicate|rotate))/i;

export function lockPlayerView(root, world) {
  if (!pvActive(world)) return;
  for (const button of root.querySelectorAll('.content button, .detail-panel button')) {
    if (!button.closest('.map-toolbar, .pv-keep') && EDIT_BUTTON.test(button.textContent.trim())) button.hidden = true;
  }
  const fields = root.querySelectorAll('[data-key], .detail-panel input, .detail-panel select, .detail-panel textarea, .task-window input, .task-window select, .task-window textarea, .content textarea');
  for (const el of fields) {
    if (el.closest('.pv-keep')) continue;
    if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) el.readOnly = true;
    else el.disabled = true;
  }
}

// Screens that redraw only a part of themselves (a map's side panel, a
// Task Card) are locked again when they change, while Player View is on.
let observer = null;
export function watchPlayerView(root, world) {
  observer?.disconnect();
  observer = null;
  if (!pvActive(world) || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(() => lockPlayerView(root, world));
  observer.observe(root, { childList: true, subtree: true });
}

// The store guard (main.js): Player View refuses every change.
export function playerViewGuard(onBlocked) {
  return () => {
    if (!pvActive()) return false;
    onBlocked('Player View is read-only. Turn Player View off to make changes.');
    return true;
  };
}
