// The shape of one world (campaign) document.
// Bump SCHEMA_VERSION whenever the shape changes, and add a step in migrations.js.
import { newId } from './ids.js';
import tileTypeList from './defaults/tileTypes.json';

export const SCHEMA_VERSION = 2;

// Collections are plain objects keyed by record id. Plain objects (not Map)
// so the whole world can be saved to IndexedDB and exported as JSON as-is.
// Starter paint colors, keyed by id. The Arbiter can rename, recolor, add and
// delete them in the app (Paint tool panel).
export function defaultTileTypes() {
  return Object.fromEntries(tileTypeList.map((t) => [t.id, structuredClone(t)]));
}

function emptyDefinitions() {
  return {
    regionTypes: {},
    subAreaTypes: {},
    buildingTypes: {},
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
    kind, // 'world' | 'region' | 'subArea'
    parentId,
    name,
    description: '',
    dangerLevel: '', // free text until the map stages use the Danger table
    residentsNotes: '',
    tiles: {}, // sparse: { "x,y": tileTypeId }, only painted cells are stored
    placedObjectIds: [],
    resources: [], // sub-areas only: { resourceTypeId, availability, notes }
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
    buildings: {},
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
