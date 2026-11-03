// Stockpiles (minimal until the Resources stage): resource counts owned by
// a faction. Each faction has a main stockpile and may keep more at places.
//   world.stockpiles[id]: { id, name ('' = named from owner and place),
//     ownerFactionId, placeId ('' = the faction's main stockpile),
//     counts: { resourceTypeId: count }, notes, customFields }
// Resource names, tags and Food values belong to the resource type
// (definitions.resourceTypes), so they are the same in every stockpile.
// Counts change with setField on 'stockpiles', so every change undoes.
import { newId } from '../../data/ids.js';
import { setField } from '../../commands/recordCommands.js';
import { factionName, ownedBy, factionList } from '../../data/factions.js';
import { isFood, foodValueOf } from '../../rules/needs.js';

export function createStockpile(ownerFactionId, placeId = '') {
  return { id: newId('stockpile'), name: '', ownerFactionId, placeId, counts: {}, notes: '', customFields: {} };
}

export function stockpileName(world, s) {
  if (!s) return '(removed stockpile)';
  if (s.name) return s.name;
  const owner = factionName(world, s.ownerFactionId);
  return s.placeId ? `${owner} at ${world.containers[s.placeId]?.name ?? '(removed place)'}` : `${owner} main`;
}

// A faction's stockpiles ('' = every stockpile), main stockpiles first,
// in faction order.
export function stockpilesOf(world, factionId) {
  const order = Object.fromEntries(factionList(world).map((f, i) => [f.id, i]));
  return Object.values(world.stockpiles ?? {})
    .filter((s) => ownedBy(s, factionId))
    .sort((a, b) => (order[a.ownerFactionId] ?? 99) - (order[b.ownerFactionId] ?? 99) || (a.placeId ? 1 : 0) - (b.placeId ? 1 : 0));
}

export function mainStockpile(world, factionId) {
  return Object.values(world.stockpiles ?? {}).find((s) => s.ownerFactionId === factionId && !s.placeId) ?? null;
}

// The command that replaces a stockpile's counts.
export function setCounts(world, stockpileId, counts, label) {
  const s = world.stockpiles[stockpileId];
  return setField(world, 'stockpiles', stockpileId, 'counts', counts, label ?? stockpileName(world, s));
}

// count null removes the resource from the stockpile.
export function setStockCount(world, stockpileId, resourceTypeId, count) {
  const counts = { ...world.stockpiles[stockpileId].counts };
  if (count === null) delete counts[resourceTypeId];
  else counts[resourceTypeId] = count;
  return setCounts(world, stockpileId, counts);
}

// Every food in a faction's stockpiles:
//   [{ stockpileId, stockpileName, resourceTypeId, name, count, foodValue }]
export function foodItems(world, factionId) {
  const types = world.definitions.resourceTypes;
  return stockpilesOf(world, factionId).flatMap((s) =>
    Object.entries(s.counts ?? {})
      .filter(([id, count]) => isFood(types[id]) && count > 0)
      .map(([id, count]) => ({ stockpileId: s.id, stockpileName: stockpileName(world, s), resourceTypeId: id, name: types[id].name, count, foodValue: foodValueOf(types[id]) })),
  );
}

// Total Food in a faction's stockpiles ('' = all).
export function foodAvailable(world, factionId) {
  return foodItems(world, factionId).reduce((sum, f) => sum + f.count * f.foodValue, 0);
}
