// Checks a world before the app opens it (Import JSON, world files, backups),
// so a broken or foreign file gives clear messages instead of breaking the
// app. Two passes:
//   before migrating: is it a King's Game world at all, from a version this
//                     app can read (schemaVersion 1 to SCHEMA_VERSION)?
//   after migrating:  does it have everything the current version needs?
// Each returns a list of problems in plain words ([] = fine). Anything the
// checks don't mention is kept as it is.
import { SCHEMA_VERSION } from './schema.js';

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function checkBeforeMigration(world) {
  if (!isObject(world)) return ['The file is not a world (it holds no JSON object).'];
  const problems = [];
  const v = world.schemaVersion;
  if (v === undefined) problems.push('It has no schemaVersion, so it is probably not a King\'s Game world.');
  else if (!Number.isInteger(v) || v < 1) problems.push(`Its schemaVersion (${JSON.stringify(v)}) is not a version number.`);
  else if (v > SCHEMA_VERSION) problems.push(`It was saved by a newer version of the app (schema ${v}; this app reads up to ${SCHEMA_VERSION}). Update the app first.`);
  if (!isObject(world.meta)) problems.push('It has no "meta" section (name, day, id).');
  else {
    if (!world.meta.id) problems.push('meta.id (the world id) is missing.');
    if (!world.meta.name) problems.push('meta.name (the world name) is missing.');
  }
  for (const key of ['definitions', 'containers', 'log']) {
    if (!isObject(world[key])) problems.push(`The "${key}" section is missing.`);
  }
  if (isObject(world.log) && !Array.isArray(world.log.actions)) problems.push('log.actions (the action log) is missing.');
  return problems;
}

// Collections every current world has (plain objects keyed by id).
const COLLECTIONS = ['containers', 'placedObjects', 'buildings', 'players', 'crownBearers', 'crowns', 'characters', 'projects', 'tasks', 'dayLogs', 'stockpiles', 'fieldVisibility'];
const DEFINITIONS = ['regionTypes', 'biomeTypes', 'areaTypes', 'buildingTypes', 'buildingCategories', 'tileTypes', 'resourceTypes', 'factions', 'species', 'bodyTypes', 'skills', 'traits', 'equipment'];

export function checkAfterMigration(world) {
  const problems = [];
  if (world.schemaVersion !== SCHEMA_VERSION) problems.push(`It did not upgrade to schema ${SCHEMA_VERSION} (it is at ${world.schemaVersion}).`);
  const m = world.meta ?? {};
  if (!Number.isFinite(m.currentDay)) problems.push('meta.currentDay (the day number) is missing or not a number.');
  if (!isObject(m.settings)) problems.push('meta.settings is missing.');
  for (const key of COLLECTIONS) if (!isObject(world[key])) problems.push(`The "${key}" collection is missing.`);
  for (const key of DEFINITIONS) if (!isObject(world.definitions?.[key])) problems.push(`The "definitions.${key}" library is missing.`);
  for (const key of ['actions', 'redo', 'snapshots']) if (!Array.isArray(world.log?.[key])) problems.push(`log.${key} is missing.`);
  if (isObject(world.containers)) {
    const root = world.containers[m.rootContainerId];
    if (!root || root.kind !== 'world') problems.push('The World Map (the root container) is missing.');
    for (const [id, c] of Object.entries(world.containers)) {
      if (c?.id !== id) problems.push(`Container "${id}" is stored under the wrong id.`);
      else if (c.kind !== 'world' && !world.containers[c.parentId]) problems.push(`${c.name || id} belongs to a place that does not exist.`);
    }
  }
  return problems.slice(0, 20); // a broken file could list thousands
}

// An error that carries the list of problems, for the import message.
export class WorldFileError extends Error {
  constructor(intro, problems) {
    super(`${intro}\n- ${problems.join('\n- ')}`);
    this.intro = intro;
    this.problems = problems;
  }
}
