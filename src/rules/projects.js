// Project Resolution Method (RULES.md). Pure functions; every number comes
// from tables/projects.json. The results are PROPOSALS: the Arbiter can edit
// any die, bonus or total before a workday is accepted.
import table from './tables/projects.json';
import { skillBonus } from './skills.js';

export const PROJECT_SIZES = table.sizes; // [{ id, name, workload, orMore }]
export const PROJECT_EVENTS = table.events; // [{ id, name, min, max, description, effectOptions }]
export const DIE_CHOICES = table.dieChoices; // die sides the Arbiter can pick by hand
export const EVENT_DIE = table.eventDie;

export function sizeById(id) {
  return PROJECT_SIZES.find((s) => s.id === id) ?? null;
}

// "Moderate", or "Monumental (2,500+)" style label for lists.
export function sizeLabel(size) {
  return `${size.name} (${size.workload.toLocaleString('en-US')}${size.orMore ? '+' : ''})`;
}

// The Work Die (number of sides) for the relevant Skill's Tier:
// no Skill (tier '' or null) = d4, T1 = d6 ... T5 = d20.
// A special tier such as "Inner Monster" has no row in the table: returns
// null and the Arbiter picks the die by hand.
// RULE NEEDED: which Work Die a special-tier Skill gives.
export function workDieForTier(tier) {
  if (!tier) return table.workDice.none;
  return table.workDice[String(tier).toUpperCase().replace(/\s+/g, '')] ?? null;
}

// The Level of the relevant Skill is added to every Work Die: +0 at Lv1,
// +1 per Level, up to +9. No Skill = +0.
export function levelBonus(level) {
  if (level === null || level === undefined || level === '') return 0;
  return Math.min(table.maxLevelBonus, skillBonus(level));
}

// The Project Event for a d20 roll, or null for a roll outside 1 to 20.
export function eventForRoll(roll) {
  return PROJECT_EVENTS.find((e) => roll >= e.min && roll <= e.max) ?? null;
}

export function eventById(id) {
  return PROJECT_EVENTS.find((e) => e.id === id) ?? null;
}

// One participant's work. RULES.md has exactly two modifiers:
//   - the relevant Skill's Level bonus, added to EVERY Work Die (bonus);
//   - tools that make the task easier "increase the amount of work an
//     individual can do per turn": toolBonus, added once to their work for
//     the workday. How much a tool adds is the Arbiter's call. A tool the
//     Project requires is the baseline and adds nothing.
// Returns null while any die has no result yet.
export function participantWork({ rolls, bonus = 0, toolBonus = 0 }) {
  if (rolls.some((r) => !Number.isFinite(r))) return null;
  const perDie = rolls.map((r) => r + bonus);
  return perDie.reduce((a, b) => a + b, 0) + toolBonus;
}

// The day's total work, or null while anyone's dice are unrolled.
export function totalWork(participants) {
  let total = 0;
  for (const p of participants) {
    const work = participantWork(p);
    if (work === null) return null;
    total += work;
  }
  return total;
}

// The new Current Workload: before + today's work + any change from the
// Event (negative for Progress loss). Never below 0.
export function workloadAfter(before, work, eventChange = 0) {
  return Math.max(0, before + work + eventChange);
}

// The linked building's constructionProgress: current / required as a
// percent, 0 to 100 (rounded to whole percents).
export function buildingProgress(current, required) {
  if (!(required > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((current / required) * 100)));
}

export function isWorkloadReached(current, required) {
  return required > 0 && current >= required;
}
