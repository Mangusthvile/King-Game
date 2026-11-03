// Realm > Buildings: the faction's buildings, By Area (grouped under their
// Biome and Area) or All (one table), each with a button to show it on its
// Biome Map. Building types and categories are in Codex > World Types >
// Building (renderBuildingTypesPage).
import { h } from '../../ui/dom.js';
import { enterContainer } from '../../ui/navigation.js';
import { rememberSelection } from '../../map/mapView.js';
import { factionName, ownedBy } from '../../data/factions.js';
import { selectedFactionId } from '../../ui/factionSelector.js';
import { stageName, shownStage } from './stages.js';
import { renderBuildingTypes, renderCategories } from './typeEditor.js';

const help = () => [
  h('h2', {}, 'Buildings'),
  h('p', { class: 'muted small' }, 'Place buildings on a Biome Map with the Place tool (P), then pick "Building" and a type in the toolbar.'),
  h('p', { class: 'muted small' }, 'Select a building on the map to edit its stage, progress, storage and properties.'),
];

export function renderBuildingsTab(world, { detailPanel, path }) {
  detailPanel.replaceChildren(...help());
  const factionId = selectedFactionId(world);
  const objects = Object.values(world.placedObjects).filter((o) => o.kind === 'building' && world.buildings[o.refId] && ownedBy(world.buildings[o.refId], factionId));
  return h('div', { class: 'tab-page wide-page' }, path.endsWith('/byArea') ? byArea(world, objects) : buildingTable(world, objects, 'All Buildings'));
}

// Codex > World Types > Building: building types and categories.
export function renderBuildingTypesPage(world, { detailPanel }) {
  detailPanel.replaceChildren(...help());
  return h('div', { class: 'tab-page wide-page' }, renderBuildingTypes(world), renderCategories(world));
}

// One table per Biome and Area ("Jade Garden > Building Site").
function byArea(world, objects) {
  const groups = new Map();
  for (const obj of objects) {
    const b = world.buildings[obj.refId];
    const biome = world.containers[obj.containerId]?.name ?? '?';
    const area = b.areaId ? world.containers[b.areaId]?.name ?? '(removed Area)' : 'Standing alone';
    const key = `${biome} > ${area}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(obj);
  }
  if (!groups.size) return buildingTable(world, [], 'Buildings by Area');
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => buildingTable(world, list, key));
}

function buildingTable(world, objects, title) {
  const rows = objects.map((obj) => {
    const b = world.buildings[obj.refId];
    const type = world.definitions.buildingTypes[b.buildingTypeId];
    const biome = world.containers[obj.containerId];
    const area = b.areaId ? world.containers[b.areaId]?.name ?? '(removed Area)' : '-';
    return h(
      'tr',
      {},
      h('td', {}, b.name),
      h('td', { class: 'muted' }, type?.name ?? (b.buildingTypeId ? '(deleted type)' : '-')),
      h('td', {}, factionName(world, b.ownerFactionId)),
      h('td', {}, biome?.name ?? '?'),
      h('td', {}, area),
      h('td', {}, stageName(shownStage(b, type)), b.forcedStage ? h('span', { class: 'muted' }, ' (forced)') : null),
      h('td', {}, `${b.constructionProgress}%`),
      h(
        'td',
        {},
        h(
          'button',
          {
            class: 'btn small',
            onclick: () => {
              rememberSelection(obj.containerId, obj.id);
              enterContainer(world, obj.containerId);
            },
          },
          'Show',
        ),
      ),
    );
  });
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, title),
    rows.length
      ? h(
          'table',
          { class: 'building-table small' },
          h('thead', {}, h('tr', {}, ['Name', 'Type', 'Owner', 'Biome', 'Area', 'Stage', 'Progress', ''].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows),
        )
      : h('p', { class: 'muted small' }, 'No buildings here yet.'),
  );
}
