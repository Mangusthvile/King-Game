// Moves between factions: resources (trade, gift, theft or loss), a
// building, a character. Each is ONE undoable command that also logs an
// entry in the Day Log of both factions (one entry if only one faction is
// involved, as with a loss).
import { setField, batch } from '../../commands/recordCommands.js';
import { addDayLogEntries, newEntry } from '../../data/dayLog.js';
import { factionName } from '../../data/factions.js';
import { stockpileName, setCounts } from '../resources/stockpileModel.js';

export const RESOURCE_TRANSFER_KINDS = [
  { id: 'trade', name: 'Trade' },
  { id: 'gift', name: 'Gift' },
  { id: 'theft', name: 'Theft' },
  { id: 'loss', name: 'Loss' },
];

// One entry per faction involved (factions: ids, '' skipped, no repeats).
function entriesFor(factions, text, refId) {
  return [...new Set(factions.filter(Boolean))].map((factionId) => newEntry('transfer', text, { method: 'transfer', refId, factionId }));
}

const reasonText = (reason) => (reason?.trim() ? `\nReason: ${reason.trim()}` : '');

// t: { kind, fromStockpileId, toStockpileId, resourceTypeId, count,
//      returnResourceTypeId, returnCount (trade only), note }
// Why it can't be done yet ('' = it can).
export function resourceTransferBlocker(world, t) {
  const from = world.stockpiles[t.fromStockpileId];
  const to = world.stockpiles[t.toStockpileId];
  if (!from) return 'Pick the stockpile it comes from.';
  if (!t.resourceTypeId) return 'Pick a resource.';
  if (!(t.count > 0)) return 'Enter how many.';
  if (t.kind !== 'loss' && !to) return 'Pick the stockpile it goes to.';
  if (t.kind !== 'loss' && to.id === from.id) return 'Pick two different stockpiles.';
  if (t.kind === 'trade' && t.returnResourceTypeId && !(t.returnCount > 0)) return 'Enter how many come back in return.';
  return '';
}

export function transferResources(world, t) {
  const day = world.meta.currentDay;
  const types = world.definitions.resourceTypes;
  const from = world.stockpiles[t.fromStockpileId];
  const to = t.kind === 'loss' ? null : world.stockpiles[t.toStockpileId];
  const what = `${t.count} ${types[t.resourceTypeId]?.name ?? 'resource'}`;
  const back = t.kind === 'trade' && t.returnResourceTypeId && t.returnCount > 0 ? `${t.returnCount} ${types[t.returnResourceTypeId]?.name ?? 'resource'}` : '';
  const A = factionName(world, from.ownerFactionId);
  const B = to ? factionName(world, to.ownerFactionId) : '';

  const fromCounts = { ...from.counts };
  const toCounts = to ? { ...to.counts } : null;
  const move = (counts, id, n) => (counts[id] = Math.max(0, (counts[id] ?? 0) + n));
  move(fromCounts, t.resourceTypeId, -t.count);
  if (toCounts) move(toCounts, t.resourceTypeId, t.count);
  if (back) {
    move(toCounts, t.returnResourceTypeId, -t.returnCount);
    move(fromCounts, t.returnResourceTypeId, t.returnCount);
  }

  const where = (s) => ` (${stockpileName(world, s)} stockpile)`;
  const line = {
    trade: `${A} traded ${what}${where(from)} to ${B}${to ? where(to) : ''}${back ? ` for ${back}` : ''}.`,
    gift: `${A} gave ${what}${where(from)} to ${B}${to ? where(to) : ''}.`,
    theft: `${B} stole ${what} from ${A}${where(from)}.`,
    loss: `${A} lost ${what}${where(from)}.`,
  }[t.kind];
  const kindName = RESOURCE_TRANSFER_KINDS.find((k) => k.id === t.kind)?.name ?? 'Transfer';
  const text = `Day ${day} - ${kindName}\n==============================\n${line}${reasonText(t.note)}`;

  return batch(`${kindName}: ${line}`, [
    setCounts(world, from.id, fromCounts),
    to ? setCounts(world, to.id, toCounts) : null,
    addDayLogEntries(world, day, entriesFor([from.ownerFactionId, to?.ownerFactionId], text, '')),
  ]);
}

export function transferBuilding(world, buildingId, toFactionId, reason = '') {
  const b = world.buildings[buildingId];
  const day = world.meta.currentDay;
  const line = `${b.name} passed from ${factionName(world, b.ownerFactionId)} to ${factionName(world, toFactionId)}.`;
  const text = `Day ${day} - Building Transfer\n==============================\n${line}${reasonText(reason)}`;
  return batch(`Building transfer: ${line}`, [
    setField(world, 'buildings', b.id, 'ownerFactionId', toFactionId, b.name),
    addDayLogEntries(world, day, entriesFor([b.ownerFactionId, toFactionId], text, b.id)),
  ]);
}

// The new faction history: the open entry ends today, a new one starts.
export function historyAfterMove(c, toFactionId, day, reason) {
  const history = (c.factionHistory ?? []).map((h) => (h.toDay === null || h.toDay === undefined || h.toDay === '' ? { ...h, toDay: day } : h));
  return [...history, { factionId: toFactionId, fromDay: day, toDay: null, reason: reason.trim() }];
}

export function moveCharacter(world, characterId, toFactionId, reason = '') {
  const c = world.characters[characterId];
  const day = world.meta.currentDay;
  const line = c.factionId ? `${c.name} left ${factionName(world, c.factionId)} and joined ${factionName(world, toFactionId)}.` : `${c.name} joined ${factionName(world, toFactionId)}.`;
  const text = `Day ${day} - Faction Change\n==============================\n${line}${reasonText(reason)}`;
  return batch(`Faction change: ${line}`, [
    setField(world, 'characters', c.id, 'factionId', toFactionId, c.name),
    setField(world, 'characters', c.id, 'factionHistory', historyAfterMove(c, toFactionId, day, reason), c.name),
    addDayLogEntries(world, day, entriesFor([c.factionId, toFactionId], text, c.id)),
  ]);
}
