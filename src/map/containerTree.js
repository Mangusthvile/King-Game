// Answers "what is inside this Region, Biome or Area?" by walking the
// containers nested under it. Used to remove (and undo removing) a whole
// Region at once, and to warn the Arbiter before that happens.

// Everything nested inside a container, at any depth:
//   containers: the Biomes (and anything deeper) inside it
//   objects:    every placed object on its map and on those nested maps
export function collectInside(world, containerId) {
  const containers = [];
  const objects = [];
  const visit = (id) => {
    for (const objId of world.containers[id]?.placedObjectIds ?? []) {
      const obj = world.placedObjects[objId];
      if (!obj) continue;
      objects.push(obj);
      const child = obj.refId && world.containers[obj.refId];
      if (child && child.parentId === id) {
        containers.push(child);
        visit(child.id);
      }
    }
  };
  visit(containerId);
  return { containers, objects };
}

const KIND_NAMES = { region: ['Region', 'Regions'], biome: ['Biome', 'Biomes'], area: ['Area', 'Areas'] };

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function kindName(kind) {
  return KIND_NAMES[kind]?.[0] ?? kind;
}

// A short list like ["2 Biomes", "5 objects", "40 painted cells"].
// Empty if the container holds nothing.
export function describeInside(world, containerId) {
  const { containers, objects } = collectInside(world, containerId);
  const parts = [];
  for (const [kind, [one, many]] of Object.entries(KIND_NAMES)) {
    const n = containers.filter((c) => c.kind === kind).length;
    if (n) parts.push(plural(n, one, many));
  }
  // Objects that are not themselves Regions, Biomes or Areas (markers, later buildings).
  const others = objects.filter((o) => !(o.refId && world.containers[o.refId])).length;
  if (others) parts.push(plural(others, 'object', 'objects'));
  let cells = Object.keys(world.containers[containerId]?.tiles ?? {}).length;
  for (const c of containers) cells += Object.keys(c.tiles).length;
  if (cells) parts.push(plural(cells, 'painted cell', 'painted cells'));
  return parts;
}

// Asks before removing a Region, Biome or Area that has things inside it.
// Returns true if the removal should go ahead.
export function confirmRemoval(world, objectId) {
  const obj = world.placedObjects[objectId];
  const record = obj?.refId && world.containers[obj.refId];
  if (!record) return true;
  const parts = describeInside(world, record.id);
  if (parts.length === 0) return true;
  return confirm(
    `Remove ${kindName(record.kind)} "${record.name}"?\n\n` +
      `It contains ${parts.join(', ')}. All of it will be removed too.\n\n` +
      'You can undo this with Ctrl+Z.',
  );
}
