// Commands that change the world's meta information.
import { registerCommand, createCommand } from './registry.js';

registerCommand('renameWorld', {
  label: (p) => `Renamed world "${p.oldName}" to "${p.newName}"`,
  doFn: (world, p) => {
    world.meta.name = p.newName;
    world.containers[world.meta.rootContainerId].name = p.newName;
  },
  undoFn: (world, p) => {
    world.meta.name = p.oldName;
    world.containers[world.meta.rootContainerId].name = p.oldName;
  },
});

registerCommand('setCurrentDay', {
  label: (p) => `Set day from ${p.oldDay} to ${p.newDay}`,
  doFn: (world, p) => {
    world.meta.currentDay = p.newDay;
  },
  undoFn: (world, p) => {
    world.meta.currentDay = p.oldDay;
  },
});

// Helpers so the UI doesn't have to know payload shapes.
export function renameWorld(world, newName) {
  return createCommand('renameWorld', { oldName: world.meta.name, newName });
}

export function setCurrentDay(world, newDay) {
  return createCommand('setCurrentDay', { oldDay: world.meta.currentDay, newDay });
}
