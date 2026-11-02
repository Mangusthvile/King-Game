// Health max (King's Game - Combat Profiles sheet, Character Roster tab):
//   Health = MAX(1, ROUNDUP((Body Level + STR + TOU) / 3))
// The numbers live in tables/health.json. The result is a PROPOSAL: the
// character's Health max is a stored field the Arbiter can set to anything.
import table from './tables/health.json';

// null if any of the three stats is missing.
export function healthFormula(bodyLevel, STR, TOU) {
  const raw = [bodyLevel, STR, TOU];
  if (raw.some((v) => v === null || v === undefined || v === '')) return null;
  const values = raw.map(Number);
  if (values.some((v) => !Number.isFinite(v))) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.max(table.minimum, Math.ceil(sum / table.divisor));
}

// The formula for a character (or for proposed stats { bodyLevel, STR, TOU }).
export function healthFor(stats) {
  return healthFormula(stats.bodyLevel, stats.STR, stats.TOU);
}
