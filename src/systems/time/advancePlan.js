// The Advance Day proposal. createPlan makes the wizard's starting values
// (view state); resolvePlan works out every change they lead to, faction
// by faction; buildAdvance turns them into ONE advanceDay command plus a
// "Day N ended" Day Log entry for each faction. Every value is a proposal:
// the wizard lets the Arbiter change or skip each step before Accept.
//
// Per faction (data/factions.js factionSettings):
//   trackNeeds:  the Meal and Needs steps run for it, eating only from its
//                own stockpiles; otherwise its Hunger and Thirst stay as is
//   usesStamina: its characters' Stamina resets to max
// Condition durations count down for everyone. The Day is shared.
//
// plan: {
//   step,                          the wizard step shown (advanceWizard.js)
//   skip: { meal, needs, conditions, stamina },
//   eaters: { characterId: false } who does NOT eat (default: everyone eats)
//   portions: { 'stockpileId|resourceTypeId': count }   food eaten
//   hungerEdits: { characterId: number }   the Arbiter's Hunger after
//   removeHungry: { characterId: false }   keep Hungry on someone who ate
//   thirst: { characterId: 'keep' | 'drank' | 'minus' }
//   conditionEdits: { 'characterId|index': { after, remove } }
//   staminaEdits: { characterId: number }
//   notes, logTexts: { factionId: edited text } (absent = generated)
// }
import template from './templates/dayEnded.txt?raw';
import { fillTemplate } from '../../rules/logTemplate.js';
import { NEEDS, foodNeeded, foodProvided, hungerAfter, conditionsAfterMeal, conditionCountdown, hungryCondition, proposeMeal } from '../../rules/needs.js';
import { setField } from '../../commands/recordCommands.js';
import { addDayLogEntries, newEntry } from '../../data/dayLog.js';
import { activeFactionIds, factionSettings, factionName } from '../../data/factions.js';
import { foodItems, setCounts } from '../resources/stockpileModel.js';
import { advanceDay } from './timeCommands.js';
import { livingCharacters } from './readiness.js';

export const itemKey = (stockpileId, typeId) => `${stockpileId}|${typeId}`;
const isNumber = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const fedOf = (plan, c) => plan.eaters[c.id] !== false;

// The factions taking part, each with its living characters and settings.
function factionGroups(world) {
  return activeFactionIds(world).map((factionId) => ({
    factionId,
    name: factionName(world, factionId),
    settings: factionSettings(world, factionId),
    living: livingCharacters(world).filter((c) => (c.factionId ?? '') === factionId),
  }));
}

// Proposes, for each faction that tracks needs, eating enough from its own
// stockpiles for its characters who eat.
export function proposePortions(world, plan) {
  plan.portions = {};
  for (const g of factionGroups(world)) {
    if (!g.settings.trackNeeds || !g.factionId) continue;
    const items = foodItems(world, g.factionId);
    const counts = proposeMeal(items, foodNeeded(g.living.filter((c) => fedOf(plan, c)).length));
    items.forEach((f, i) => (plan.portions[itemKey(f.stockpileId, f.resourceTypeId)] = counts[i]));
  }
}

export function createPlan(world) {
  const plan = {
    step: 0,
    skip: { meal: false, needs: false, conditions: false, stamina: false },
    eaters: {},
    portions: {},
    hungerEdits: {},
    removeHungry: {},
    thirst: {},
    conditionEdits: {},
    staminaEdits: {},
    notes: '',
    logTexts: {},
  };
  proposePortions(world, plan);
  return plan;
}

function hungerRow(c, fed, tracked, plan) {
  const before = c.hunger?.current ?? null;
  const set = isNumber(c.hunger?.max) || isNumber(before);
  if (!tracked || plan.skip.needs) return { before, after: before, proposed: before, atRisk: false, set, tracked };
  const proposed = hungerAfter(c.hunger, fed).current ?? null;
  const after = plan.hungerEdits[c.id] ?? proposed;
  return { before, after, proposed, atRisk: !fed && isNumber(after) && Number(after) <= 0, set, tracked };
}

function thirstRow(c, tracked, plan) {
  const before = c.thirst?.current ?? null;
  const max = c.thirst?.max ?? null;
  const mode = !tracked || plan.skip.needs ? 'keep' : plan.thirst[c.id] ?? 'keep';
  // RULE NEEDED: Thirst rules. For now the Arbiter says who drank.
  let after = before;
  if (mode === 'drank' && isNumber(max)) after = Number(max);
  if (mode === 'minus' && isNumber(before)) after = Math.max(0, Number(before) - 1);
  return { before, after, max, mode };
}

