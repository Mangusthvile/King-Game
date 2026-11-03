// The shape of one world (campaign) document.
// Bump SCHEMA_VERSION whenever the shape changes, and add a step in migrations.js.
import { newId } from './ids.js';
import tileTypeList from './defaults/tileTypes.json';
import regionTypeList from './defaults/regionTypes.json';
import biomeTypeList from './defaults/biomeTypes.json';
import areaTypeList from './defaults/areaTypes.json';
import buildingCategoryList from './defaults/buildingCategories.json';
import speciesList from './defaults/species.json';
import { defaultFactions } from './factions.js';
import { addStartingCrownBearer } from './crownBearers.js';
import { defaultConnectivity } from '../rules/connectivity.js';
import arbiterOnlyTable from './defaults/arbiterOnlyFields.json';

export const SCHEMA_VERSION = 18;

// Regions and Biomes: how many cells of their own map one cell of their
// parent's map becomes (map/mapFrame.js). Editable per container.
export const DEFAULT_MAP_SCALE = 8;

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

// Starter species (Baseliner, Vulture). Shape:
//   { id, name, baseStamina (Stamina = Base Stamina + FLOOR((SPD - 1) / 2),
//     see rules/stamina.js), hungerMax, thirstMax (null = not set), notes,
//     defaultFields (copied onto a character's custom fields, like Vulture's
//     Mask, Vault Value and Essence notes), customFields }
export function defaultSpecies() {
  return byId(speciesList);
}

// A new species with nothing set yet (typed in the Region panel or a library).
export function createSpecies(name) {
  return { id: newId('species'), name, baseStamina: null, hungerMax: null, thirstMax: null, notes: '', defaultFields: {}, customFields: {} };
}

// World settings (Settings tab). markEdited: Resolution Logs add "(edited)"
// after a value the Arbiter changed by hand. snapshotsKept: how many
// end-of-day snapshots Reverse Day can go back to (data/snapshots.js).
// arbiterOnlyFields: the field names hidden in Player View unless the
// Arbiter shows them (ui/playerView.js; System > Display > Player View).
export const DEFAULT_SNAPSHOTS_KEPT = 30;

export function defaultArbiterOnlyFields() {
  return [...arbiterOnlyTable.fields];
}

export function defaultSettings() {
  return { markEdited: false, snapshotsKept: DEFAULT_SNAPSHOTS_KEPT, arbiterOnlyFields: defaultArbiterOnlyFields() };
}

function emptyDefinitions() {
  return {
    regionTypes: defaultRegionTypes(),
    biomeTypes: defaultBiomeTypes(),
    areaTypes: defaultAreaTypes(),
    buildingTypes: {}, // see systems/buildings/buildingKind.js for the shape
    buildingCategories: defaultBuildingCategories(),
    tileTypes: defaultTileTypes(),
    // { name, description, tags (e.g. ["Food"]), foodValue (Food per unit,
    // default 1; used by the Advance Day meal), customFields }
    resourceTypes: {},
    // Character libraries (Characters tab > Libraries); shapes in
    // systems/characters/libraries.js.
    // Factions own characters, stockpiles, buildings, Projects and tasks;
    // shape in data/factions.js. They replaced the old Teams.
    factions: defaultFactions(),
    species: defaultSpecies(),
    bodyTypes: {},
    skills: {},
    traits: {},
    conditions: {},
    equipment: {},
    theories: {},
    recipes: {},
    // The Connectivity levels' reminder text, editable (rules/connectivity.js).
    connectivity: defaultConnectivity(),
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
    // Regions, Biomes and Areas: the faction that claims it ('' = none).
    // The map draws a border in its color.
    claimFactionId: '',
    // Regions, Biomes and Areas: has it been discovered? Resolution Logs
    // show an undiscovered place as [undiscoveredName] (Location Name Not Discovered).
    discovered: true,
    undiscoveredName: DEFAULT_UNDISCOVERED_NAME,
    // Biomes and Areas: an Environmental Danger Level from
    // rules/tables/dangerLevels.json. '' = not set; for an Area, '' means
    // "same as its Biome". Regions have no Danger Level of their own.
    dangerLevel: '',
    mapScale: DEFAULT_MAP_SCALE, // regions and biomes: own map cells per parent map cell
    speciesIds: [], // regions: species that live there (definitions.species ids)
    civilizations: [], // regions: names of civilizations or cities that reside there
    residentsNotes: '',
    tiles: {}, // sparse: { "x,y": tileTypeId }, only painted cells are stored
    placedObjectIds: [],
    resources: [], // biomes and areas: { resourceTypeId, availability, notes, known }
    // areas: characters assigned to work there (the name is kept from before
    // characters replaced followers, so old saves and undo history still work)
    assignedFollowerIds: [],
    notes: '',
    customFields: {}, // Arbiter-made fields: { [fieldId]: { name, type, value } }
  };
}

export function createWorld(name) {
  const now = new Date().toISOString();
  const root = createContainer({ kind: 'world', name });

  const world = {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      id: newId('world'),
      name,
      currentDay: 1,
      rootContainerId: root.id,
      created: now,
      modified: now,
      settings: defaultSettings(),
    },
    definitions: emptyDefinitions(),
    containers: { [root.id]: root },
    placedObjects: {},
    buildings: {}, // see systems/buildings/buildingKind.js for the shape
    players: {}, // { name, factionIds, connections, notes, customFields }, see data/factions.js and data/crownBearers.js
    crownBearers: {}, // see data/crownBearers.js
    crowns: {}, // relic items attuned to a Crown Bearer, see data/crownBearers.js
    characters: {}, // followers, enemies and NPCs: see systems/characters/characterModel.js
    projects: {}, // see systems/projects/projectModel.js for the shape
    // Simple tasks (systems/time/taskModel.js, owned by a faction): Stamina spent on anything
    // that has no Resolution Method yet (searching, teaching, scouting...).
    tasks: {},
    // The Day Log: each day's Start of Day records (one per Player faction),
    // Resolution Logs, tasks, narration and Advance Day summaries, in order,
    // each entry tagged with its faction.
    // { [day]: { id: String(day), day, startOfDays: { factionId: record },
    //            entries: [{ id, kind, method, refId, factionId, text }] } }
    // (see data/dayLog.js)
    dayLogs: {},
    // Minimal until the Resources stage (systems/resources/stockpileModel.js):
    // { [id]: { id, name, ownerFactionId, placeId ('' = the faction's main
    //   stockpile), counts: { resourceTypeId: count }, notes, customFields } }
    stockpiles: {},
    // Player View: fields the Arbiter marked with the eye toggle, by field
    // key ("character_1.notes"): true = Arbiter-only, false = shown to
    // players. Unlisted fields follow meta.settings.arbiterOnlyFields.
    fieldVisibility: {},
    log: {
      actions: [], // command entries: { id, type, payload, day, time }
      redo: [], // undone entries that can be redone
      snapshots: [], // end-of-day snapshots for Reverse Day (data/snapshots.js)
    },
  };
  addStartingCrownBearer(world); // the First Sky King of Apollyon
  return world;
}

// A short summary stored separately so the world list loads fast.
// savedBy: this computer's device name; size: the saved world in bytes
// (both filled in by storage.js when saving).
export function worldSummary(world, { savedBy = '', size = 0 } = {}) {
  return {
    id: world.meta.id,
    name: world.meta.name,
    currentDay: world.meta.currentDay,
    modified: world.meta.modified,
    savedBy,
    size,
  };
}
