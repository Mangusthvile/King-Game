// The navigation layout (CLAUDE.md, Interface > Navigation): at most 6 main
// tabs, each with at most 5 sub-tabs, and sub-sub-tabs only where a
// sub-tab needs them. This file is the one map of where every screen lives.
// Systems fill the slots with registerPlace (systems/registry.js) instead of
// adding tabs of their own; a slot nobody fills shows a "Coming in a later
// stage" note.
//
// A path is 'main/sub' or 'main/sub/subsub', e.g. 'realm/projects/active'.
//
// Planned future placements (not built yet):
//   Realm > Resources:  Recipes, Crafting (sub-sub-tabs)
//   Realm > Factions:   Morale, Territory, Tech Tree (sub-sub-tabs)
//   Realm > Today:      Harvesting and Training as Task types
//   People > Progression: Skill Tree (sub-sub-tab)
//   People > Military:  a new sub-tab with Units, Armies, Combat

export const MAX_MAIN_TABS = 6;
export const MAX_SUB_TABS = 5;

const sub = (id, label, subsubs = [], extra = {}) => ({ id, label, subsubs: subsubs.map(([sid, slabel, more = {}]) => ({ id: sid, label: slabel, ...more })), ...extra });

// alias: the old flat tab id, so navigate({ tab: 'projects' }) still works
// and the map breadcrumb can tell which map is open.
// planned: shown as a placeholder until that stage registers the slot.
export const MAIN_TABS = [
  {
    id: 'world',
    label: 'World',
    icon: '🗺',
    subs: [
      sub('worldMap', 'World Map', [], { alias: 'world' }),
      sub('regionMap', 'Region Map', [], { alias: 'region' }),
      sub('biomeMap', 'Biome Map', [], { alias: 'biome' }),
      sub('locations', 'Locations', [['regions', 'Regions'], ['biomes', 'Biomes'], ['areas', 'Areas']]),
    ],
  },
  {
    id: 'realm',
    label: 'Realm',
    icon: '♜',
    followsFaction: true,
    subs: [
      sub('today', 'Today', [['overview', 'Overview'], ['tasks', 'Tasks'], ['advanceDay', 'Advance Day']], { alias: 'today' }),
      sub('projects', 'Projects', [['active', 'Active'], ['planned', 'Planned'], ['completed', 'Completed']], { alias: 'projects' }),
      sub('resources', 'Resources', [['stockpiles', 'Stockpiles'], ['transfers', 'Transfers']], { alias: 'resources' }),
      sub('buildings', 'Buildings', [['byArea', 'By Area'], ['all', 'All']], { alias: 'buildings' }),
      sub('factions', 'Factions', [['factions', 'Factions'], ['relations', 'Relations']], { alias: 'factions' }),
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: '☺',
    subs: [
      sub('roster', 'Roster', [['living', 'Living'], ['deathLog', 'Death Log']], { alias: 'characters' }),
      sub('crownBearers', 'Crown Bearers', [['bearers', 'Bearers'], ['connectivity', 'Connectivity'], ['vessels', 'Vessels']], { alias: 'crownBearers' }),
      sub('progression', 'Progression', [['theoriesSkills', 'Theories & Skills']]),
    ],
  },
  {
    id: 'chronicle',
    label: 'Chronicle',
    icon: '📜',
    subs: [
      sub('dayLog', 'Day Log', [['byDay', 'By Day'], ['copyDay', 'Copy Day']], { alias: 'log' }),
      sub('notes', 'Notes', [], { planned: 'Stage 8' }),
      sub('history', 'History'),
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    icon: '📖',
    arbiterOnly: true, // hidden in Player View
    subs: [
      sub('library', 'Library', [
        ['species', 'Species'],
        ['bodyTypes', 'Body Types'],
        ['skills', 'Skills'],
        ['traits', 'Traits'],
        ['conditions', 'Conditions'],
        ['equipment', 'Equipment'],
        ['resourceTypes', 'Resource Types'],
      ]),
      sub('worldTypes', 'World Types', [['region', 'Region'], ['biome', 'Biome'], ['area', 'Area'], ['building', 'Building'], ['tiles', 'Tile Types']]),
      sub('rules', 'Rules', [['tables', 'Rule Tables'], ['templates', 'Log Templates'], ['openRules', 'Open Rules']]),
      sub('assets', 'Assets', [['library', 'Asset Library', { planned: 'Stage 9' }], ['stamps', 'Stamps', { planned: 'Stage 9' }]]),
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: '⚙',
    subs: [
      sub('worlds', 'Worlds', [['open', 'Open'], ['saveFile', 'Save File'], ['importExport', 'Import/Export'], ['backups', 'Backups'], ['storage', 'Storage']], { alias: 'settings' }),
      sub('display', 'Display', [['theme', 'Theme', { planned: 'Stage 8.5' }], ['playerView', 'Player View']]),
      sub('preferences', 'Preferences', [['deviceName', 'Device Name'], ['autosave', 'Autosave'], ['snapshots', 'Snapshots']]),
    ],
  },
];

export function mainTab(id) {
  return MAIN_TABS.find((m) => m.id === id) ?? null;
}

export function subTab(mainId, subId) {
  return mainTab(mainId)?.subs.find((s) => s.id === subId) ?? null;
}

export const splitPath = (path) => {
  const [main, sub, subsub = ''] = path.split('/');
  return { main, sub, subsub };
};

// ---- Places: what each slot renders ----

const places = new Map(); // path -> render(world, { detailPanel, path })

// Checks a path against the layout. A new sub-tab (or sub-sub-tab) may be
// added to an existing main tab while there is room; a new main tab never.
function ensureSlot(path) {
  const { main, sub: subId, subsub } = splitPath(path);
  const m = mainTab(main);
  if (!m) throw new Error(`"${path}": there is no main tab "${main}". New systems must fit into one of the ${MAX_MAIN_TABS} main tabs.`);
  let s = subTab(main, subId);
  if (!s) {
    if (m.subs.length >= MAX_SUB_TABS) throw new Error(`"${path}": ${m.label} already has ${MAX_SUB_TABS} sub-tabs.`);
    s = sub(subId, subId);
    m.subs.push(s);
  }
  if (subsub && !s.subsubs.some((x) => x.id === subsub)) s.subsubs.push({ id: subsub, label: subsub });
}

export function registerPlace(path, render) {
  ensureSlot(path);
  places.set(path, render);
}

export const placeRender = (path) => places.get(path) ?? null;
export const registeredPaths = () => [...places.keys()];

// The old flat tab ids (navigate({ tab })) and where they now live.
export function pathForAlias(alias) {
  for (const m of MAIN_TABS) for (const s of m.subs) if (s.alias === alias) return { main: m.id, sub: s.id };
  return null;
}