// Condition durations count down; then, if needs are tracked, the meal's Hungry change.
function conditionRows(world, c, fed, tracked, plan) {
  const countdown = conditionCountdown(c.conditions).map((row) => {
    const edit = plan.conditionEdits[`${c.id}|${row.index}`] ?? {};
    return { ...row, after: edit.after ?? row.after, remove: edit.remove ?? row.expires };
  });
  let after = c.conditions ?? [];
  if (!plan.skip.conditions) {
    after = after.flatMap((cond, index) => {
      const row = countdown.find((r) => r.index === index);
      if (!row) return [cond];
      return row.remove ? [] : [{ ...cond, durationDays: row.after }];
    });
  }
  const hungryBefore = hungryCondition(after);
  if (tracked && !plan.skip.needs) {
    const libraryHungry = Object.values(world.definitions.conditions ?? {}).find((d) => d.name?.toLowerCase() === NEEDS.hungryCondition.name.toLowerCase());
    after = conditionsAfterMeal(after, fed, { removeHungry: plan.removeHungry[c.id] !== false, conditionId: libraryHungry?.id ?? '', day: world.meta.currentDay });
  }
  return { countdown, after, hungryBefore, hungryAfter: hungryCondition(after) };
}

// Every change the plan leads to:
//   { groups: [{ factionId, name, settings, living, eaters, unfed, needed,
//                provided, meal: [food rows with eat], rows }],
//     rows: every character's row, lines: [summary lines with factionId] }
//   row: { c, factionId, fed, hunger, thirst, conditions, stamina }
export function resolvePlan(world, plan) {
  const groups = factionGroups(world).map((g) => {
    const tracked = g.settings.trackNeeds;
    const meal =
      tracked && g.factionId
        ? foodItems(world, g.factionId).map((f) => {
            const key = itemKey(f.stockpileId, f.resourceTypeId);
            const eat = plan.skip.meal ? 0 : Math.max(0, Math.min(f.count, Math.round(plan.portions[key] ?? 0)));
            return { ...f, key, eat };
          })
        : [];
    const eaters = tracked ? g.living.filter((c) => fedOf(plan, c)) : [];
    const rows = g.living.map((c) => {
      const fed = tracked ? fedOf(plan, c) : null;
      const before = c.staminaRemaining ?? null;
      const proposed = isNumber(c.staminaMax) ? Number(c.staminaMax) : before;
      const resets = g.settings.usesStamina && !plan.skip.stamina;
      return {
        c,
        factionId: g.factionId,
        fed,
        hunger: hungerRow(c, fed, tracked, plan),
        thirst: thirstRow(c, tracked, plan),
        conditions: conditionRows(world, c, fed, tracked, plan),
        stamina: { before, proposed, resets, after: resets ? plan.staminaEdits[c.id] ?? proposed : before },
      };
    });
    return {
      ...g,
      eaters,
      unfed: tracked ? g.living.filter((c) => !fedOf(plan, c)) : [],
      needed: foodNeeded(eaters.length),
      provided: foodProvided(meal.map((m) => ({ count: m.eat, foodValue: m.foodValue }))),
      meal,
      rows,
    };
  });
  const rows = groups.flatMap((g) => g.rows);
  return { groups, rows, lines: groups.flatMap((g) => summaryLines(g, plan)).concat(dayLine(world)) };
}

const daysText = (cond) => `${cond?.daysWithoutFood ?? 1} day${(cond?.daysWithoutFood ?? 1) === 1 ? '' : 's'} without food`;

// The Summary step's groups, in the wizard's order.
export const SUMMARY_GROUPS = ['Meal', 'Hunger', 'Thirst', 'Conditions', 'Stamina', 'Day'];

const dayLine = (world) => ({ factionId: null, group: 'Day', text: `Day ${world.meta.currentDay} -> Day ${world.meta.currentDay + 1} for the whole world (a snapshot of Day ${world.meta.currentDay} is saved first)`, warn: false });

// One faction's lines in the Summary step: [{ factionId, group, text, warn }].
function summaryLines(g, plan) {
  const lines = [];
  const add = (group, text, warn = false) => lines.push({ factionId: g.factionId, group, text, warn });
  if (g.settings.trackNeeds && !plan.skip.meal) {
    for (const m of g.meal.filter((x) => x.eat > 0)) add('Meal', `Eat ${m.eat} ${m.name} from the ${m.stockpileName} stockpile (${m.eat * m.foodValue} Food; ${m.count - m.eat} left)`);
    add('Meal', `${g.provided} Food eaten, ${g.needed} needed`, g.provided < g.needed);
  }
  for (const c of g.unfed) add('Meal', `${c.name} does not eat`, true);
  for (const { c, hunger, thirst, conditions, stamina } of g.rows) {
    if (hunger.after !== hunger.before) add('Hunger', `${c.name}: Hunger ${hunger.before ?? '-'} -> ${hunger.after ?? '-'}`);
    if (hunger.atRisk) add('Hunger', `${c.name} is at Hunger 0: at risk of death. You decide (nothing happens automatically).`, true);
    if (thirst.after !== thirst.before) add('Thirst', `${c.name}: Thirst ${thirst.before ?? '-'} -> ${thirst.after ?? '-'}`);
    if (!plan.skip.conditions) {
      for (const cd of conditions.countdown) add('Conditions', cd.remove ? `${c.name}: ${cd.name} removed (${cd.before} -> ${cd.after} days)` : `${c.name}: ${cd.name} ${cd.before} -> ${cd.after} days`);
    }
    if (conditions.hungryAfter && !conditions.hungryBefore) add('Conditions', `${c.name} gains Hungry: ${NEEDS.hungryCondition.modifier} (${daysText(conditions.hungryAfter)})`, true);
    else if (conditions.hungryAfter && conditions.hungryBefore && conditions.hungryAfter !== conditions.hungryBefore) add('Conditions', `${c.name}: still Hungry (${daysText(conditions.hungryAfter)})`, true);
    else if (!conditions.hungryAfter && conditions.hungryBefore) add('Conditions', `${c.name}: Hungry removed (ate)`);
    if (stamina.after !== stamina.before) add('Stamina', `${c.name}: Stamina ${stamina.before ?? '-'} -> ${stamina.after ?? '-'}`);
  }
  return lines;
}

