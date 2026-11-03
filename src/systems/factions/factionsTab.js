// Realm > Factions: Factions (the list; the selected one opens in the side
// panel) and Relations (every faction's stance toward every other, each
// direction on its own). Players are in People > Crown Bearers.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { addRecord, setField } from '../../commands/recordCommands.js';
import { swatchStyle } from '../../ui/colors.js';
import { FACTION_TYPES, STANCES, createFaction, factionList, factionIcon, stanceOf } from '../../data/factions.js';
import { renderFactionPanel, ownedCounts } from './factionPanel.js';

// View state (not saved).
const view = { selectedId: null };

export function renderFactionsTab(world, { detailPanel, path }) {
  const root = h('div', { class: 'tab-page wide-page' });
  const refresh = () => {
    const mode = path.endsWith('/relations') ? relationsTable : factionsList;
    root.replaceChildren(mode(world, refresh));
    const f = world.definitions.factions[view.selectedId];
    detailPanel.replaceChildren(...(f ? renderFactionPanel(world, f) : [h('h2', {}, 'Factions'), h('p', { class: 'muted small' }, 'Click a faction to edit it.')]).flat(Infinity).filter(Boolean));
  };
  refresh();
  return root;
}

const typeName = (id) => FACTION_TYPES.find((t) => t.id === id)?.name ?? id;

function factionsList(world, refresh) {
  const name = h('input', { type: 'text', placeholder: 'Faction name' });
  const type = h('select', {}, FACTION_TYPES.map((t) => h('option', { value: t.id }, t.name)));
  type.value = 'npc';
  const add = (e) => {
    e.preventDefault();
    const f = createFaction(name.value.trim() || 'New Faction', type.value);
    view.selectedId = f.id;
    dispatch(addRecord('definitions.factions', f));
  };
  const rows = factionList(world).map((f) => {
    const owned = ownedCounts(world, f.id);
    const living = Object.values(world.characters).filter((c) => c.alive && c.factionId === f.id).length;
    return h(
      'button',
      { class: `faction-row${f.id === view.selectedId ? ' selected' : ''}`, onclick: () => ((view.selectedId = f.id), refresh()) },
      h('span', { class: 'team-chip', style: swatchStyle(f.color) }, `${factionIcon(f)} ${f.name}`),
      h('span', { class: 'small' }, typeName(f.type)),
      h('span', { class: 'small muted' }, `${living} living, ${owned.stockpiles} stockpile(s), ${owned.buildings} building(s), ${owned.projects} Project(s), ${owned.claims} claim(s)`),
      h('span', { class: 'small muted' }, [f.trackNeeds ? 'needs' : null, f.usesStamina !== false ? 'Stamina' : null].filter(Boolean).join(', ') || '-'),
    );
  });
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, `Factions (${rows.length})`),
    h('form', { class: 'row arbiter-only', onsubmit: add }, name, type, h('button', { class: 'btn small primary', type: 'submit' }, '+ New faction')),
    rows.length ? rows : h('p', { class: 'muted small' }, 'No factions yet.'),
  );
}

// Rows: how this faction stands toward each column's faction.
function relationsTable(world) {
  const list = factionList(world);
  const cell = (from, to) => {
    if (from.id === to.id) return h('td', { class: 'muted' }, '-');
    const select = h(
      'select',
      { class: `stance-select stance-${stanceOf(world, from.id, to.id)}`, title: `${from.name} toward ${to.name}`, onchange: (e) => dispatch(setField(world, 'definitions.factions', from.id, 'relations', { ...from.relations, [to.id]: e.target.value }, from.name)) },
      STANCES.map((s) => h('option', { value: s.id }, s.name)),
    );
    select.value = stanceOf(world, from.id, to.id);
    return h('td', {}, select);
  };
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Relations'),
    h('p', { class: 'muted small' }, 'Each row is how that faction stands toward the faction of each column. The two directions can differ. Unset counts as Neutral.'),
    list.length > 1
      ? h(
          'div',
          { class: 'table-scroll' },
          h(
            'table',
            { class: 'building-table relations-table' },
            h('tr', {}, h('th', {}, 'Toward ->'), list.map((f) => h('th', {}, h('span', { class: 'team-chip', style: swatchStyle(f.color) }, f.name)))),
            list.map((from) => h('tr', {}, h('th', {}, h('span', { class: 'team-chip', style: swatchStyle(from.color) }, from.name)), list.map((to) => cell(from, to)))),
          ),
        )
      : h('p', { class: 'muted small' }, 'Add a second faction to set relations.'),
  );
}
