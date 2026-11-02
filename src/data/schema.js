// The shape of one world (campaign) document.
// Bump SCHEMA_VERSION whenever the shape changes, and add a step in migrations.js.
import { newId } from './ids.js';
import tileTypeList from './defaults/tileTypes.json';
import regionTypeList from './defaults/regionTypes.json';
import biomeTypeList from './defaults/biomeTypes.json';
import areaTypeList from './defaults/areaTypes.json';
import buildingCategoryList from './defaults/buildingCategories.json';

export const SCHEMA_VERSION = 7;

// Regions: how many Region Map cells one World Map cell becomes (map/regionFrame.js).
export const DEFAULT_MAP_SCALE = 10;

// What Resolution Logs call a Region, Biome or Area that isn't discovered yet.
export const DEFAULT_UNDISCOVERED_NAME = '???';

// Collections are plain objects keyed by record id. Plain objects (not Map)
// so the whole world can be saved to IndexedDB and exported as JSON as-is.
// Starter paint colors, keyed by id. The Arbiter can rename, recolor, add and
// delete them in the app (Paint tool panel).
const byId = (list) => Object.fromEntries(list.map((t) => [t.id, structuredClone(t)]));

export function defaultTileTypes() {
  return byId(tileTypeList);
}

// Starter Region, Biome and Area types: { id, name, color, defaultFields, customFields }.
// defaultFields have the same shape as customFields and are copied onto a
// Region, Biome or Area when it is given that type. An Area's type is its
// focus (Mine, Farm, Building Site...).
export function defaultRegionTypes() {
  return byId(regionTypeList);
}

export function defaultBiomeTypes() {
  return byId(biomeTypeList);
}

export function defaultAreaTypes() {
  return byId(areaTypeList);
}

// Starter building categories: { id, name, color }. A building's
// placeholder block uses its type's category color (systems/buildings).
export function defaultBuildingCategories() {
  return byId(buildingCategoryList);
}

function emptyDefinitions() {
  return {
    regionTypes: defaultRegionTypes(),
    biomeTypes: defaultBiomeTypes(),
    areaTypes: defaultAreaTypes(),
    buildingTypes: {}, // see systems/buildings/buildingKind.js for the shape
    buildingCategories: defaultBuildingCategories(),
    tileTypes: defaultTileTypes(),
    resourceTypes: {},
    species: {},
    theories: {},
    skills: {},
    traits: {},
    conditions: {},
    recipes: {},
  };
}

export function createContainer({ kind, parentId = null, name }) {
  return {
    id: newId(kind),
    // 'world' | 'region' | 'biome' | 'area'. Areas (a mine, a farm...) sit on
    // a Biome's map. They are containers so they can be made enterable later
    // (the inside of a mine), but for now nothing opens them.
    kind,
    parentId,
    name,
    typeId: '', // a regionTypes, biomeTypes or areaTypes id ('' = no type)
    description: '',
    // Regions, Biomes and Areas: has it been discovered? Resolution Logs
    // show an undiscovered place as [undiscoveredName] (Location Name Not Discovered).
    discovered: true,
    undiscoveredName: DEFAULT_UNDISCOVERED_NAME,
    // Biomes and Areas: an Environmental Danger Level from
    // rules/tables/dangerLevels.json. '' = not set; for an Area, '' means
    // "same as its Biome". Regions have no Danger Level of their own.
    dangerLevel: '',
    mapScale: DEFAULT_MAP_SCALE, // regions: Region Map cells per World Map cell
    speciesIds: [], // regions: species that live there (definitions.species ids)
    civilizations: [], // regions: names of civilizations or cities that reside there
    residentsNotes: '',
    tiles: {}, // sparse: { "x,y": tileTypeId }, only painted cells are stored
    placedObjectIds: [],
    resources: [], // biomes and areas: { resourceTypeId, availability, notes, known }
    assignedFollowerIds: [], // areas: followers assigned to work there
    notes: '',
    customFields: {}, // Arbiter-made fields: { [fieldId]: { name, type, value } }
  };
}

export function createWorld(name) {
  const now = new Date().toISOString();
  const root = createContainer({ kind: 'world', name });

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      id: newId('world'),
      name,
      currentDay: 1,
      rootContainerId: root.id,
      created: now,
      modified: now,
    },
    definitions: emptyDefinitions(),
    containers: { [root.id]: root },
    placedObjects: {},
    buildings: {}, // see systems/buildings/buildingKind.js for the shape
    followers: {},
    projects: {},
    stockpiles: {
      kingdom: {}, // { resourceTypeId: count }
      byLocation: {}, // { buildingOrContainerId: { resourceTypeId: count } }
    },
    log: {
      actions: [], // command entries: { id, type, payload, day, time }
      redo: [], // undone entries that can be redone
      snapshots: [], // start-of-day snapshots (used from Stage 6)
    },
  };
}

// A short summary stored separately so the world list loads fast.
export function worldSummary(world) {
  return {
    id: world.meta.id,
    name: world.meta.name,
    currentDay: world.meta.currentDay,
    modified: world.meta.modified,
  };
}
