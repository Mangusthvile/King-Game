// Buildings system (Stage 3): multi-cell buildings on the Biome Map, inside
// an Area or standing alone, with types, categories, construction stages,
// storage and properties. It adds the "Building" placeable to Biome Maps
// through the map engine's object kinds (map/objectKinds.js) and has its
// screens: Realm > Buildings (By Area, All) and Codex > World Types >
// Building (types and categories).
import { registerObjectKind } from '../../map/objectKinds.js';
import { buildingKind } from './buildingKind.js';
import { renderBuildingsTab, renderBuildingTypesPage } from './buildingsTab.js';

registerObjectKind('building', buildingKind);

export default {
  id: 'buildings',
  name: 'Buildings',
  places: [
    { path: 'realm/buildings/byArea', render: renderBuildingsTab },
    { path: 'realm/buildings/all', render: renderBuildingsTab },
    { path: 'codex/worldTypes/building', render: renderBuildingTypesPage },
  ],
};
