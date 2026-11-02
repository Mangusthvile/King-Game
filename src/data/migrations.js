// Upgrades saves made with an older schema to the current one.
// To change the schema: bump SCHEMA_VERSION and add migrations[oldVersion].
import { SCHEMA_VERSION, defaultTileTypes } from './schema.js';

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
};

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
