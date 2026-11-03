// Old saves, one for every earlier schemaVersion, for tests/migrations.test.js.
// oldSave(v) is a small world as the app of that version saved it: the
// same campaign (Kie's Grove with the Jade Garden, a marker, and from the
// version they appear, a building, two characters, a Project, the Day Log,
// stockpiles, factions and a Crown Bearer), in that version's own shape.
// Written as data, not by running migrations, so the tests check the
// migrations against what old saves really looked like.

const has = (v, from) => v >= from;

export function oldSave(v) {
  const regionKind = 'region';
  const midKind = v <= 3 ? 'subArea' : 'biome'; // Sub-Areas were renamed Biomes in v4
  const world = {
    schemaVersion: v,
    meta: { id: `world_v${v}`, name: `Old world v${v}`, currentDay: 8, rootContainerId: 'root', created: '2026-01-01T00:00:00.000Z', modified: '2026-01-02T00:00:00.000Z' },
    definitions: { tileTypes: has(v, 2) ? { tile_grass: { id: 'tile_grass', name: 'Grass', color: '#5fbf55', spriteKey: '' } } : {} },
    containers: {
      root: container(v, { id: 'root', kind: 'world', parentId: null, name: `Old world v${v}`, tiles: { '0,0': 'tile_grass' }, placedObjectIds: ['obj_kie', 'obj_marker'] }),
      kie: container(v, { id: 'kie', kind: regionKind, parentId: 'root', name: "Kie's Grove", placedObjectIds: ['obj_jade'] }),
      jade: container(v, { id: 'jade', kind: midKind, parentId: 'kie', name: 'Jade Garden', placedObjectIds: [] }),
    },
    placedObjects: {
      obj_kie: object(v, { id: 'obj_kie', containerId: 'root', kind: regionKind, refId: 'kie', x: 0, y: 0, w: 4, h: 3, label: '' }),
      obj_marker: object(v, { id: 'obj_marker', containerId: 'root', kind: 'marker', refId: null, x: 6, y: 0, w: 1, h: 1, label: 'Tower of Apocalypse' }),
      obj_jade: object(v, { id: 'obj_jade', containerId: 'kie', kind: midKind, refId: 'jade', x: 0, y: 0, w: 3, h: 3, label: '' }),
    },
    log: { actions: [{ id: 'action_1', type: 'setField', payload: { path: 'containers', id: 'kie', field: 'notes', oldValue: '', newValue: 'Old notes', name: "Kie's Grove" }, day: 8, time: '2026-01-02T00:00:00.000Z' }], redo: [] },
  };
  const defs = world.definitions;

  if (has(v, 3)) {
    defs.regionTypes = { regiontype_forest: { id: 'regiontype_forest', name: 'Forest', color: '#3f8f3a', defaultFields: {}, customFields: {} } };
    defs.species = { species_baseliner: species(v, 'species_baseliner', 'Baseliner') };
    defs.resourceTypes = { res_puff: resourceType(v) };
    world.containers.kie.typeId = 'regiontype_forest';
    world.containers.kie.speciesIds = ['species_baseliner'];
  }
  if (v === 3) defs.subAreaTypes = { subareatype_area: { id: 'subareatype_area', name: 'Area', color: '#7fb069', defaultFields: {}, customFields: {} } };
  if (has(v, 4)) {
    defs.biomeTypes = { biometype_wilderness: { id: 'biometype_wilderness', name: 'Wilderness', color: '#7fb069', defaultFields: {}, customFields: {} } };
    defs.areaTypes = { areatype_site: { id: 'areatype_site', name: 'Building Site', color: '#c9a36b', defaultFields: {}, customFields: {} } };
    world.containers.jade.resources = [{ resourceTypeId: 'res_puff', availability: 'Abundant', notes: '', ...(has(v, 7) ? { known: false } : {}) }];
  }
  if (has(v, 6)) {
    defs.buildingTypes = { btype_hole: { id: 'btype_hole', name: 'Sleeping Hole', categoryId: 'bcat_housing', w: 2, h: 2, thresholds: {}, defaultProperties: [], customFields: {} } };
    defs.buildingCategories = { bcat_housing: { id: 'bcat_housing', name: 'Housing', color: '#d9b37a' } };
    world.buildings = { building_hole: building(v) };
  }
  if (has(v, 9)) {
    for (const key of ['bodyTypes', 'skills', 'traits', 'conditions', 'equipment']) defs[key] = {};
    world.characters = { char_king: character(v, 'char_king', 'King', 4), char_seeker: character(v, 'char_seeker', 'Seeker', 2) };
  } else if (has(v, 1)) {
    world.followers = {}; // the unused collection before Stage 4
  }
  if (v >= 9 && v <= 15) {
    defs.teams = { team_ally: { id: 'team_ally', name: 'Ally', color: '#5fbf55' }, team_enemy: { id: 'team_enemy', name: 'Enemy', color: '#c24a4a' } };
    world.characters.char_king.teamId = 'team_ally';
    world.characters.char_seeker.teamId = 'team_enemy';
  }
  if (has(v, 10)) defs.factions = {};
  if (has(v, 12)) {
    world.meta.settings = { markEdited: false, ...(has(v, 15) ? { snapshotsKept: 30 } : {}) };
    world.projects = { proj_hole: project(v) };
    world.dayLogs = { 8: dayLog(v) };
  }
  if (has(v, 15)) {
    world.tasks = {};
    world.log.snapshots = [];
    world.stockpiles = v === 15 ? { kingdom: { res_puff: 12 }, byLocation: { jade: { res_puff: 3 } } } : stockpiles();
  }
  if (has(v, 16)) {
    defs.factions = {
      faction_apollyon: faction('faction_apollyon', 'Apollyon', 'player'),
      faction_vulture: faction('faction_vulture', 'Vulture Pack', 'npc'),
      faction_unaligned: faction('faction_unaligned', 'Unaligned', 'unaligned'),
    };
    world.players = {};
    world.characters.char_king.factionId = 'faction_apollyon';
    world.characters.char_seeker.factionId = 'faction_vulture';
    for (const c of Object.values(world.characters)) c.factionHistory = [{ factionId: c.factionId, fromDay: null, toDay: null, reason: 'Set when factions were added' }];
    for (const c of Object.values(world.containers)) c.claimFactionId = '';
    world.containers.kie.claimFactionId = 'faction_apollyon';
  }
  if (has(v, 17)) {
    world.crownBearers = { bearer_sky: { id: 'bearer_sky', name: 'First Sky King', title: 'First Sky King', factionId: 'faction_apollyon', crownId: 'crown_auth', vesselId: 'char_king', vesselHistory: [], status: 'inVessel', sparkNotes: {}, divergenceNotes: '', notes: '', customFields: {} } };
    world.crowns = { crown_auth: { id: 'crown_auth', name: 'Crown of Authority', attunedBearerId: 'bearer_sky', location: { kind: 'vessel', note: '' }, notes: '', customFields: {} } };
    world.players = { player_1: { id: 'player_1', name: 'Player One', factionIds: ['faction_apollyon'], notes: '', connections: [{ crownBearerId: 'bearer_sky', connectivity: 8, history: [{ day: 7, oldLevel: 9, newLevel: 8, reason: 'Argued' }] }], customFields: {} } };
    defs.connectivity = { levels: [{ level: 9, description: 'Where you are normally at.', notes: '' }] };
  }
  return world;
}