// A faction's "Day N ended" Day Log text, from templates/dayEnded.txt.
export function dayEndedText(world, plan, resolved, g) {
  const day = world.meta.currentDay;
  const tracked = g.settings.trackNeeds;
  const unspent = g.settings.usesStamina ? g.rows.filter((r) => (r.stamina.before ?? 0) > 0) : [];
  const staminaCount = g.rows.filter((r) => r.stamina.after !== r.stamina.before).length;
  const lines = resolved.lines.filter((l) => l.factionId === g.factionId);
  const conditionLines = lines.filter((l) => l.group === 'Conditions').map((l) => l.text);
  const thirsty = g.rows.filter((r) => r.thirst.after !== r.thirst.before);
  return fillTemplate(template, {
    day,
    nextDay: day + 1,
    factionName: g.name,
    hasMeal: tracked && !plan.skip.meal,
    eaterCount: g.eaters.length,
    needed: g.needed,
    provided: g.provided,
    eaten: g.meal.filter((m) => m.eat > 0).map((m) => ({ count: m.eat, name: m.name, stockpile: m.stockpileName, food: m.eat * m.foodValue })),
    hasUnfed: g.unfed.length > 0,
    unfed: g.rows
      .filter((r) => r.fed === false)
      .map((r) => ({ name: r.c.name, before: r.hunger.before ?? '-', after: r.hunger.after ?? '-', daysText: daysText(r.conditions.hungryAfter), riskText: r.hunger.atRisk ? ' - at risk of death' : '' })),
    hasThirst: thirsty.length > 0,
    thirst: thirsty.map((r) => ({ name: r.c.name, before: r.thirst.before ?? '-', after: r.thirst.after ?? '-' })),
    hasConditions: conditionLines.length > 0,
    conditionLines,
    hasUnspent: unspent.length > 0,
    unspentText: unspent.map((r) => `${r.c.name} (${r.stamina.before})`).join(', '),
    staminaCount: staminaCount || null,
    notes: plan.notes.trim(),
  }).trim();
}

export const logTextFor = (world, plan, resolved, g) => plan.logTexts[g.factionId] ?? dayEndedText(world, plan, resolved, g);

// ONE advanceDay command with every accepted change.
export function buildAdvance(world, plan, resolved) {
  const day = world.meta.currentDay;
  const commands = [];

  // Food out of each faction's stockpiles, one command per stockpile.
  const byStockpile = {};
  for (const m of resolved.groups.flatMap((g) => g.meal).filter((x) => x.eat > 0)) (byStockpile[m.stockpileId] ??= []).push(m);
  for (const [stockpileId, eaten] of Object.entries(byStockpile)) {
    const counts = { ...world.stockpiles[stockpileId].counts };
    for (const m of eaten) counts[m.resourceTypeId] = Math.max(0, (counts[m.resourceTypeId] ?? 0) - m.eat);
    commands.push(setCounts(world, stockpileId, counts, `Day ${day} meal`));
  }

  for (const { c, hunger, thirst, conditions, stamina } of resolved.rows) {
    if (hunger.after !== hunger.before) commands.push(setField(world, 'characters', c.id, 'hunger', { ...c.hunger, current: hunger.after }, c.name));
    if (thirst.after !== thirst.before) commands.push(setField(world, 'characters', c.id, 'thirst', { ...c.thirst, current: thirst.after }, c.name));
    if (JSON.stringify(conditions.after) !== JSON.stringify(c.conditions ?? [])) commands.push(setField(world, 'characters', c.id, 'conditions', conditions.after, c.name));
    if (stamina.after !== stamina.before) commands.push(setField(world, 'characters', c.id, 'staminaRemaining', stamina.after, c.name));
  }

  // "Day N ended" in each faction's Day Log, in one command.
  const entries = resolved.groups.map((g) => newEntry('dayEnd', logTextFor(world, plan, resolved, g), { method: 'advanceDay', factionId: g.factionId }));
  commands.push(addDayLogEntries(world, day, entries));
  return advanceDay(world, commands);
}
