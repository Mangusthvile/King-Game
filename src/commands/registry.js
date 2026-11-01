// Every change to world data is a command. Each command TYPE is registered once
// with how to do it and how to undo it. The payload must hold everything needed
// to reverse the change (for example the old value), so log entries are plain
// JSON and undo still works after reloading or importing a world.

const commandTypes = {};

export function registerCommand(type, { label, doFn, undoFn }) {
  commandTypes[type] = { label, doFn, undoFn };
}

// Builds the command object described in CLAUDE.md: { type, payload, do, undo }.
export function createCommand(type, payload) {
  const def = commandTypes[type];
  if (!def) throw new Error(`Unknown command type: ${type}`);
  return {
    type,
    payload,
    do: (world) => def.doFn(world, payload),
    undo: (world) => def.undoFn(world, payload),
  };
}

// Human-readable text for the Log tab.
export function describeCommand(type, payload) {
  const def = commandTypes[type];
  return def ? def.label(payload) : type;
}
