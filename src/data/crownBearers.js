// Crown Bearers, Crowns and the Players' links to them (RULES.md, Crown
// Bearers). The shared shapes; the commands and screens are in
// systems/crownBearers.
//
// world.crownBearers[id]:
//   { id, name, title (e.g. "First Sky King"), pronouns, personalityNotes
//     (personality and values), authorityLevel, factionId (the faction they
//     rule), crownId, vesselId (a character, '' = none),
//     vesselHistory: [{ characterId, name, fromDay, toDay, ended }],
//     status: 'inVessel' | 'withoutVessel',
//     sparkNotes: { [day]: text }   Spark of Change notes per day
//     divergenceNotes, notes, customFields }
// world.crowns[id]:
//   { id, name, description, attunedBearerId,
//     location: { kind: 'vessel' (worn by the attuned Crown Bearer's vessel)
//                     | 'place' (containerId) | 'character' (characterId)
//                     | 'unknown', containerId, characterId, note },
//     notes, customFields }
// A player's link (world.players[id].connections):
//   [{ crownBearerId, connectivity (1-10), history: [{ day, oldLevel, newLevel, reason }] }]
import { newId } from './ids.js';

export const CROWN_LOCATIONS = [
  { id: 'vessel', name: 'Worn by the vessel' },
  { id: 'place', name: 'At a map location' },
  { id: 'character', name: 'Held by another character' },
  { id: 'unknown', name: 'Unknown' },
];

export const BEARER_STATUSES = [
  { id: 'inVessel', name: 'In vessel' },
  { id: 'withoutVessel', name: 'Without vessel' },
];

export function createCrownBearer(values = {}) {
  return {
    id: newId('bearer'),
    name: 'New Crown Bearer',
    title: '',
    pronouns: '',
    personalityNotes: '',
    authorityLevel: null,
    factionId: '',
    crownId: '',
    vesselId: '',
    vesselHistory: [],
    status: 'withoutVessel',
    sparkNotes: {},
    divergenceNotes: '',
    notes: '',
    customFields: {},
    ...values,
  };
}

export function createCrown(values = {}) {
  return {
    id: newId('crown'),
    name: 'New Crown',
    description: '',
    attunedBearerId: '',
    location: { kind: 'unknown', containerId: '', characterId: '', note: '' },
    notes: '',
    customFields: {},
    ...values,
  };
}

export function createConnection(crownBearerId, connectivity = 9) {
  return { crownBearerId, connectivity, history: [] };
}

// The starting Crown Bearer of the campaign: the First Sky King of
// Apollyon, with the Crown of Authority. The vessel is left for the Arbiter.
//   { bearer, crown } (not yet in any world)
export function firstSkyKing(factionId, authorityLevel = null) {
  const bearer = createCrownBearer({ name: 'First Sky King', title: 'First Sky King', factionId, authorityLevel });
  const crown = createCrown({ name: 'Crown of Authority', attunedBearerId: bearer.id, location: { kind: 'vessel', containerId: '', characterId: '', note: '' } });
  bearer.crownId = crown.id;
  return { bearer, crown };
}

// Adds the First Sky King (ruling Apollyon, Connectivity 9) and the Crown of
// Authority to a world that has no Crown Bearer yet. Used by new worlds and
// by the migration to schema 17. Every player controlling Apollyon gets a
// link at Connectivity 9; if none does, a placeholder player is made.
// Changes `world` in place (it is not open yet, so this is not a command).
export function addStartingCrownBearer(world) {
  world.crownBearers ??= {};
  world.crowns ??= {};
  world.players ??= {};
  if (Object.keys(world.crownBearers).length) return;
  const factions = Object.values(world.definitions.factions ?? {});
  const apollyon = factions.find((f) => f.id === 'faction_apollyon') ?? factions.find((f) => f.name?.toLowerCase() === 'apollyon');
  if (!apollyon) return;
  const { bearer, crown } = firstSkyKing(apollyon.id, apollyon.authorityLevel ?? null);
  world.crownBearers[bearer.id] = bearer;
  world.crowns[crown.id] = crown;
  let players = Object.values(world.players).filter((p) => p.factionIds?.includes(apollyon.id));
  if (!players.length) {
    const placeholder = { id: newId('player'), name: "Apollyon's Player", factionIds: [apollyon.id], notes: 'Made by the app: rename me.', connections: [], customFields: {} };
    world.players[placeholder.id] = placeholder;
    players = [placeholder];
  }
  for (const p of players) p.connections = [...(p.connections ?? []), createConnection(bearer.id, 9)];
}

// The Connectivity of every Crown Bearer ruling a faction:
//   [{ bearer, player, level }] (one per player link)
export function factionConnectivity(world, factionId) {
  const bearers = Object.values(world.crownBearers ?? {}).filter((b) => b.factionId === factionId);
  return bearers.flatMap((bearer) =>
    Object.values(world.players ?? {}).flatMap((player) =>
      (player.connections ?? []).filter((c) => c.crownBearerId === bearer.id).map((c) => ({ bearer, player, level: c.connectivity })),
    ),
  );
}
