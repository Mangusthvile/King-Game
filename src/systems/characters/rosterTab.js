// The Characters tab: a toolbar (Roster / Libraries / Import seed data),
// the roster with search, sort and filters, and the Death Log. The selected
// character's stat sheet fills the right-hand panel.
import { h } from '../../ui/dom.js';
import { swatchStyle } from '../../ui/colors.js';
import { dispatch } from '../../data/store.js';
import { addRecord } from '../../commands/recordCommands.js';
import { createCharacter, libName, locationName, locationOptions, staminaFor } from './characterModel.js';
import { refOptions } from './libraryEditor.js';
import { renderCharacterPanel } from './characterPanel.js';
import { charactersView as view, selectCharacter } from './state.js';
import { selectedFactionId, setSelectedFaction, isPlayerView } from '../../ui/factionSelector.js';
import { factionOptions } from '../../data/factions.js';

const SORTS = {
  name: { label: 'Name', key: (w, c) => c.name.toLowerCase() },
  faction: { label: 'Faction', key: (w, c) => libName(w, 'factions', c.factionId).toLowerCase() },
  species: { label: 'Species', key: (w, c) => libName(w, 'species', c.speciesId).toLowerCase() },
  bodyType: { label: 'Body Type', key: (w, c) => libName(w, 'bodyTypes', c.bodyTypeId).toLowerCase() },
  STR: { label: 'STR', key: (w, c) => -(c.STR ?? 0) },
  SPD: { label: 'SPD', key: (w, c) => -(c.SPD ?? 0) },
  TOU: { label: 'TOU', key: (w, c) => -(c.TOU ?? 0) },
  health: { label: 'Health', key: (w, c) => -(c.health?.current ?? 0) },
  stamina: { label: 'Stamina left', key: (w, c) => -(c.staminaRemaining ?? 0) },
  location: { label: 'Location', key: (w, c) => locationName(w, c).toLowerCase() },
};

// People > Roster > Living (the roster) or Death Log. The libraries are in
// Codex > Library and the seed import in System > Worlds > Import/Export.
export function renderCharactersTab(world, { detailPanel, path }) {
  const screen = path.split('/')[2];
  const root = h('div', { class: 'characters-page' });
  // Redraws only this tab (for view changes like typing a search), so the
  // search box keeps its focus. World changes redraw the whole screen anyway.
  const refresh = () => {
    // filter(Boolean) drops empty parts (replaceChildren would print "null").
    root.replaceChildren(...page(world, refresh, screen).filter(Boolean));
    detailPanel.replaceChildren(...detail(world, refresh).filter(Boolean));
  };
  refresh();
  return root;
}

function page(world, refresh, screen) {
  if (screen === 'deathLog') return [deathLog(world, refresh) ?? h('section', { class: 'frame panel' }, h('h2', {}, 'Death Log'), h('p', { class: 'muted small' }, 'Nobody has died.'))];
  const toolbar = h(
    'div',
    { class: 'row characters-toolbar' },
    h('div', { class: 'spacer' }),
    h(
      'button',
      {
        class: 'btn small primary arbiter-only',
        onclick: () => {
          const baseliner = Object.values(world.definitions.species).find((s) => s.name === 'Baseliner');
          // A new character joins the faction the selector shows.
          const factionId = selectedFactionId(world);
          const factionHistory = factionId ? [{ factionId, fromDay: world.meta.currentDay, toDay: null, reason: 'New character' }] : [];
          const c = createCharacter(world, { speciesId: baseliner?.id ?? '', factionId, factionHistory });
          selectCharacter(c.id);
          dispatch(addRecord('characters', c));
        },
      },
      '+ New character',
    ),
  );
  return [toolbar, filtersBar(world, refresh), rosterList(world, refresh)];
}

function detail(world, refresh) {
  // Only a character of the faction the selector shows (Player View must
  // not show another faction's sheet).
  const selected = selectedFactionId(world);
  const c = [world.characters[view.selectedId]].find((x) => x && (!selected || x.factionId === selected));
  if (!c) {
    const alive = Object.values(world.characters).filter((x) => x.alive && (!selected || x.factionId === selected)).length;
    return [h('h2', {}, 'Characters'), h('p', { class: 'muted small' }, `${alive} living character(s). Click one in the roster to open their stat sheet.`)];
  }
  return renderCharacterPanel(world, c, refresh);
}

function filtersBar(world, refresh) {
  const select = (value, options, onValue, title) => {
    const el = h('select', { title, onchange: (e) => (onValue(e.target.value), refresh()) }, options.map((o) => h('option', { value: o.value }, o.label)));
    el.value = value;
    return el;
  };
  const search = h('input', { type: 'search', placeholder: 'Search names...', value: view.search, class: 'roster-search' });
  // Live search: only the list is rebuilt, so the box keeps its focus.
  search.addEventListener('input', () => {
    view.search = search.value;
    search.closest('.characters-page')?.querySelector('.roster')?.replaceWith(rosterList(world, refresh));
  });
  const fl = view.filters;
  const any = (label) => [{ value: '', label }];
  return h(
    'div',
    { class: 'row roster-filters' },
    search,
    select(view.sort, Object.entries(SORTS).map(([value, s]) => ({ value, label: `Sort: ${s.label}` })), (v) => (view.sort = v), 'Sort'),
    // The faction filter is the top bar's faction selector.
    select(selectedFactionId(world), [...(isPlayerView(world) ? [] : any('All factions')), ...factionOptions(world)], (v) => setSelectedFaction(world, v), 'Faction (same as the top bar)'),
    select(fl.speciesId, [...any('All species'), ...refOptions(world, 'species')], (v) => (fl.speciesId = v), 'Species'),
    select(fl.bodyTypeId, [...any('All Body Types'), ...refOptions(world, 'bodyTypes')], (v) => (fl.bodyTypeId = v), 'Body Type'),
    select(fl.locationId, [...any('Any location'), { value: '-', label: '(no location)' }, ...locationOptions(world)], (v) => (fl.locationId = v), 'Location'),
    select(fl.status, [{ value: 'alive', label: 'Alive' }, { value: 'dead', label: 'Dead' }, { value: 'all', label: 'Alive and dead' }], (v) => (fl.status = v), 'Alive or dead'),
  );
}

