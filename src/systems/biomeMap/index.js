// Biome Map system: the detailed map inside one Biome. It holds Areas
// (outlined zones with a focus: a mine, a farm, a building site...) and,
// from Stage 3, buildings, which may sit inside an Area or stand alone.
import { mountMapView } from '../../map/mapView.js';
import { h } from '../../ui/dom.js';
import { getNavigation } from '../../ui/navigation.js';
import { renderBreadcrumb } from '../../ui/breadcrumb.js';
import { renderContainerPicker } from '../../ui/containerPicker.js';
import { renderBiomeInfo } from '../../ui/biomeInfo.js';
import { renderAreaInfo } from '../../ui/areaInfo.js';
import { renderTypeEditor } from '../../ui/typeEditor.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import placeables from './placeables.json';

export default {
  id: 'biomeMap',
  name: 'Biome Map',
  tabs: [
    {
      id: 'biome',
      label: 'Biome Map',
      render: (world, { detailPanel }) => {
        const biome = world.containers[getNavigation(world).biomeId];
        if (!biome) {
          return renderContainerPicker(world, 'biome', {
            title: 'Choose a Biome',
            emptyText: 'No Biomes yet. Open a Region, place a Biome on its map, then double-click it.',
          });
        }
        return mountMapView({
          world,
          containerId: biome.id,
          placeables,
          detailPanel,
          header: renderBreadcrumb(world),
          infoPanels: { area: renderAreaInfo },
          // With nothing selected, the side panel shows this Biome's own info.
          idlePanel: () => [
            h('h2', {}, 'Biome'),
            ...renderBiomeInfo(world, biome),
            renderCustomFields(world, 'containers', biome.id),
            renderTypeEditor(world, 'area', 'Area Types'),
          ],
        });
      },
    },
  ],
};
