// Region Map system: the map inside one Region, holding its Biomes
// (for example the Gardens of Kie's Grove) and settlement blocks.
import { mountMapView } from '../../map/mapView.js';
import { h } from '../../ui/dom.js';
import { getNavigation } from '../../ui/navigation.js';
import { renderBreadcrumb } from '../../ui/breadcrumb.js';
import { renderContainerPicker } from '../../ui/containerPicker.js';
import { renderRegionInfo } from '../../ui/regionInfo.js';
import { renderBiomeInfo } from '../../ui/biomeInfo.js';
import { renderTypeEditor } from '../../ui/typeEditor.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import { mapFrame } from '../../map/mapFrame.js';
import placeables from './placeables.json';

export default {
  id: 'regionMap',
  name: 'Region Map',
  places: [
    {
      path: 'world/regionMap',
      render: (world, { detailPanel }) => {
        const region = world.containers[getNavigation(world).regionId];
        if (!region) {
          return renderContainerPicker(world, 'region', {
            title: 'Choose a Region',
            emptyText: 'No Regions yet. Place one on the World Map, then double-click it.',
          });
        }
        return mountMapView({
          world,
          containerId: region.id,
          placeables,
          detailPanel,
          header: renderBreadcrumb(world),
          infoPanels: { biome: renderBiomeInfo },
          // Bounded by the Region's World Map footprint, with the World Map
          // terrain under it drawn scaled up as the inherited base layer.
          frame: mapFrame(world, region),
          // With nothing selected, the side panel shows this Region's own info.
          idlePanel: () => [
            h('h2', {}, 'Region'),
            ...renderRegionInfo(world, region),
            renderCustomFields(world, 'containers', region.id),
            renderTypeEditor(world, 'biome', 'Biome Types'),
          ],
        });
      },
    },
  ],
};
