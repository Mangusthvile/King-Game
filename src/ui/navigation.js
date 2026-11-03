// Where the Arbiter is: the main tab, sub-tab and sub-sub-tab (see
// tabLayout.js), plus which Region and Biome the map tabs show. View state,
// not world data: it never goes through commands and is not saved in the
// world.
//
// Each main tab remembers the last sub-tab opened, and each sub-tab the last
// sub-sub-tab. nav.tab is the old flat tab id of the open slot ('world',
// 'region', 'biome', 'projects'...), kept for the map breadcrumb.
import { MAIN_TABS, mainTab, subTab, pathForAlias } from './tabLayout.js';

const nav = { worldId: null, main: 'world', sub: 'worldMap', subsub: '', tab: 'world', regionId: null, biomeId: null };
const lastSub = {}; // main id -> sub id
const lastSubsub = {}; // 'main/sub' -> subsub id
let listener = () => {};

// main.js redraws the screen whenever the navigation changes.
export function setNavigationListener(fn) {
  listener = fn;
}

// Fills in a valid sub-tab and sub-sub-tab for nav.main (the remembered ones).
function settle() {
  const m = mainTab(nav.main) ?? MAIN_TABS[0];
  nav.main = m.id;
  if (!subTab(m.id, nav.sub)) nav.sub = lastSub[m.id] && subTab(m.id, lastSub[m.id]) ? lastSub[m.id] : m.subs[0].id;
  const s = subTab(m.id, nav.sub);
  const key = `${m.id}/${s.id}`;
  if (!s.subsubs.some((x) => x.id === nav.subsub)) nav.subsub = s.subsubs.find((x) => x.id === lastSubsub[key])?.id ?? s.subsubs[0]?.id ?? '';
  lastSub[m.id] = s.id;
  if (nav.subsub) lastSubsub[key] = nav.subsub;
  nav.tab = s.alias ?? key;
}

// The navigation for this world, with anything that no longer exists
// (removed, or undone) forgotten.
export function getNavigation(world) {
  if (nav.worldId !== world.meta.id) {
    Object.assign(nav, { worldId: world.meta.id, main: 'world', sub: 'worldMap', subsub: '', regionId: null, biomeId: null });
    for (const k of Object.keys(lastSub)) delete lastSub[k];
    for (const k of Object.keys(lastSubsub)) delete lastSubsub[k];
  }
  if (world.containers[nav.regionId]?.kind !== 'region') nav.regionId = null;
  const biome = world.containers[nav.biomeId];
  if (biome?.kind !== 'biome' || biome.parentId !== nav.regionId) nav.biomeId = null;
  settle();
  return nav;
}

export const currentPath = () => [nav.main, nav.sub, nav.subsub].filter(Boolean).join('/');

// changes: { main, sub, subsub, regionId, biomeId } or the old { tab: 'projects' }.
// Picking a main tab alone opens its remembered sub-tab.
export function navigate(changes = {}) {
  const { tab, ...rest } = changes;
  if (tab) {
    const target = pathForAlias(tab);
    if (target) Object.assign(rest, { ...target, subsub: rest.subsub ?? '' });
  }
  if (rest.main && rest.main !== nav.main && !('sub' in rest)) rest.sub = '';
  if (rest.sub !== undefined && rest.sub !== nav.sub && !('subsub' in rest)) rest.subsub = '';
  Object.assign(nav, rest);
  settle();
  listener();
}

// Opens a path like 'realm/projects/active'.
export function navigatePath(path) {
  const [main, sub = '', subsub = ''] = path.split('/');
  navigate({ main, sub, subsub });
}

// Which kinds of container can be opened as a map. Areas are containers too,
// so a later stage can make them enterable (the inside of a mine) by adding
// 'area' here plus a map slot for it.
const ENTERABLE = ['region', 'biome'];

export function isEnterable(kind) {
  return ENTERABLE.includes(kind);
}

// Opens the map inside a Region (Region Map) or Biome (Biome Map).
export function enterContainer(world, containerId) {
  const c = world.containers[containerId];
  if (c?.kind === 'region') {
    const keepBiome = world.containers[nav.biomeId]?.parentId === c.id;
    navigate({ tab: 'region', regionId: c.id, biomeId: keepBiome ? nav.biomeId : null });
  } else if (c?.kind === 'biome') {
    navigate({ tab: 'biome', regionId: c.parentId, biomeId: c.id });
  }
}
