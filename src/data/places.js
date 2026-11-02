// Read-only helpers about places (Regions, Biomes, Areas) shared by every
// system: pickers, the Danger Level that applies there, and how
// Resolution Logs name a place.
import dangerTable from '../rules/tables/dangerLevels.json';

export const DANGER_LEVELS = dangerTable.levels;

// Every Region, Biome and Area as a select option, indented under its parent.
export function placeOptions(world) {
  const options = [];
  const visit = (parentId, depth) => {
    for (const c of Object.values(world.containers)) {
      if (c.parentId !== parentId || !['region', 'biome', 'area'].includes(c.kind)) continue;
      options.push({ value: c.id, label: `${'  '.repeat(depth)}${depth ? '└ ' : ''}${c.name}` });
      visit(c.id, depth + 1);
    }
  };
  visit(world.meta.rootContainerId, 0);
  return options;
}

// The Environmental Danger Level that applies at a place: its own, else (for
// an Area with none) its Biome's. Regions have none. '' = not set.
export function dangerAt(world, containerId) {
  const c = world.containers[containerId];
  if (!c || c.kind === 'region' || c.kind === 'world') return '';
  if (c.dangerLevel) return c.dangerLevel;
  return c.kind === 'area' ? world.containers[c.parentId]?.dangerLevel ?? '' : '';
}

// How a log names a place (CLAUDE.md, Resolution Logs):
//   discovered:   "Building Site (Jade Garden, Kie's Grove)"
//   undiscovered: "[???] (Location Name Not Discovered)"
// Undiscovered parents in the brackets are shown by their undiscovered name.
export function logPlaceName(world, containerId) {
  const c = world.containers[containerId];
  if (!c || c.kind === 'world') return 'Not set';
  const shown = (x) => (x.discovered === false ? `[${x.undiscoveredName || '???'}]` : x.name);
  if (c.discovered === false) return `${shown(c)} (Location Name Not Discovered)`;
  const parents = [];
  for (let p = world.containers[c.parentId]; p && p.kind !== 'world'; p = world.containers[p.parentId]) parents.push(shown(p));
  return parents.length ? `${c.name} (${parents.join(', ')})` : c.name;
}
