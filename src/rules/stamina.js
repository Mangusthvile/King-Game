// Stamina max (RULES.md, Followers > Stamina):
//   Stamina = Species Base Stamina + FLOOR((SPD - 1) / 2)
// The numbers live in tables/stamina.json. The result is a PROPOSAL: a
// character's Stamina max is a stored field the Arbiter can override.
// Conditions, Traits and other effects that modify Stamina are not applied
// here; the Arbiter adds them through the override.
import table from './tables/stamina.json';

const isNumber = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// The Stamina SPD adds: FLOOR((SPD - 1) / 2). null if SPD is not set.
export function staminaFromSpd(SPD) {
  if (!isNumber(SPD)) return null;
  return Math.floor((Number(SPD) - table.spdOffset) / table.spdDivisor);
}

// Stamina max, or null if the Base Stamina or SPD is not set.
export function staminaFormula(baseStamina, SPD) {
  const fromSpd = staminaFromSpd(SPD);
  if (!isNumber(baseStamina) || fromSpd === null) return null;
  return Number(baseStamina) + fromSpd;
}

// The formula with its parts, for the sheet:
//   { base, fromSpd, total, text: "1 base + 1 from SPD 4 = 2" }
// or null when it can't be worked out.
export function staminaBreakdown(baseStamina, SPD) {
  const total = staminaFormula(baseStamina, SPD);
  if (total === null) return null;
  const base = Number(baseStamina);
  const fromSpd = staminaFromSpd(SPD);
  const sign = fromSpd < 0 ? '-' : '+';
  return { base, fromSpd, total, text: `${base} base ${sign} ${Math.abs(fromSpd)} from SPD ${SPD} = ${total}` };
}
