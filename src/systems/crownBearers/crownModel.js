// Commands and read-only helpers for Crown Bearers, Crowns and the Players'
// Connectivity (shapes in data/crownBearers.js). Every change is a command.
// Connectivity is never enforced: its level text is only shown.
import { setField, batch } from '../../commands/recordCommands.js';
import { CROWN_LOCATIONS } from '../../data/crownBearers.js';
import { factionName } from '../../data/factions.js';

const isOpen = (line) => line.toDay === null || line.toDay === undefined || line.toDay === '';

// The vessel history with the open line closed today.
function closeVesselLine(bearer, day, ended) {
  return (bearer.vesselHistory ?? []).map((line) => (isOpen(line) ? { ...line, toDay: day, ended } : line));
}

// "Change vessel": the old vessel's line ends with `reason`, the new one
// starts today. newCharacterId '' = without a vessel.
export function changeVessel(world, bearer, newCharacterId, reason = '') {
  const day = world.meta.currentDay;
  const next = world.characters[newCharacterId];
  const history = closeVesselLine(bearer, day, reason.trim() || 'Changed vessel');
  if (next) history.push({ characterId: next.id, name: next.name, fromDay: day, toDay: null, ended: '' });
  return batch(next ? `${bearer.name} took ${next.name} as vessel` : `${bearer.name} left their vessel`, [
    setField(world, 'crownBearers', bearer.id, 'vesselHistory', history, bearer.name),
    setField(world, 'crownBearers', bearer.id, 'vesselId', next?.id ?? '', bearer.name),
    setField(world, 'crownBearers', bearer.id, 'status', next ? 'inVessel' : 'withoutVessel', bearer.name),
  ]);
}

export const bearersInVessel = (world, characterId) => Object.values(world.crownBearers ?? {}).filter((b) => b.vesselId && b.vesselId === characterId);

// A vessel died: its Crown Bearers are left without a vessel. No automatic
// recovery: the Arbiter is asked where the Crown is now.
export function vesselDeathCommands(world, character, cause, day) {
  return bearersInVessel(world, character.id).flatMap((b) => [
    setField(world, 'crownBearers', b.id, 'vesselHistory', closeVesselLine(b, day, `Died${cause ? `: ${cause}` : ''}`), b.name),
    setField(world, 'crownBearers', b.id, 'vesselId', '', b.name),
    setField(world, 'crownBearers', b.id, 'status', 'withoutVessel', b.name),
  ]);
}

export function setCrownLocation(world, crown, location) {
  return setField(world, 'crowns', crown.id, 'location', { kind: 'unknown', containerId: '', characterId: '', note: '', ...location }, crown.name);
}

// Where a Crown is, in words.
export function crownLocationText(world, crown) {
  const loc = crown?.location ?? { kind: 'unknown' };
  const note = loc.note ? ` (${loc.note})` : '';
  if (loc.kind === 'vessel') {
    const bearer = world.crownBearers?.[crown.attunedBearerId];
    const vessel = world.characters[bearer?.vesselId];
    return `Worn by ${vessel ? vessel.name : 'the vessel (no vessel now)'}${note}`;
  }
  if (loc.kind === 'place') return `At ${world.containers[loc.containerId]?.name ?? '(no place set)'}${note}`;
  if (loc.kind === 'character') return `Held by ${world.characters[loc.characterId]?.name ?? '(no one set)'}${note}`;
  return `${CROWN_LOCATIONS.find((l) => l.id === 'unknown').name}${note}`;
}

// Every player link to a Crown Bearer: [{ player, connection, index }].
export function connectionsOf(world, bearerId) {
  return Object.values(world.players ?? {}).flatMap((player) =>
    (player.connections ?? []).map((connection, index) => ({ player, connection, index })).filter((x) => x.connection.crownBearerId === bearerId),
  );
}

// A new Connectivity level for one link, with a history line.
export function setConnectivity(world, player, index, newLevel, reason = '') {
  const connections = player.connections.map((c, i) =>
    i === index ? { ...c, connectivity: newLevel, history: [...(c.history ?? []), { day: world.meta.currentDay, oldLevel: c.connectivity, newLevel, reason: reason.trim() }] } : c,
  );
  return setField(world, 'players', player.id, 'connections', connections, player.name);
}

export const bearersOfFaction = (world, factionId) => Object.values(world.crownBearers ?? {}).filter((b) => b.factionId === factionId);

export function bearerLabel(world, b) {
  const title = b.title && b.title !== b.name ? `, ${b.title}` : '';
  return `${b.name}${title} (${factionName(world, b.factionId)})`;
}