function container(v, c) {
  const out = { description: '', notes: '', tiles: {}, ...c };
  if (has(v, 2)) out.customFields = {};
  if (has(v, 3)) Object.assign(out, { typeId: '', speciesIds: [], civilizations: [] });
  if (has(v, 4)) Object.assign(out, { assignedFollowerIds: [], resources: [], dangerLevel: '' });
  if (has(v, 5)) out.mapScale = 10;
  if (has(v, 7)) Object.assign(out, { discovered: c.id !== 'jade', undiscoveredName: '???' });
  if (has(v, 8) && c.kind === 'biome') out.mapScale = 8;
  return out;
}

function object(v, o) {
  return has(v, 2) ? { spriteKey: '', ...o, color: '', customFields: {} } : { spriteKey: '', ...o };
}

function species(v, id, name) {
  const sp = { id, name };
  if (has(v, 9)) Object.assign(sp, { hungerMax: 5, thirstMax: 3, notes: '', defaultFields: {}, customFields: {} });
  if (v >= 11 && v <= 12) sp.staminaDefault = 1;
  if (has(v, 13)) sp.baseStamina = 1;
  return sp;
}

function resourceType(v) {
  const t = { id: 'res_puff', name: 'Emerald Puff Fruit', description: '', customFields: {} };
  if (has(v, 15)) Object.assign(t, { tags: ['Food'], foodValue: 1 });
  return t;
}

