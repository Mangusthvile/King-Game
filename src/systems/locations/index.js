// Locations (World > Locations): every Region, Biome and Area as a
// searchable list with its discovered flag, so places can be found without
// opening each map. Selecting one shows its info panel on the right; Open
// goes to it on its map. Also lets the quick bar pin an Area.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField } from '../../commands/recordCommands.js';
import { enterContainer, navigate } from '../../ui/navigation.js';
import { rememberSelection } from '../../map/mapView.js';
import { registerPinKind } from '../../ui/quickBar.js';
import { renderRegionInfo } from '../../ui/regionInfo.js';
import { renderBiomeInfo } from '../../ui/biomeInfo.js';
import { renderAreaInfo } from '../../ui/areaInfo.js';
import { factionName } from '../../data/factions.js';

const KINDS = { regions: 'region', biomes: 'biome', areas: 'area' };
const INFO = { region: renderRegionInfo, biome: renderBiomeInfo, area: renderAreaInfo };

// View state (not saved).
const view = { search: '', selectedId: null };

// Opens a place on the map where it is drawn, selected: a Region on the
// World Map, a Biome on its Region Map, an Area on its Biome Map.
export function openLocation(world, c) {
  const object = Object.values(world.placedObjects).find((o) => o.refId === c.id);
  if (object) rememberSelection(object.containerId, object.id);
  if (c.kind === 'region') navigate({ main: 'world', sub: 'worldMap' });
  else enterContainer(world, c.parentId);
}

registerPinKind('area', {
  label: 'An Area',
  icon: '▣',
  options: (world) =>
    Object.values(world.containers)
      .filter((c) => c.kind === 'area')
      .map((c) => ({ value: c.id, label: `${c.name} (${world.containers[c.parentId]?.name ?? '?'})` })),
  name: (world, id) => (world.containers[id]?.kind === 'area' ? world.containers[id].name : null),
  open: (world, id) => openLocation(world, world.containers[id]),
});

function locationRow(world, c, refresh) {
  const parent = world.containers[c.parentId];
  const type = world.definitions[`${c.kind}Types`]?.[c.typeId];
  return h(
    'tr',
    { class: c.id === view.selectedId ? 'selected-row' : '' },
    h('td', {}, h('button', { class: 'link-button', title: 'Show its info', onclick: () => ((view.selectedId = c.id), refresh()) }, c.name)),
    h('td', { class: 'muted' }, parent && parent.kind !== 'world' ? parent.name : '-'),
    h('td', {}, type?.name ?? '-'),
    h(
      'td',
      {},
      h('input', {
        type: 'checkbox',
        checked: c.discovered !== false,
        title: 'Discovered (undiscovered places show as their undiscovered name in logs)',
        onchange: (e) => dispatch(setField(world, 'containers', c.id, 'discovered', e.target.checked, c.name)),
      }),
      c.discovered === false ? h('span', { class: 'muted small' }, ` [${c.undiscoveredName || '???'}]`) : null,
    ),
    h('td', { class: 'small' }, c.claimFactionId ? factionName(world, c.claimFactionId) : '-'),
    h('td', {}, h('button', { class: 'btn small', title: 'Open it on its map', onclick: () => openLocation(world, c) }, 'Open')),
  );
}

function renderLocations(world, { detailPanel, path }) {
  const kind = KINDS[path.split('/')[2]] ?? 'region';
  const root = h('div', { class: 'tab-page wide-page' });
  const search = h('input', { type: 'search', class: 'roster-search', placeholder: 'Search names...', value: view.search });
  const list = h('div');
  const drawList = () => {
    const text = view.search.trim().toLowerCase();
    const all = Object.values(world.containers).filter((c) => c.kind === kind);
    const shown = all.filter((c) => !text || c.name.toLowerCase().includes(text) || (world.containers[c.parentId]?.name ?? '').toLowerCase().includes(text)).sort((a, b) => a.name.localeCompare(b.name));
    list.replaceChildren(
      shown.length
        ? h(
            'table',
            { class: 'building-table small' },
            h('thead', {}, h('tr', {}, ['Name', 'In', 'Type', 'Discovered', 'Claimed by', ''].map((t) => h('th', {}, t)))),
            h('tbody', {}, shown.map((c) => locationRow(world, c, refresh))),
          )
        : h('p', { class: 'muted small' }, all.length ? 'Nothing matches.' : `No ${path.split('/')[2]} yet. Place them on the maps.`),
    );
  };
  // Live search: only the list is redrawn, so the box keeps its focus.
  search.addEventListener('input', () => ((view.search = search.value), drawList()));
  const refresh = () => {
    drawList();
    const c = world.containers[view.selectedId];
    detailPanel.replaceChildren(...(c && INFO[c.kind] ? [h('h2', {}, c.kind.charAt(0).toUpperCase() + c.kind.slice(1)), ...INFO[c.kind](world, c)] : [h('h2', {}, 'Locations'), h('p', { class: 'muted small' }, 'Click a name to see its info here, or Open to go to it on its map.')]).flat(Infinity).filter(Boolean));
  };
  root.append(h('section', { class: 'frame panel' }, h('div', { class: 'row' }, h('h2', {}, `Locations: ${path.split('/')[2]}`), h('div', { class: 'spacer' }), search), list));
  refresh();
  return root;
}

export default {
  id: 'locations',
  name: 'Locations',
  places: Object.keys(KINDS).map((id) => ({ path: `world/locations/${id}`, render: renderLocations })),
};
