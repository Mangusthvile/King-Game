// People > Crown Bearers:
//   Bearers:      the Crown Bearers of the selected faction
//   Connectivity: Players (with their Connectivity links) and the
//                 Connectivity table (each level's reminder text, editable,
//                 with Reset to the RULES.md text)
//   Vessels:      every Crown Bearer's vessel and status, and the Crowns
// The selected Crown Bearer or Crown opens in the side panel.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { addRecord, setField } from '../../commands/recordCommands.js';
import { portrait } from '../../ui/taskCard.js';
import { swatchStyle } from '../../ui/colors.js';
import { createCrownBearer, createCrown, BEARER_STATUSES } from '../../data/crownBearers.js';
import { factionColor, factionName } from '../../data/factions.js';
import { selectedFactionId } from '../../ui/factionSelector.js';
import { canSeeFaction } from '../../ui/playerView.js';
import { defaultConnectivity } from '../../rules/connectivity.js';
import { connectionsOf, crownLocationText } from './crownModel.js';
import { renderBearerPanel } from './bearerPanel.js';
import { renderCrownPanel } from './crownPanel.js';
import { renderPlayers } from './playersView.js';

// View state (not saved).
const view = { selected: null }; // selected: { kind: 'bearer' | 'crown', id }

const SCREENS = {
  bearers: (world, refresh) => [bearerList(world, refresh)],
  connectivity: (world) => [renderPlayers(world), connectivityTable(world)],
  vessels: (world, refresh) => [vesselTable(world, refresh), crownList(world, refresh)],
};

export function renderCrownBearersTab(world, { detailPanel, path }) {
  const root = h('div', { class: 'tab-page wide-page' });
  const screen = SCREENS[path.split('/')[2]] ?? SCREENS.bearers;
  const refresh = () => {
    root.replaceChildren(...screen(world, refresh));
    detailPanel.replaceChildren(...detail(world).flat(Infinity).filter(Boolean));
  };
  refresh();
  return root;
}

function detail(world) {
  const s = view.selected;
  const bearer = s?.kind === 'bearer' && world.crownBearers?.[s.id];
  const crown = s?.kind === 'crown' && world.crowns?.[s.id];
  if (bearer && canSeeFaction(world, bearer.factionId)) return renderBearerPanel(world, bearer);
  if (crown) return renderCrownPanel(world, crown);
  return [h('h2', {}, 'Crown Bearers'), h('p', { class: 'muted small' }, 'Players are Crown Bearers (RULES.md). Click a Crown Bearer or a Crown to open it.')];
}

// Every Crown Bearer's vessel, status and how many vessels they have had.
function vesselTable(world, refresh) {
  const list = Object.values(world.crownBearers ?? {}).filter((b) => canSeeFaction(world, b.factionId));
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Vessels'),
    h('p', { class: 'muted small' }, 'Open a Crown Bearer to change their vessel or edit the vessel history.'),
    list.length
      ? h(
          'table',
          { class: 'building-table small' },
          h('thead', {}, h('tr', {}, ['Crown Bearer', 'Status', 'Vessel', 'Since', 'Vessels so far', 'Crown'].map((t) => h('th', {}, t)))),
          h(
            'tbody',
            {},
            list.map((b) => {
              const open = (b.vesselHistory ?? []).find((l) => l.toDay === null || l.toDay === undefined || l.toDay === '');
              return h(
                'tr',
                {},
                h('td', {}, h('button', { class: 'link-button', onclick: select(refresh, 'bearer', b.id) }, b.name)),
                h('td', { class: b.status === 'withoutVessel' ? 'flag-text' : '' }, BEARER_STATUSES.find((s) => s.id === b.status)?.name ?? b.status),
                h('td', {}, world.characters[b.vesselId]?.name ?? '-'),
                h('td', {}, open?.fromDay != null ? `Day ${open.fromDay}` : '-'),
                h('td', {}, String((b.vesselHistory ?? []).length)),
                h('td', { class: 'muted' }, world.crowns?.[b.crownId] ? crownLocationText(world, world.crowns[b.crownId]) : '-'),
              );
            }),
          ),
        )
      : h('p', { class: 'muted small' }, 'No Crown Bearers yet.'),
  );
}

const select = (refresh, kind, id) => () => ((view.selected = { kind, id }), refresh());
const isSelected = (kind, id) => view.selected?.kind === kind && view.selected.id === id;