function building(v) {
  return { id: 'building_hole', buildingTypeId: 'btype_hole', name: 'Communal Sleeping Hole', areaId: '', constructionProgress: 40, forcedStage: '', storage: {}, properties: [], stageStamps: {}, notes: '', customFields: {}, ...(has(v, 12) ? { projectId: 'proj_hole' } : {}), ...(has(v, 16) ? { ownerFactionId: 'faction_apollyon' } : {}) };
}

// SPD 4: Baseliner Stamina 1 + FLOOR((4 - 1) / 2) = 2.
function character(v, id, name, spd) {
  const c = { id, name, speciesId: 'species_baseliner', alive: true, STR: 2, SPD: spd, TOU: 2, health: { current: 3, max: 3 }, hunger: { current: 5, max: 5 }, thirst: { current: 3, max: 3 }, locationContainerId: 'jade', notes: 'Secret notes', customFields: {} };
  if (v <= 10) c.speedRemaining = spd;
  else Object.assign(c, { staminaMax: spd, staminaRemaining: spd });
  if (has(v, 10)) c.factionId = '';
  if (has(v, 12)) c.assignmentProjectId = '';
  if (has(v, 13)) c.staminaMaxOverride = false;
  return c;
}

function project(v) {
  return { id: 'proj_hole', name: 'Communal Sleeping Hole', sizeLabel: 'Medium', workloadRequired: 75, workloadCurrent: 30, siteBuildingId: 'building_hole', driveBuilding: true, locationContainerId: 'jade', requirements: [], status: 'active', workdays: [], notes: '', customFields: {}, ...(has(v, 16) ? { ownerFactionId: 'faction_apollyon' } : {}) };
}

function dayLog(v) {
  const entries = [{ id: 'entry_1', kind: 'resolution', method: 'project', refId: 'proj_hole', text: 'Day 8 project roll', ...(has(v, 16) ? { factionId: 'faction_apollyon' } : {}) }];
  const day = { id: '8', day: 8, entries };
  if (has(v, 16)) day.startOfDays = {};
  return day;
}

function stockpiles() {
  return {
    stockpile_faction_apollyon: { id: 'stockpile_faction_apollyon', name: '', ownerFactionId: 'faction_apollyon', placeId: '', counts: { res_puff: 12 }, notes: '', customFields: {} },
    stockpile_at_jade: { id: 'stockpile_at_jade', name: '', ownerFactionId: 'faction_apollyon', placeId: 'jade', counts: { res_puff: 3 }, notes: '', customFields: {} },
  };
}

function faction(id, name, type) {
  return { id, name, type, color: '#888888', bannerIcon: '', leaderId: '', homeContainerId: '', description: '', notes: '', relations: {}, trackNeeds: type === 'player', usesStamina: true, authorityLevel: null, sparkNotes: '', followerCallNotes: '', customFields: {} };
}
