// The faction selector in the top bar: which faction the Characters,
// Today, Resources, Projects and Log tabs show ('' = All factions, Arbiter
// only), and Player View (hides Arbiter-only controls and "All factions",
// so only the selected faction's own information shows). View state per
// computer (localStorage), not world data.
import { h } from './dom.js';
import { navigate } from './navigation.js';
import { factionList, getFaction, factionIcon } from '../data/factions.js';

const state = { worldId: null, factionId: '', playerView: false };
const storageKey = (worldId) => `kg.factionSelector.${worldId}`;

function load(world) {
  if (state.worldId === world.meta.id) return;
  state.worldId = world.meta.id;
  state.factionId = '';
  state.playerView = false;
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(storageKey(world.meta.id)) ?? '{}'));
  } catch {
    // no saved choice (private window, blocked storage): All factions
  }
}

function save() {
  try {
    localStorage.setItem(storageKey(state.worldId), JSON.stringify({ factionId: state.factionId, playerView: state.playerView }));
  } catch {
    // not saved; the choice still holds while the app is open
  }
}

// A screenshot (ui/screenshot.js) turns Player View on for a moment
// without saving the choice: override = true / false, or null = the saved one.
let override = null;
export function setPlayerViewOverride(value) {
  override = value;
}

export function isPlayerView(world) {
  load(world);
  return override ?? state.playerView;
}

// The selected faction id, '' = All factions. Player View never shows All:
// it falls back to the first Player faction.
export function selectedFactionId(world) {
  load(world);
  if (state.factionId && !getFaction(world, state.factionId)) state.factionId = '';
  if (!state.factionId && isPlayerView(world)) return (factionList(world).find((f) => f.type === 'player') ?? factionList(world)[0])?.id ?? '';
  return state.factionId;
}

export function setSelectedFaction(world, factionId) {
  load(world);
  state.factionId = factionId;
  save();
  navigate({}); // redraw the screen
}

export function togglePlayerView(world) {
  load(world);
  state.playerView = !state.playerView;
  if (state.playerView) state.factionId = selectedFactionId(world);
  save();
  navigate({});
}

// The <select> for the top bar.
export function factionSelect(world) {
  const selected = selectedFactionId(world);
  const select = h(
    'select',
    { class: 'faction-select', title: 'Show this faction (Characters, Today, Resources, Projects, Log)', onchange: (e) => setSelectedFaction(world, e.target.value) },
    isPlayerView(world) ? null : h('option', { value: '' }, 'All factions'),
    factionList(world).map((f) => h('option', { value: f.id }, `${factionIcon(f)} ${f.name}`)),
  );
  select.value = selected;
  return select;
}
