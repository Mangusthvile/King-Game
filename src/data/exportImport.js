// JSON backups: download a world as a file, or read one back in.
import { migrateWorld } from './migrations.js';
import { withNewId } from './worldOps.js';
import { worldExists, saveWorld } from './storage.js';
import { checkBeforeMigration, checkAfterMigration, WorldFileError } from './validate.js';

export function exportWorld(world) {
  const json = JSON.stringify(world, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const safeName = world.meta.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'world';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName} - Day ${world.meta.currentDay}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Checks a world read from a file and brings it up to the current schema.
// Throws a WorldFileError listing every problem in plain words (validate.js).
// Used by Import JSON, world files and backups.
export function validate(world) {
  const problems = checkBeforeMigration(world);
  if (problems.length) throw new WorldFileError('This file cannot be opened as a world:', problems);
}

export function checkedWorld(raw) {
  validate(raw);
  const { sync: _bookkeeping, ...data } = raw; // a world file's save bookkeeping (sync/worldFile.js), not world data
  let world;
  try {
    world = migrateWorld(structuredClone(data));
  } catch (err) {
    throw new WorldFileError('This world could not be upgraded to the current version:', [err.message]);
  }
  const problems = checkAfterMigration(world);
  if (problems.length) throw new WorldFileError('This world is missing parts the app needs:', problems);
  return world;
}

// Reads a File, validates and migrates it, then saves it.
// Never overwrites an existing world: a clashing id gets a fresh one.
export async function importWorldFile(file) {
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch (err) {
    throw new WorldFileError(`"${file.name}" is not a valid JSON file:`, [err.message]);
  }
  const world = checkedWorld(raw);
  if (await worldExists(world.meta.id)) withNewId(world, `${world.meta.name} (imported)`);
  await saveWorld(world);
  return world;
}
