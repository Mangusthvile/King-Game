// Upgrades saves made with an older schema to the current one.
// To change the schema: bump SCHEMA_VERSION and add migrations[oldVersion].
import { SCHEMA_VERSION, DEFAULT_MAP_SCALE, DEFAULT_UNDISCOVERED_NAME, defaultTileTypes, defaultRegionTypes, defaultAreaTypes, defaultBuildingCategories } from './schema.js';
import biomeTypeList from './defaults/biomeTypes.json';

// migrations[n] turns a version n world into a version n + 1 world.
const migrations = {
  // 1 -> 2 (Stage 1): custom fields on containers and placed objects, a color
  // for placed objects, and starter tile types for worlds that have none.
  1: (world) => {
    for (const c of Object.values(world.containers)) c.customFields ??= {};
    for (const o of Object.values(world.placedObjects)) {
      o.customFields ??= {};
      o.color ??= '';
    }
    if (Object.keys(world.definitions.tileTypes).length === 0) {
      world.definitions.tileTypes = defaultTileTypes();
    }
    world.schemaVersion = 2;
    return world;
  },

  // 2 -> 3 (Stage 2): container types, species and civilizations on
  // containers, and starter Region / Sub-Area types.
  2: (world) => {
    for (const c of Object.values(world.containers)) {
      c.typeId ??= '';
      c.speciesIds ??= [];
      c.civilizations ??= [];
    }
    const defs = world.definitions;
    if (Object.keys(defs.regionTypes ?? {}).length === 0) defs.regionTypes = defaultRegionTypes();
    // Written as plain data: later versions renamed Sub-Area types to Biome types.
    if (Object.keys(defs.subAreaTypes ?? {}).length === 0) {
      defs.subAreaTypes = {
        subareatype_area: { id: 'subareatype_area', name: 'Area', color: '#7fb069', defaultFields: {}, customFields: {} },
        subareatype_settlement: { id: 'subareatype_settlement', name: 'Settlement', color: '#d9b37a', defaultFields: {}, customFields: {} },
      };
    }
    defs.species ??= {};
    defs.resourceTypes ??= {};
    world.schemaVersion = 3;
    return world;
  },

  // 3 -> 4 (terminology change): Sub-Areas are now Biomes, and Areas (a
  // mine, a farm...) are a new, smaller level placed on a Biome's map.
  3: (world) => {
    const rename = renameSubAreas;
    for (const c of Object.values(world.containers)) {
      c.kind = rename(c.kind);
      c.typeId = rename(c.typeId);
      c.assignedFollowerIds ??= [];
    }
    for (const o of Object.values(world.placedObjects)) o.kind = rename(o.kind);

    const defs = world.definitions;
    defs.biomeTypes = {};
    for (const type of Object.values(defs.subAreaTypes ?? {})) {
      const renamed = { ...type, id: rename(type.id) };
      // The old starter type "Area" clashes with the new Areas, so it becomes
      // "Wilderness" unless the Arbiter had already renamed it.
      if (type.id === 'subareatype_area' && type.name === 'Area') renamed.name = 'Wilderness';
      defs.biomeTypes[renamed.id] = renamed;
    }
    if (Object.keys(defs.biomeTypes).length === 0) {
      defs.biomeTypes = Object.fromEntries(biomeTypeList.map((t) => [t.id, structuredClone(t)]));
    }
    delete defs.subAreaTypes;
    // The old starter Region type "Biome" would now be confusing.
    const oldBiomeRegionType = defs.regionTypes?.regiontype_biome;
    if (oldBiomeRegionType?.name === 'Biome') oldBiomeRegionType.name = 'Wilds';
    if (Object.keys(defs.areaTypes ?? {}).length === 0) defs.areaTypes = defaultAreaTypes();

    // Undo and redo replay old log entries, so their payloads are renamed too.
    world.log.actions = rename(world.log.actions);
    world.log.redo = rename(world.log.redo);
    world.schemaVersion = 4;
    return world;
  },

  // 4 -> 5: the Region Map is bounded by the Region's World Map footprint,
  // scaled up by mapScale. (Regions' old dangerLevel values are kept but no
  // longer shown: danger belongs to Biomes.)
  4: (world) => {
    for (const c of Object.values(world.containers)) c.mapScale ??= DEFAULT_MAP_SCALE;
    world.schemaVersion = 5;
    return world;
  },

  // 5 -> 6 (Stage 3): buildings. Earlier versions had no way to make building
  // types or buildings, so only the starter building categories are new.
  5: (world) => {
    const defs = world.definitions;
    defs.buildingTypes ??= {};
    if (Object.keys(defs.buildingCategories ?? {}).length === 0) defs.buildingCategories = defaultBuildingCategories();
    world.buildings ??= {};
    world.schemaVersion = 6;
    return world;
  },

  // 6 -> 7: discovery, for Resolution Logs. Everything already on the map
  // starts discovered, and every listed resource starts known.
  6: (world) => {
    for (const c of Object.values(world.containers)) {
      c.discovered ??= true;
      c.undiscoveredName ??= DEFAULT_UNDISCOVERED_NAME;
      for (const r of c.resources ?? []) r.known ??= true;
    }
    world.schemaVersion = 7;
    return world;
  },
};

// For migration 3 -> 4: renames every Sub-Area name used as data, at any
// depth (kinds, type ids, the type collection path in log payloads).
const SUB_AREA_RENAMES = {
  subArea: 'biome',
  'definitions.subAreaTypes': 'definitions.biomeTypes',
  subareatype_area: 'biometype_wilderness',
  subareatype_settlement: 'biometype_settlement',
};

function renameSubAreas(value) {
  if (typeof value === 'string') return SUB_AREA_RENAMES[value] ?? value;
  if (Array.isArray(value)) return value.map(renameSubAreas);
  if (value && typeof value === 'object') {
    // Keys are renamed too, so { subareatype_area: {...} } collections follow.
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [SUB_AREA_RENAMES[k] ?? k, renameSubAreas(v)]));
  }
  return value;
}

export function migrateWorld(world) {
  if (world.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `This world was saved by a newer version of the app (schema ${world.schemaVersion}).`,
    );
  }
  while (world.schemaVersion < SCHEMA_VERSION) {
    const step = migrations[world.schemaVersion];
    if (!step) throw new Error(`No migration from schema ${world.schemaVersion}.`);
    world = step(world);
  }
  return world;
}
