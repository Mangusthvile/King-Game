// Factions and players: the shared model every system uses for ownership.
//
// world.definitions.factions[id]:
//   { id, name, type ('player' | 'npc' | 'wild' | 'unaligned'), color,
//     bannerIcon (a short symbol or emoji, '' = first letter of the name),
//     leaderId (a character), homeContainerId (a Region, Biome or Area),
//     description, notes,
//     relations: { otherFactionId: stance id }   its stance toward each
//                other faction; each direction is separate; unset = Neutral
//     trackNeeds   Advance Day runs the Meal and Needs steps for it
//     usesStamina  Advance Day resets its characters' Stamina
//     authorityLevel, sparkNotes, followerCallNotes   Player factions
//                (manual until the Authority rules are automated)
//     customFields }
// world.players[id]: { id, name, factionIds: [the factions they control],
//   connections: [links to Crown Bearers with a Connectivity level, see
//   data/crownBearers.js], notes, customFields }
//
// Ownership: characters have factionId (+ factionHistory), and stockpiles,
// buildings, Projects and simple tasks have ownerFactionId. Regions, Biomes
// and Areas may be claimed (claimFactionId). '' = no faction.
import { newId } from './ids.js';
import defaultFactionList from './defaults/factions.json';
import stanceTable from './defaults/stances.json';

export const FACTION_TYPES = [
  { id: 'player', name: 'Player' },
  { id: 'npc', name: 'NPC' },
  { id: 'wild', name: 'Wild/Monster' },
  { id: 'unaligned', name: 'Unaligned' },
];

export const STANCES = stanceTable.stances;
export const DEFAULT_STANCE = stanceTable.defaultStance;

export function createFaction(name = 'New Faction', type = 'npc', values = {}) {
  return {
    id: newId('faction'),
    name,
    type,
    color: '#888888',
    bannerIcon: '',
    leaderId: '',
    homeContainerId: '',
    description: '',
    notes: '',
    relations: {},
    trackNeeds: type === 'player',
    usesStamina: true,
    authorityLevel: null,
    sparkNotes: '',
    followerCallNotes: '',
    customFields: {},
    ...values,
  };
}

// The starter factions (Apollyon, Vulture Pack, Unaligned) with their
// relations, keyed by id. Used by new worlds and the migration to factions.
export function defaultFactions() {
  const factions = {};
  for (const { fromTeams, ...f } of defaultFactionList) factions[f.id] = createFaction(f.name, f.type, f);
  for (const r of stanceTable.initialRelations) if (factions[r.from]) factions[r.from].relations[r.to] = r.stance;
  return factions;
}

// The starter faction an old team name (Ally, Enemy...) becomes.
export function factionIdForTeam(teamName) {
  const name = String(teamName ?? '').trim().toLowerCase();
  const match = defaultFactionList.find((f) => f.fromTeams.some((t) => t.toLowerCase() === name));
  return (match ?? defaultFactionList.find((f) => f.type === 'unaligned')).id;
}

export function createPlayer(name = 'New Player') {
  return { id: newId('player'), name, factionIds: [], connections: [], notes: '', customFields: {} };
}

export const getFaction = (world, id) => world.definitions.factions?.[id] ?? null;

export function factionName(world, id) {
  if (!id) return 'No faction';
  return getFaction(world, id)?.name ?? '(deleted faction)';
}

export function factionColor(world, id) {
  return getFaction(world, id)?.color ?? '';
}

// The banner icon, or the first letter of the name.
export function factionIcon(faction) {
  return faction?.bannerIcon || (faction?.name ?? '?').charAt(0).toUpperCase();
}

const TYPE_ORDER = Object.fromEntries(FACTION_TYPES.map((t, i) => [t.id, i]));

// Every faction: Player factions first, then by name.
export function factionList(world) {
  return Object.values(world.definitions.factions ?? {}).sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || a.name.localeCompare(b.name));
}

export const factionOptions = (world) => factionList(world).map((f) => ({ value: f.id, label: f.name }));

export const stanceName = (id) => STANCES.find((s) => s.id === id)?.name ?? id;

// How `fromId` stands toward `toId`.
export function stanceOf(world, fromId, toId) {
  return getFaction(world, fromId)?.relations?.[toId] || DEFAULT_STANCE;
}

// The end-of-day settings. A character with no faction (or a deleted one):
// needs not tracked, Stamina used.
export function factionSettings(world, id) {
  const f = getFaction(world, id);
  return { trackNeeds: !!f?.trackNeeds, usesStamina: f ? f.usesStamina !== false : true };
}

// Filtering by the faction selector: '' = All factions.
export const ownedBy = (record, factionId) => !factionId || (record.ownerFactionId ?? '') === factionId;
export const inFaction = (character, factionId) => !factionId || (character.factionId ?? '') === factionId;

// The factions that have living characters or own something, plus '' (no
// faction) if any living character has none. For grouping by faction.
export function activeFactionIds(world) {
  const ids = new Set(Object.values(world.characters).filter((c) => c.alive).map((c) => c.factionId ?? ''));
  const ordered = factionList(world).map((f) => f.id).filter((id) => ids.has(id));
  return ids.has('') ? [...ordered, ''] : ordered;
}
