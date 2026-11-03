// How buildings plug into the shared map engine (see map/objectKinds.js).
//
// A building is two records:
//   world.placedObjects[id]  where it is on the Biome Map: { kind: 'building', refId, x, y, w, h, ... }
//   world.buildings[refId]   what it is:
//     { id, buildingTypeId, name,
//       areaId,               the Area it belongs to ('' = stands alone)
//       constructionProgress, 0 to 100 percent, set by hand (Projects later)
//       forcedStage,          a stage id the Arbiter forced ('' = from progress)
//       projectId,            Stage 5 ('' = none)
//       storage,              { resourceTypeId: count }
//       properties,           [{ key, value }] free-form, Arbiter-made
//       stageStamps,          { stageId: stampKey } for Stage 9 (all '' for now)
//       notes, customFields }
//
// A building type (definitions.buildingTypes):
//   { id, name, categoryId, w, h, stageThresholds: { stageId: percent },
//     defaultProperties: [{ key, value }], spriteKey, stageStamps, customFields }
import { newId } from '../../data/ids.js';
import { objectsIn } from '../../map/grid.js';
import { setField } from '../../commands/recordCommands.js';
import { defaultThresholds, emptyStageStamps } from './stages.js';
import { drawBuilding } from './drawBuilding.js';
import { renderBuildingPanel } from './buildingPanel.js';
import placeables from './placeables.json';
import { selectedFactionId } from '../../ui/factionSelector.js';

export function createBuilding(type) {
  return {
    id: newId('building'),
    buildingTypeId: type?.id ?? '',
    name: type?.name ?? 'New Building',
    areaId: '',
    constructionProgress: 0,
    forcedStage: '',
    projectId: '',
    ownerFactionId: '', // the faction that owns it (data/factions.js); '' = none
    storage: {},
    properties: structuredClone(type?.defaultProperties ?? []),
    stageStamps: emptyStageStamps(),
    notes: '',
    customFields: {},
  };
}

export function createBuildingType(categoryId = '') {
  return {
    id: newId('buildingType'),
    name: 'New Building Type',
    categoryId,
    w: 2,
    h: 2,
    stageThresholds: defaultThresholds(),
    defaultProperties: [],
    spriteKey: '',
    stageStamps: emptyStageStamps(),
    customFields: {},
  };
}

// The Area a footprint belongs to: the Area on this map that covers the most
// of its cells. '' if it touches no Area.
export function areaUnder(world, containerId, rect) {
  let best = '';
  let bestCells = 0;
  for (const o of objectsIn(world, world.containers[containerId])) {
    if (world.containers[o.refId]?.kind !== 'area') continue;
    const w = Math.min(rect.x + rect.w, o.x + o.w) - Math.max(rect.x, o.x);
    const h = Math.min(rect.y + rect.h, o.y + o.h) - Math.max(rect.y, o.y);
    const cells = w > 0 && h > 0 ? w * h : 0;
    if (cells > bestCells) {
      best = o.refId;
      bestCells = cells;
    }
  }
  return best;
}

const buildingOf = (world, obj) => world.buildings[obj.refId];

export const buildingKind = {
  title: 'Building',
  placeables: { biome: placeables },
  types: (world) => world.definitions.buildingTypes,
  defaultSize: (world, typeId) => {
    const type = world.definitions.buildingTypes[typeId];
    return type ? { w: type.w, h: type.h } : null;
  },
  create(world, object, typeId) {
    const building = createBuilding(world.definitions.buildingTypes[typeId]);
    building.ownerFactionId = selectedFactionId(world); // the faction the top bar shows
    building.areaId = areaUnder(world, object.containerId, object);
    object.refId = building.id;
    object.label = building.name;
    object.color = ''; // '' = use the category's color
    return [{ path: 'buildings', record: building }];
  },
  duplicate(world, source, object) {
    const original = buildingOf(world, source);
    if (!original) return [];
    const building = {
      ...structuredClone(original),
      id: newId('building'),
      name: `${original.name} (copy)`,
      projectId: '', // a Project belongs to one building
      storage: {}, // copying a building must not copy the resources stored in it
      areaId: areaUnder(world, object.containerId, object),
    };
    object.refId = building.id;
    return [{ path: 'buildings', record: building }];
  },
  linkedRecords: (world, obj) => {
    const building = buildingOf(world, obj);
    return building ? [{ path: 'buildings', record: structuredClone(building) }] : [];
  },
  record: (world, obj) => (buildingOf(world, obj) ? { path: 'buildings', id: obj.refId, nameField: 'name' } : null),
  // Moving, rotating or resizing re-links it to the Area under its new footprint.
  footprintChanged(world, obj, rect) {
    const building = buildingOf(world, obj);
    if (!building) return null;
    const areaId = areaUnder(world, obj.containerId, rect);
    return areaId === building.areaId ? null : setField(world, 'buildings', building.id, 'areaId', areaId, building.name);
  },
  draw: drawBuilding,
  infoPanel: renderBuildingPanel,
};
