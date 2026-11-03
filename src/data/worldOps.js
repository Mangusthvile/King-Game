// Making new worlds from existing ones (the world list, Stage 7):
//   duplicateWorld: a full copy with a new id (for testing, or a "what if"
//                   timeline). Not linked to the original's world file.
//   templateWorld:  a new world with another world's libraries and rules
//                   (every definition, the world settings) but no
//                   characters, map, Projects or history.
//   renameSavedWorld: renames a world that is not open, through the same
//                   renameWorld command the open world uses (so it is in its
//                   action log and can be undone after opening it).
import { newId } from './ids.js';
import { createWorld } from './schema.js';
import { addStartingCrownBearer } from './crownBearers.js';
import { applyCommand } from './store.js';
import { renameWorld } from '../commands/worldCommands.js';

export function duplicateWorld(world, name = `${world.meta.name} (copy)`) {
  const copy = withNewId(structuredClone(world), name);
  const now = new Date().toISOString();
  copy.meta.created = now;
  copy.meta.modified = now;
  return copy;
}

// Gives a world (changed in place) a new id and name. Snapshots hold whole
// worlds, so theirs change too: restoring one must stay in this world, not
// turn back into the original (same id) and overwrite it when saved. Also
// used by Import JSON when the id is already taken.
export function withNewId(world, name) {
  world.meta.id = newId('world');
  for (const w of [world, ...(world.log?.snapshots ?? []).map((s) => s.world).filter((x) => x?.meta)]) {
    w.meta.id = world.meta.id;
    w.meta.name = name;
    if (w.containers?.[w.meta.rootContainerId]) w.containers[w.meta.rootContainerId].name = name;
  }
  return world;
}

export function templateWorld(source, name) {
  const world = createWorld(name);
  world.definitions = structuredClone(source.definitions);
  world.meta.settings = { ...structuredClone(source.meta.settings ?? {}), factionReview: false };
  // Leaders and homes pointed at characters and places that are not copied.
  for (const f of Object.values(world.definitions.factions ?? {})) {
    f.leaderId = '';
    f.homeContainerId = '';
  }
  // The starting Crown Bearer is made for this world's factions (the ones
  // copied from the template), not the default ones createWorld used.
  world.crownBearers = {};
  world.crowns = {};
  world.players = {};
  addStartingCrownBearer(world);
  return world;
}

export function renameSavedWorld(world, name) {
  applyCommand(world, renameWorld(world, name));
  world.meta.modified = new Date().toISOString();
  return world;
}