// Crown Bearers of the selected faction (all under All factions).
function bearerList(world, refresh) {
  const factionId = selectedFactionId(world);
  const list = Object.values(world.crownBearers ?? {}).filter((b) => !factionId || b.factionId === factionId);
  const add = () => {
    const b = createCrownBearer({ factionId });
    view.selected = { kind: 'bearer', id: b.id };
    dispatch(addRecord('crownBearers', b));
  };
  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `Crown Bearers (${list.length})`), h('div', { class: 'spacer' }), h('button', { class: 'btn small primary arbiter-only', onclick: add }, '+ New Crown Bearer')),
    list.length
      ? list.map((b) => {
          const vessel = world.characters[b.vesselId];
          const levels = connectionsOf(world, b.id).map((x) => `${x.player.name}: ${x.connection.connectivity}`);
          return h(
            'button',
            { class: `bearer-row${isSelected('bearer', b.id) ? ' selected' : ''}`, onclick: select(refresh, 'bearer', b.id) },
            portrait(vessel?.name ?? '?', factionColor(world, b.factionId)),
            h('span', {}, h('strong', {}, b.name), b.title && b.title !== b.name ? h('span', { class: 'muted small' }, ` ${b.title}`) : null),
            h('span', { class: 'team-chip', style: swatchStyle(factionColor(world, b.factionId)) }, factionName(world, b.factionId)),
            h('span', { class: b.status === 'withoutVessel' ? 'flag-text small' : 'small' }, vessel ? `Vessel: ${vessel.name}` : BEARER_STATUSES.find((s) => s.id === b.status)?.name),
            h('span', { class: 'small' }, `Authority ${b.authorityLevel ?? '-'}`),
            h('span', { class: 'small muted' }, levels.length ? `Connectivity ${levels.join(', ')}` : 'No player connected'),
          );
        })
      : h('p', { class: 'muted small' }, 'No Crown Bearers here.'),
  );
}

function crownList(world, refresh) {
  // Player View: only Crowns attuned to the faction's own Crown Bearers.
  const list = Object.values(world.crowns ?? {}).filter((c) => canSeeFaction(world, world.crownBearers?.[c.attunedBearerId]?.factionId));
  const add = () => {
    const c = createCrown();
    view.selected = { kind: 'crown', id: c.id };
    dispatch(addRecord('crowns', c));
  };
  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `Crowns (${list.length})`), h('div', { class: 'spacer' }), h('button', { class: 'btn small primary arbiter-only', onclick: add }, '+ New Crown')),
    list.length
      ? list.map((c) =>
          h(
            'button',
            { class: `bearer-row${isSelected('crown', c.id) ? ' selected' : ''}`, onclick: select(refresh, 'crown', c.id) },
            h('span', { class: 'task-icon' }, '♛'),
            h('strong', {}, c.name),
            h('span', { class: 'small' }, `Attuned: ${world.crownBearers?.[c.attunedBearerId]?.name ?? 'nobody'}`),
            h('span', { class: 'small muted' }, crownLocationText(world, c)),
          ),
        )
      : h('p', { class: 'muted small' }, 'No Crowns yet.'),
  );
}

// Each level's reminder text, editable. The text starts as RULES.md's.
function connectivityTable(world) {
  const levels = world.definitions.connectivity?.levels ?? defaultConnectivity().levels;
  const save = (next) => dispatch(setField(world, 'definitions', 'connectivity', 'levels', next, 'Connectivity table'));
  const update = (level, changes) => save(levels.map((l) => (l.level === level ? { ...l, ...changes } : l)));
  const reset = () => confirm('Put back the Connectivity text from RULES.md? Your notes are kept. Ctrl+Z undoes it.') && save(defaultConnectivity().levels.map((l) => ({ ...l, notes: levels.find((x) => x.level === l.level)?.notes ?? '' })));
  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, 'Connectivity'), h('div', { class: 'spacer' }), h('button', { class: 'btn small arbiter-only', onclick: reset }, 'Reset to RULES.md')),
    h('p', { class: 'muted small' }, 'The link between a Player and a Crown Bearer (RULES.md, subject to change). These are reminders shown on the Crown Bearer panel and the Start of Day; the app does not enforce them.'),
    [...levels]
      .sort((a, b) => b.level - a.level)
      .map((l) => {
        const text = h('textarea', { rows: 2, value: l.description, 'data-key': `conn.${l.level}.text` });
        text.addEventListener('change', () => text.value !== l.description && update(l.level, { description: text.value }));
        const notes = h('input', { type: 'text', class: 'wide', value: l.notes ?? '', placeholder: 'Notes (optional)', 'data-key': `conn.${l.level}.notes` });
        notes.addEventListener('change', () => update(l.level, { notes: notes.value }));
        return h('div', { class: 'connectivity-row' }, h('span', { class: 'stat-chip' }, l.level), h('div', {}, text, notes));
      }),
  );
}
