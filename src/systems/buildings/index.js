// Buildings system (Stage 3): multi-cell buildings on the Biome Map, inside
// an Area or standing alone, with types, categories, construction stages,
// storage and properties. It adds the "Building" placeable to Biome Maps
// through the map engine's object kinds (map/objectKinds.js) and has its
// own Buildings tab for types and categories.
import { registerObjectKind } from '../../map/objectKinds.js';
import { buildingKind } from './buildingKind.js';
import { renderBuildingsTab } from './buildingsTab.js';

registerObjectKind('building', buildingKind);

export default {
  id: 'buildings',
  name: 'Buildings',
  tabs: [{ id: 'buildings', label: 'Buildings', render: renderBuildingsTab }],
};
