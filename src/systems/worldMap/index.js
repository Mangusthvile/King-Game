// World Map system: the largest-scale map, showing the root World container.
// It uses the shared map engine in /src/map; this file only says which
// container to show, what can be placed on it, and which panels it uses.
import '../../map/mapCommands.js'; // registers the map command types
import { mountMapView } from '../../map/mapView.js';
import { h } from '../../ui/dom.js';
import { renderBreadcrumb } from '../../ui/breadcrumb.js';
import { renderRegionInfo } from '../../ui/regionInfo.js';
import { renderTypeEditor } from '../../ui/typeEditor.js';
import { tileTypesEditor } from '../../map/mapPanels.js';
import placeables from './placeables.json';

// Codex > World Types: the Region, Biome and Area types and the tile types
// (also edited from the maps' side panels).
const typesPage = (kind, title) => (world, { detailPanel }) => {
  detailPanel.replaceChildren(h('h2', {}, title), h('p', { class: 'muted small' }, 'Types are definitions: changing a type later adds its missing default fields; it never removes fields.'));
  return h('div', { class: 'tab-page' }, h('section', { class: 'frame panel' }, renderTypeEditor(world, kind, title)));
};

const tilesPage = (world, { detailPanel }) => {
  detailPanel.replaceChildren(h('h2', {}, 'Tile Types'), h('p', { class: 'muted small' }, 'Every map paints with these.'));
  return h('div', { class: 'tab-page' }, h('section', { class: 'frame panel' }, tileTypesEditor(world)));
};

export default {
  id: 'worldMap',
  name: 'World Map',
  places: [
    { path: 'codex/worldTypes/region', render: typesPage('region', 'Region Types') },
    { path: 'codex/worldTypes/biome', render: typesPage('biome', 'Biome Types') },
    { path: 'codex/worldTypes/area', render: typesPage('area', 'Area Types') },
    { path: 'codex/worldTypes/tiles', render: tilesPage },
    {
      path: 'world/worldMap',
      render: (world, { detailPanel }) =>
        mountMapView({
          world,
          containerId: world.meta.rootContainerId,
          placeables,
          detailPanel,
          header: renderBreadcrumb(world),
          infoPanels: { region: renderRegionInfo },
          idlePanel: () => [
            h('h2', {}, world.containers[world.meta.rootContainerId].name),
            renderTypeEditor(world, 'region', 'Region Types'),
          ],
        }),
    },
  ],
};
