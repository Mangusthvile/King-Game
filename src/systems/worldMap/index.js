// World Map system: the largest-scale map, showing the root World container.
// It uses the shared map engine in /src/map; this file only says which
// container to show and what can be placed on it.
import '../../map/mapCommands.js'; // registers the map command types
import { mountMapView } from '../../map/mapView.js';
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
        }),
    },
  ],
};
