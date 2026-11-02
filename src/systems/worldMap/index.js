// World Map system: the largest-scale map, showing the root World container.
// It uses the shared map engine in /src/map; this file only says which
// container to show, what can be placed on it, and which panels it uses.
import '../../map/mapCommands.js'; // registers the map command types
import { mountMapView } from '../../map/mapView.js';
import { h } from '../../ui/dom.js';
import { renderBreadcrumb } from '../../ui/breadcrumb.js';
import { renderRegionInfo } from '../../ui/regionInfo.js';
import { renderTypeEditor } from '../../ui/typeEditor.js';
import placeables from './placeables.json';

export default {
  id: 'worldMap',
  name: 'World Map',
  tabs: [
    {
      id: 'world',
      label: 'World Map',
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
