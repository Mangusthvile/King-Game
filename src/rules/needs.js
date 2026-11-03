// End-of-day needs: Food, Hunger and the Hungry condition, and condition
// durations. The numbers live in tables/needs.json. Everything here only
// PROPOSES: the Advance Day wizard shows it and the Arbiter can change it.
//
// Source: the Arbiter's Stage 6 brief. RULES.md does not describe Food or
// Hunger yet. RULE NEEDED: Thirst (manual for now), death from hunger (only
// flagged, never automatic), and whether eating removes Hungry (proposed,
// on by default, the Arbiter can untick it).
import table from './tables/needs.json';

export const NEEDS = table;

const isNumber = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// A resource type counts as food if one of its tags is "Food" (or "[Food]").
export function isFood(type) {
  const want = table.foodTag.toLowerCase();
  return (type?.tags ?? []).some((t) => String(t).replace(/[[\]]/g, '').trim().toLowerCase() === want);
}

// Food per unit of a resource type.
export function foodValueOf(type) {
  return isNumber(type?.foodValue) ? Number(type.foodValue) : table.defaultFoodValue;
}

export function foodNeeded(eaters) {
  return eaters * table.foodPerCharacterPerDay;
}

// portions: [{ count, foodValue }] -> total Food.
export function foodProvided(portions) {
  return portions.reduce((sum, p) => sum + (Number(p.count) || 0) * (Number(p.foodValue) || 0), 0);
}

// Hunger after the day. hunger: { current, max }. A character with no
// Hunger set (e.g. a Vulture) is left as is.
//   { current, max, changed, atRisk }
export function hungerAfter(hunger, fed) {
  const current = hunger?.current;
  const max = hunger?.max;
  if (fed) {
    if (!isNumber(max)) return { current, max, changed: false, atRisk: false };
    return { current: Number(max), max, changed: Number(max) !== current, atRisk: false };
  }
  if (!isNumber(current)) return { current, max, changed: false, atRisk: false };
  const next = Math.max(0, Number(current) - table.unfedHungerLoss);
  return { current: next, max, changed: next !== current, atRisk: next <= 0 };
}

const isHungry = (c) => (c.name ?? '').toLowerCase() === table.hungryCondition.name.toLowerCase();

export function hungryCondition(conditions) {
  return (conditions ?? []).find(isHungry) ?? null;
}

// Conditions after the meal:
//   unfed: Hungry is added, or its day count goes up by 1
//   fed:   Hungry is removed if removeHungry
// conditionId is the library's Hungry condition if the Arbiter made one.
export function conditionsAfterMeal(conditions, fed, { removeHungry = true, conditionId = '', day = null } = {}) {
  const list = conditions ?? [];
  const current = hungryCondition(list);
  if (fed) return removeHungry && current ? list.filter((c) => c !== current) : list;
  const days = (current?.daysWithoutFood ?? 0) + 1;
  const hungry = {
    conditionId: current?.conditionId ?? conditionId,
    name: table.hungryCondition.name,
    modifier: table.hungryCondition.modifier,
    durationDays: current?.durationDays ?? null,
    daysWithoutFood: days,
    note: `${days} day${days === 1 ? '' : 's'} without food${day !== null ? ` (as of Day ${day})` : ''}`,
  };
  return current ? list.map((c) => (c === current ? hungry : c)) : [...list, hungry];
}

// Conditions with a duration count down by 1 at the end of the day.
// Returns one row per condition that has a duration:
//   { index, name, before, after, expires }
export function conditionCountdown(conditions) {
  return (conditions ?? []).flatMap((c, index) => {
    if (!isNumber(c.durationDays) || Number(c.durationDays) <= 0) return [];
    const before = Number(c.durationDays);
    const after = before - 1;
    return [{ index, name: c.name || '(unnamed condition)', before, after, expires: after <= 0 }];
  });
}

// The proposed meal: eat foods in the order given until `needed` Food is
// reached (or the food runs out). items: [{ count, foodValue }].
// Returns how many of each item to eat, in the same order.
export function proposeMeal(items, needed) {
  let left = needed;
  return items.map((item) => {
    if (left <= 0 || !(item.foodValue > 0)) return 0;
    const eat = Math.min(item.count, Math.ceil(left / item.foodValue));
    left -= eat * item.foodValue;
    return eat;
  });
}
