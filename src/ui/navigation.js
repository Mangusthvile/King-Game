// Which tab is open, and which Region and Biome the Region Map and Biome
// Map tabs show. This is view state, not world data, so it never goes
// through commands and is not saved in the world.

const nav = { worldId: null, tab: 'world', regionId: null, biomeId: null };
let listener = () => {};

// main.js redraws the screen whenever the navigation changes.
export function setNavigationListener(fn) {
  listener = fn;
}

// The navigation for this world, with anything that no longer exists
// (removed, or undone) forgotten.
export function getNavigation(world) {
  if (nav.worldId !== world.meta.id) {
    Object.assign(nav, { worldId: world.meta.id, tab: 'world', regionId: null, biomeId: null });
  }
  if (world.containers[nav.regionId]?.kind !== 'region') nav.regionId = null;
  const biome = world.containers[nav.biomeId];
  if (biome?.kind !== 'biome' || biome.parentId !== nav.regionId) nav.biomeId = null;
  return nav;
}

export function navigate(changes) {
  Object.assign(nav, changes);
  listener();
}

// Which kinds of container can be opened as a map. Areas are containers too,
// so a later stage can make them enterable (the inside of a mine) by adding
// 'area' here plus a map tab for it.
const ENTERABLE = ['region', 'biome'];

export function isEnterable(kind) {
  return ENTERABLE.includes(kind);
}

// Opens the map inside a Region (Region Map tab) or Biome (Biome Map tab).
export function enterContainer(world, containerId) {
  const c = world.containers[containerId];
  if (c?.kind === 'region') {
    const keepBiome = world.containers[nav.biomeId]?.parentId === c.id;
    navigate({ tab: 'region', regionId: c.id, biomeId: keepBiome ? nav.biomeId : null });
  } else if (c?.kind === 'biome') {
    navigate({ tab: 'biome', regionId: c.parentId, biomeId: c.id });
  }
}