function visibleCharacters(world) {
  const fl = view.filters;
  const text = view.search.trim().toLowerCase();
  const sortKey = SORTS[view.sort]?.key ?? SORTS.name.key;
  return Object.values(world.characters)
    .filter((c) => (fl.status === 'all' ? true : fl.status === 'dead' ? !c.alive : c.alive))
    .filter((c) => !text || c.name.toLowerCase().includes(text))
    .filter((c) => !selectedFactionId(world) || c.factionId === selectedFactionId(world))
    .filter((c) => !fl.speciesId || c.speciesId === fl.speciesId)
    .filter((c) => !fl.bodyTypeId || c.bodyTypeId === fl.bodyTypeId)
    .filter((c) => !fl.locationId || (fl.locationId === '-' ? !c.locationContainerId : c.locationContainerId === fl.locationId))
    .sort((a, b) => {
      const ka = sortKey(world, a);
      const kb = sortKey(world, b);
      return ka < kb ? -1 : ka > kb ? 1 : a.name.localeCompare(b.name);
    });
}

function rosterList(world, refresh) {
  const list = visibleCharacters(world);
  const total = Object.keys(world.characters).length;
  return h(
    'section',
    { class: 'frame panel roster' },
    h('h2', {}, `Roster (${list.length} of ${total})`),
    list.length
      ? [
          h('div', { class: 'roster-row roster-header small muted' }, ['Name', 'Faction', 'Species', 'Body Type', 'STR', 'SPD', 'TOU', 'Health', 'Stamina'].map((t) => h('span', {}, t))),
          list.map((c) => rosterRow(world, c, refresh)),
        ]
      : h('p', { class: 'muted small' }, total ? 'No character matches.' : 'No characters yet. Add one, or use Import seed data.'),
  );
}

// A compact, game-like row with the key stats. (Condition icons come back
// with Conditions in the Combat stage.)
function rosterRow(world, c, refresh) {
  const faction = world.definitions.factions?.[c.factionId];
  const stat = (value, cls) => h('span', { class: `stat-chip ${cls}` }, value ?? '-');
  return h(
    'button',
    {
      class: `roster-row${c.id === view.selectedId ? ' selected' : ''}${c.alive ? '' : ' dead'}`,
      onclick: () => (selectCharacter(c.id), refresh()),
    },
    h('span', { class: 'roster-name' }, c.alive ? '' : '✝ ', c.name),
    h('span', { class: 'team-chip ellipsis', style: swatchStyle(faction?.color ?? '#3a3029'), title: faction?.name ?? 'No faction' }, faction?.name ?? '-'),
    h('span', { class: 'muted small ellipsis' }, libName(world, 'species', c.speciesId)),
    h('span', { class: 'small ellipsis' }, libName(world, 'bodyTypes', c.bodyTypeId), c.bodyTypeId ? h('span', { class: 'muted' }, ` ${c.bodyTypeLevel}`) : null),
    stat(c.STR, 'str'),
    stat(c.SPD, 'spd'),
    stat(c.TOU, 'tou'),
    h('span', { class: 'meter hunger', title: 'Health current / max' }, `${c.health?.current ?? '-'}/${c.health?.max ?? '-'}`),
    staminaMeter(world, c),
  );
}

// Stamina remaining / max. Marked with ! when the Stamina formula gives a
// different max (SPD changed) that hasn't been accepted on the sheet yet.
function staminaMeter(world, c) {
  const formula = c.staminaMaxOverride ? null : staminaFor(world, c).breakdown?.total ?? null;
  const pending = formula !== null && formula !== c.staminaMax;
  return h(
    'span',
    { class: pending ? 'meter speed pending' : 'meter speed', title: pending ? `Stamina remaining today / Stamina max. The formula gives ${formula}: open the sheet and press Use ${formula}.` : 'Stamina remaining today / Stamina max' },
    `${c.staminaRemaining ?? '-'}/${c.staminaMax ?? '-'}${pending ? ' !' : ''}`,
  );
}

// Dead characters stay in the world, listed here with cause and day.
function deathLog(world, refresh) {
  const dead = Object.values(world.characters)
    .filter((c) => !c.alive && (!selectedFactionId(world) || c.factionId === selectedFactionId(world)))
    .sort((a, b) => (a.death?.day ?? 0) - (b.death?.day ?? 0));
  if (!dead.length) return null;
  return h(
    'section',
    { class: 'frame panel death-log' },
    h('h2', {}, `Death Log (${dead.length})`),
    dead.map((c) =>
      h(
        'button',
        { class: `death-row${c.id === view.selectedId ? ' selected' : ''}`, onclick: () => (selectCharacter(c.id), refresh()) },
        h('span', { class: 'roster-name' }, '✝ ', c.name),
        h('span', { class: 'small' }, c.death?.cause || 'Unknown cause'),
        h('span', { class: 'muted small' }, c.death?.day != null ? `Day ${c.death.day}` : ''),
      ),
    ),
  );
}
