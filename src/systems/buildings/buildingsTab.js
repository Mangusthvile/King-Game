// The Buildings tab: building types, categories, and a list of every
// building in the world with a button to show it on its Biome Map.
import { h } from '../../ui/dom.js';
import { enterContainer } from '../../ui/navigation.js';
import { rememberSelection } from '../../map/mapView.js';
import { stageName, shownStage } from './stages.js';
import { renderBuildingTypes, renderCategories } from './typeEditor.js';

export function renderBuildingsTab(world, { detailPanel }) {
  detailPanel.replaceChildren(
    h('h2', {}, 'Buildings'),
    h('p', { class: 'muted small' }, 'Place buildings on a Biome Map with the Place tool (P), then pick "Building" and a type in the toolbar.'),
    h('p', { class: 'muted small' }, 'Select a building on the map to edit its stage, progress, storage and properties.'),
  );
  return h('div', { class: 'tab-page wide-page' }, renderBuildingTypes(world), renderCategories(world), buildingList(world));
}

function buildingList(world) {
  const objects = Object.values(world.placedObjects).filter((o) => o.kind === 'building' && world.buildings[o.refId]);
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
    h('h2', {}, 'All Buildings'),
    rows.length
      ? h(
          'table',
          { class: 'building-table small' },
          h('thead', {}, h('tr', {}, ['Name', 'Type', 'Biome', 'Area', 'Stage', 'Progress', ''].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows),
        )
      : h('p', { class: 'muted small' }, 'No buildings placed yet.'),
  );
}
