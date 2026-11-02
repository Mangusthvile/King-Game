// The one central list of game systems.
//
// To add a system:
//   1. Create /src/systems/<name>/index.js that default-exports a system object:
//        { id, name, tabs: [{ id, label, render(world, { detailPanel }) }] }
//      The system keeps its own commands, rules tables, tab and panels in its folder.
//   2. Add one import line and one entry to the list below. Nothing else changes.
//
// A tab whose id matches a built-in placeholder tab (for example 'world')
// takes that tab's place; any other tab is added to the end of the tab bar.
import worldMap from './worldMap/index.js';
import regionMap from './regionMap/index.js';
import biomeMap from './biomeMap/index.js';
import buildings from './buildings/index.js';
import characters from './characters/index.js';
import projects from './projects/index.js';

export const systems = [worldMap, regionMap, biomeMap, buildings, characters, projects];

export function getSystemTabs() {
  return systems.flatMap((system) => system.tabs ?? []);
}
