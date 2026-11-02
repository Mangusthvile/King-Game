// Kinds of placed object that stand for their own record outside the
// containers, for example a building (world.buildings). A system registers
// its kind once, and the shared map engine asks it how to handle those
// objects. Regions, Biomes and Areas are containers and don't use this.
//
// registerObjectKind('building', {
//   title:          heading of the detail panel ('Building')
//   placeables:     { [containerKind]: [placeable, ...] } added to that map's
//                   Place tool, for example { biome: [...] }
//   types(world):   the types the Place tool offers ({ id: { id, name } })
//   defaultSize(world, typeId): { w, h } for a new one, or null
//   create(world, object, typeId): fills in the new placed object (refId...)
//                   and returns the records it brings: [{ path, record }]
//   duplicate(world, source, object): same, for a copy of source
//   linkedRecords(world, object): the records removed along with it
//   record(world, object): { path, id, nameField } where its name and
//                   custom fields live
//   footprintChanged(world, object, { x, y, w, h }): an extra command to run
//                   when it is moved or resized, or null
//   draw(ctx, world, object, rect, { name, zoom }): draws it (no sprite set)
//   infoPanel(world, object, view): the detail panel nodes
// })
// Every handler is optional.

const kinds = {};

export function registerObjectKind(kind, handlers) {
  kinds[kind] = handlers;
}

export function objectKind(kind) {
  return kinds[kind] ?? null;
}

// The placeables registered kinds add to maps of a container kind ('biome').
export function extraPlaceables(containerKind) {
  return Object.values(kinds).flatMap((k) => k.placeables?.[containerKind] ?? []);
}

// Map badges: a small tag drawn on the corner of a placed object, for
// example the number of characters in an Area. A system registers a function
// (world, obj) => { text, title } or null. The first one that answers wins.
const badgeSources = [];

export function registerMapBadge(source) {
  badgeSources.push(source);
}

export function mapBadge(world, obj) {
  for (const source of badgeSources) {
    const badge = source(world, obj);
    if (badge) return badge;
  }
  return null;
}

// "Just placed" listeners: another system can react when the Arbiter places
// an object of a kind with the Place tool (not on duplicate or redo), for
// example the Projects system offers to make a Project for a new building.
// listener(world, object) runs after the placement is committed.
const placedListeners = {}; // kind -> [listener]

export function onPlaced(kind, listener) {
  (placedListeners[kind] ??= []).push(listener);
}

export function notifyPlaced(world, object) {
  for (const listener of placedListeners[object.kind] ?? []) listener(world, object);
}
