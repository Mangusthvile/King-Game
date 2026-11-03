// The one central list of game systems.
//
// To add a system:
//   1. Create /src/systems/<name>/index.js that default-exports a system object:
//        { id, name, places: [{ path, render(world, { detailPanel, path }) }] }
//      path says where each screen lives: 'main/sub' or 'main/sub/subsub'
//      (the layout is in ui/tabLayout.js, e.g. 'realm/projects/active').
//      The system keeps its own commands, rules tables, screens and panels
//      in its folder.
//   2. Add one import line and one entry to the list below. Nothing else changes.
//
// A system fits into one of the 6 main tabs (never a 7th). It may add a
// sub-tab to a main tab that has fewer than 5; registerPlace refuses
// anything else.
import { registerPlace } from '../ui/tabLayout.js';
import worldMap from './worldMap/index.js';
import regionMap from './regionMap/index.js';
import biomeMap from './biomeMap/index.js';
import buildings from './buildings/index.js';
import characters from './characters/index.js';
import projects from './projects/index.js';
import resources from './resources/index.js';
import time from './time/index.js';
import factions from './factions/index.js';
import crownBearers from './crownBearers/index.js';
import locations from './locations/index.js';
import chronicle from './chronicle/index.js';
import codex from './codex/index.js';
import settings from './settings/index.js';

export const systems = [worldMap, regionMap, biomeMap, buildings, characters, projects, resources, time, factions, crownBearers, locations, chronicle, codex, settings];

for (const system of systems) {
  for (const place of system.places ?? []) registerPlace(place.path, place.render);
}
