// Connectivity (RULES.md, Crown Bearers > Connectivity): the link between a
// Player and a Crown Bearer, 1 to 10. Each level's text is a REMINDER for
// the Arbiter; nothing here changes what a Crown Bearer can do.
// The default text is in tables/connectivity.json; each world keeps an
// editable copy in definitions.connectivity.
import table from './tables/connectivity.json';

export const CONNECTIVITY_MIN = table.min;
export const CONNECTIVITY_MAX = table.max;

export function defaultConnectivity() {
  return { levels: structuredClone(table.levels) };
}

// A whole level from 1 to 10, or null if it isn't a number.
export function clampConnectivity(value) {
  const n = Math.round(Number(value));
  if (value === '' || value === null || !Number.isFinite(n)) return null;
  return Math.max(CONNECTIVITY_MIN, Math.min(CONNECTIVITY_MAX, n));
}

// The world's text for a level: { level, description, notes } or null.
export function connectivityLevel(world, level) {
  const levels = world?.definitions?.connectivity?.levels ?? table.levels;
  return levels.find((l) => l.level === level) ?? null;
}

// The levels written in a RULES.md text ("10: ..." lines under the
// Connectivity heading), to check the table against the rules.
export function parseConnectivitySection(rulesText) {
  const start = rulesText.indexOf('Connectivity (subject to change');
  if (start < 0) return [];
  const levels = [];
  for (const line of rulesText.slice(start).split(/\r?\n/).slice(2)) {
    const m = line.match(/^(\d+): (.*)$/);
    if (!m) break;
    levels.push({ level: Number(m[1]), description: m[2] });
  }
  return levels;
}
