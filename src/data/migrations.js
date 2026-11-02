// Upgrades saves made with an older schema to the current one.
// To change the schema: bump SCHEMA_VERSION and add migrations[oldVersion].
import { SCHEMA_VERSION, DEFAULT_MAP_SCALE, defaultSettings, DEFAULT_UNDISCOVERED_NAME, defaultSpecies, defaultTeams, defaultTileTypes, defaultRegionTypes, defaultAreaTypes, defaultBuildingCategories } from './schema.js';
import biomeTypeList from './defaults/biomeTypes.json';
import { staminaFormula } from '../rules/stamina.js';

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
    for (const c of Object.values(world.containers)) c.mapScale ??= 10; // the default at the time
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

  // 7 -> 8 (Stage 3.5): the Biome Map is now bounded by the Biome's Region
  // Map footprint, scaled up by its mapScale. A Biome's mapScale was never
  // used before, so it takes the new default. Regions keep theirs, so
  // existing Region Maps don't change.
  7: (world) => {
    for (const c of Object.values(world.containers)) {
      if (c.kind === 'biome') c.mapScale = DEFAULT_MAP_SCALE;
    }
    world.schemaVersion = 8;
    return world;
  },

  // 8 -> 9 (Stage 4): characters. The unused followers collection becomes
  // characters (followers, enemies and NPCs). Adds the character libraries
  // and starter teams, gives species Hunger max, Thirst max and default
  // fields (null = not set, so nothing is invented for species made
  // earlier), and adds or completes Baseliner and Vulture.
  8: (world) => {
    world.characters = { ...(world.followers ?? {}), ...(world.characters ?? {}) };
    delete world.followers;
    const defs = world.definitions;
    if (Object.keys(defs.teams ?? {}).length === 0) defs.teams = defaultTeams();
    for (const key of ['bodyTypes', 'skills', 'traits', 'conditions', 'equipment', 'species']) defs[key] ??= {};
    for (const sp of Object.values(defs.species)) {
      sp.hungerMax ??= null;
      sp.thirstMax ??= null;
      sp.notes ??= '';
      sp.defaultFields ??= {};
      sp.customFields ??= {};
    }
    for (const starter of Object.values(defaultSpecies())) {
      const existing = Object.values(defs.species).find((sp) => sp.name.trim().toLowerCase() === starter.name.toLowerCase());
      if (!existing) {
        defs.species[starter.id] = starter;
        continue;
      }
      // Fill only what is empty; anything the Arbiter set is kept.
      existing.hungerMax ??= starter.hungerMax;
      existing.thirstMax ??= starter.thirstMax;
      if (Object.keys(existing.defaultFields).length === 0) existing.defaultFields = starter.defaultFields;
    }
    world.schemaVersion = 9;
    return world;
  },

  // 9 -> 10: Factions replace Teams on the character sheet. Teams (and
  // Conditions) are kept in the data, in stasis until the Combat stage.
  9: (world) => {
    world.definitions.factions ??= {};
    for (const c of Object.values(world.characters ?? {})) c.factionId ??= '';
    world.schemaVersion = 10;
    return world;
  },

  // 10 -> 11: the daily activity budget is Stamina, separate from the
  // combat stat SPD. Species get a default Stamina (Baseliner 1, others not
  // set). The old daily Speed value (speedRemaining) is copied into
  // staminaRemaining; staminaMax comes from the species default, or that
  // same value if the species has none. SPD is unchanged.
  10: (world) => {
    for (const sp of Object.values(world.definitions.species ?? {})) {
      sp.staminaDefault ??= sp.name?.trim().toLowerCase() === 'baseliner' ? 1 : null;
    }
    for (const c of Object.values(world.characters ?? {})) {
      const old = c.speedRemaining ?? null;
      c.staminaRemaining ??= old;
      c.staminaMax ??= world.definitions.species?.[c.speciesId]?.staminaDefault ?? old;
      delete c.speedRemaining;
    }
    world.schemaVersion = 11;
    return world;
  },

  // 11 -> 12 (Stage 5): Projects. Adds the Day Log, world settings (the
  // optional "(edited)" note in logs) and a character's assigned Project.
  // Earlier versions had no way to make Projects, so existing ones (if any)
  // only get the new fields.
  11: (world) => {
    world.projects ??= {};
    for (const p of Object.values(world.projects)) {
      p.workdays ??= [];
      p.requirements = Array.isArray(p.requirements) ? p.requirements : [];
      p.locationContainerId ??= '';
      p.driveBuilding ??= true;
      p.notes ??= '';
      p.customFields ??= {};
    }
    world.dayLogs ??= {};
    world.meta.settings = { ...defaultSettings(), ...(world.meta.settings ?? {}) };
    for (const c of Object.values(world.characters ?? {})) c.assignmentProjectId ??= '';
    world.schemaVersion = 12;
    return world;
  },

  // 12 -> 13: the Stamina formula (RULES.md, Followers > Stamina). A
  // species' default Stamina becomes its Base Stamina. Characters get
  // staminaMaxOverride (false): their stored Stamina max is kept as it is,
  // and the sheet proposes the formula's value for the Arbiter to accept.
  12: (world) => {
    for (const sp of Object.values(world.definitions.species ?? {})) {
      sp.baseStamina ??= sp.staminaDefault ?? null;
      delete sp.staminaDefault;
    }
    for (const c of Object.values(world.characters ?? {})) c.staminaMaxOverride ??= false;
    // Undo and redo replay old log entries, so species edits follow the rename.
    if (world.log) {
      world.log.actions = world.log.actions.map(renameStaminaDefault);
      world.log.redo = world.log.redo.map(renameStaminaDefault);
    }
    world.schemaVersion = 13;
    return world;
  },

  // 13 -> 14: the Stamina values stored before the formula existed (species
  // defaults, and remaining values copied from the old daily Speed) are
  // brought in line with it once: for every character not overridden whose
  // species has a Base Stamina, Stamina max = the formula, and Stamina
  // remaining is capped at that max. Characters without a Base Stamina
  // (manual) are left alone.
  13: (world) => {
    for (const c of Object.values(world.characters ?? {})) {
      if (c.staminaMaxOverride) continue;
      const max = staminaFormula(world.definitions.species?.[c.speciesId]?.baseStamina, c.SPD);
      if (max === null) continue;
      c.staminaMax = max;
      if (c.staminaRemaining === null || c.staminaRemaining === undefined || c.staminaRemaining > max) c.staminaRemaining = max;
    }
    world.schemaVersion = 14;
    return world;
  },
};

// For migration 12 -> 13: a setField of a species' staminaDefault (at any
// depth inside a batch) now sets baseStamina.
function renameStaminaDefault(entry) {
  if (entry.type === 'setField' && entry.payload?.path === 'definitions.species' && entry.payload.field === 'staminaDefault') {
    return { ...entry, payload: { ...entry.payload, field: 'baseStamina' } };
  }
  if (entry.type === 'batch') return { ...entry, payload: { ...entry.payload, commands: entry.payload.commands.map(renameStaminaDefault) } };
  return entry;
}

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
