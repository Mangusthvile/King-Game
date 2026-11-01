// JSON backups: download a world as a file, or read one back in.
import { migrateWorld } from './migrations.js';
import { newId } from './ids.js';
import { worldExists, saveWorld } from './storage.js';

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

// Checks only what the app needs to open the world. Anything else is kept as-is.
function validate(world) {
  if (!world || typeof world !== 'object') throw new Error('File is not a world.');
  if (typeof world.schemaVersion !== 'number') throw new Error('Missing schemaVersion.');
  if (!world.meta || !world.meta.id || !world.meta.name) throw new Error('Missing meta.');
  for (const key of ['definitions', 'containers', 'log']) {
    if (!world[key]) throw new Error(`Missing "${key}".`);
  }
}

// Reads a File, validates and migrates it, then saves it.
// Never overwrites an existing world: a clashing id gets a fresh one.
export async function importWorldFile(file) {
  let world;
  try {
    world = JSON.parse(await file.text());
  } catch {
    throw new Error('File is not valid JSON.');
  }
  validate(world);
  world = migrateWorld(world);

  if (await worldExists(world.meta.id)) {
    world.meta.id = newId('world');
    world.meta.name = `${world.meta.name} (imported)`;
  }
  await saveWorld(world);
  return world;
}
