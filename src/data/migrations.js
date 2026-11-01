// Upgrades saves made with an older schema to the current one.
// To change the schema: bump SCHEMA_VERSION and add migrations[oldVersion].
import { SCHEMA_VERSION } from './schema.js';

// migrations[n] turns a version n world into a version n + 1 world.
const migrations = {
  // 1: (world) => { ...; world.schemaVersion = 2; return world; },
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
