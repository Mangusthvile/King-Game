// Body Types (the Arbiter's Body Types table, references/body-types.json).
// Pure lookups that PROPOSE stats from a Body Type's level table; the
// Arbiter accepts or overrides them. No combat math lives here.
//   bodyType: { maxLevel (null = not yet established), statCeiling (null =
//               none set), levels: [{ lv, bodyLv, STR, SPD, TOU, notes }] }
export const BODY_STATS = ['STR', 'SPD', 'TOU'];

// The table row for a Body Type level, or null if the table has none.
export function levelRow(bodyType, level) {
  return bodyType?.levels?.find((row) => Number(row.lv) === Number(level)) ?? null;
}

// What the table says a character at this Body Type level should have:
// { bodyLevel, STR, SPD, TOU } or null.
export function proposedStats(bodyType, level) {
  const row = levelRow(bodyType, level);
  return row ? { bodyLevel: row.bodyLv, STR: row.STR, SPD: row.SPD, TOU: row.TOU } : null;
}

// The stats that differ from the proposal: [{ key, current, proposed }].
export function differencesFromTable(character, proposal) {
  if (!proposal) return [];
  return ['bodyLevel', ...BODY_STATS]
    .filter((key) => Number(character[key]) !== Number(proposal[key]))
    .map((key) => ({ key, current: character[key], proposed: proposal[key] }));
}

// The stats above the Body Type's ceiling (a warning, never a block).
export function statsOverCeiling(character, bodyType) {
  const ceiling = bodyType?.statCeiling;
  if (ceiling === null || ceiling === undefined || ceiling === '') return [];
  return BODY_STATS.filter((key) => Number(character[key]) > Number(ceiling));
}

// The next Body Type level: { level, row } where row may be null if the
// table doesn't have it yet, or null if the character is at maxLevel.
export function nextBodyLevel(bodyType, level) {
  if (!bodyType) return null;
  const next = Number(level || 0) + 1;
  const max = bodyType.maxLevel;
  if (max !== null && max !== undefined && max !== '' && next > Number(max)) return null;
  return { level: next, row: levelRow(bodyType, next) };
}
