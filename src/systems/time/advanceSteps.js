// The Advance Day wizard's middle steps: Meal, Needs, Conditions, Stamina,
// each grouped by faction. Each only edits the plan (view state, see
// advancePlan.js); nothing reaches the world until the Summary's Accept.
import { h } from '../../ui/dom.js';
import { NEEDS } from '../../rules/needs.js';
import { proposePortions } from './advancePlan.js';

const numberInput = (value, onValue, key, title = '') => {
  const input = h('input', { type: 'number', class: 'tiny-input', step: 1, value: value ?? '', title, 'data-key': key });
  input.addEventListener('change', () => input.value !== '' && onValue(Math.round(Number(input.value))));
  return input;
};

const factionHeading = (g) => h('h3', { class: 'faction-heading' }, g.name);

// Factions the step doesn't apply to, in one line.
function skippedNote(groups, why) {
  return groups.length ? h('p', { class: 'muted small' }, `${why}: ${groups.map((g) => g.name).join(', ')}.`) : null;
}

function mealFor(world, plan, g, refresh) {
  const foodRows = g.meal.map((m) =>
    h(
      'div',
      { class: 'wizard-row' },
      h('span', { class: 'wizard-name' }, m.name),
      h('span', { class: 'muted small' }, `${m.stockpileName} stockpile: ${m.count} (${m.foodValue} Food each)`),
      h('span', { class: 'small' }, 'Eat'),
      numberInput(m.eat, (n) => ((plan.portions[m.key] = Math.max(0, Math.min(m.count, n))), refresh()), `wiz.eat.${m.key}`),
      h('span', { class: 'small muted' }, `= ${m.eat * m.foodValue} Food`),
    ),
  );
  const eaterRows = g.living.map((c) =>
    h('label', { class: 'check-label wizard-check' }, h('input', { type: 'checkbox', checked: plan.eaters[c.id] !== false, onchange: (e) => ((plan.eaters[c.id] = e.target.checked), refresh()) }), ` ${c.name}`),
  );
  const short = g.provided < g.needed;
  return [
    factionHeading(g),
    h('p', {}, `${g.eaters.length} of ${g.living.length} living character(s) eat: they need ${g.needed} Food (${NEEDS.foodPerCharacterPerDay} each per day).`),
    h('p', { class: short ? 'flag-text' : 'ok-text' }, `Food chosen: ${g.provided} of ${g.needed}.${short ? ' Not enough: untick who goes without, or add food in the Resources tab.' : ''}`),
    foodRows.length ? foodRows : h('p', { class: 'muted small' }, `No food in ${g.name}'s stockpiles. Add resources tagged "${NEEDS.foodTag}" in the Resources tab.`),
    h('div', { class: 'wizard-checks' }, h('span', { class: 'small muted' }, 'Who eats:'), eaterRows),
    g.unfed.length ? h('p', { class: 'flag-text' }, `Unfed: ${g.unfed.map((c) => c.name).join(', ')}`) : null,
  ];
}

export function mealStep(world, plan, resolved, refresh) {
  const tracked = resolved.groups.filter((g) => g.settings.trackNeeds);
  return [
    h('p', { class: 'small' }, "Each faction that tracks needs eats from its own stockpiles."),
    h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => (proposePortions(world, plan), refresh()) }, 'Propose again'), h('button', { class: 'btn small', onclick: () => ((plan.portions = {}), refresh()) }, 'Eat nothing')),
    tracked.length ? tracked.map((g) => mealFor(world, plan, g, refresh)) : h('p', { class: 'muted' }, 'No faction tracks needs.'),
    skippedNote(resolved.groups.filter((g) => !g.settings.trackNeeds), 'Needs not tracked (no meal)'),
  ];
}

const THIRST_MODES = [
  { mode: 'keep', label: 'No change' },
  { mode: 'drank', label: 'Drank (max)' },
  { mode: 'minus', label: '-1' },
];

function needsRow(plan, { c, fed, hunger, thirst, conditions }, refresh) {
  return h(
    'div',
    { class: hunger.atRisk ? 'wizard-row warn' : 'wizard-row' },
    h('span', { class: 'wizard-name wide-name' }, c.name, h('span', { class: fed ? 'ok-text small' : 'flag-text small' }, fed ? ' ate' : ' did not eat')),
    h(
      'span',
      { class: 'wizard-cell' },
      hunger.set
        ? [
            h('span', { class: 'small' }, `Hunger ${hunger.before ?? '-'}/${c.hunger?.max ?? '-'} ->`),
            numberInput(hunger.after, (n) => ((plan.hungerEdits[c.id] = Math.max(0, n)), refresh()), `wiz.hunger.${c.id}`, `Proposed: ${hunger.proposed ?? '-'}`),
          ]
        : h('span', { class: 'muted small' }, 'Hunger not set'),
    ),
    hunger.atRisk ? h('span', { class: 'flag-text small' }, 'At risk of death: you decide') : null,
    fed && conditions.hungryBefore
      ? h('label', { class: 'check-label small' }, h('input', { type: 'checkbox', checked: plan.removeHungry[c.id] !== false, onchange: (e) => ((plan.removeHungry[c.id] = e.target.checked), refresh()) }), ' Remove Hungry')
      : null,
    h(
      'span',
      { class: 'row inline' },
      h('span', { class: 'small' }, `Thirst ${thirst.before ?? '-'}/${thirst.max ?? '-'}`),
      THIRST_MODES.map((t) => h('button', { class: thirst.mode === t.mode ? 'btn tiny active' : 'btn tiny', onclick: () => ((plan.thirst[c.id] = t.mode), refresh()) }, t.label)),
      thirst.after !== thirst.before ? h('span', { class: 'small' }, `-> ${thirst.after}`) : null,
    ),
  );
}

export function needsStep(world, plan, resolved, refresh) {
  const tracked = resolved.groups.filter((g) => g.settings.trackNeeds);
  return [
    h('p', { class: 'small' }, `Ate: Hunger returns to max. Did not eat: Hunger -${NEEDS.unfedHungerLoss} and the Hungry condition ("${NEEDS.hungryCondition.modifier}"). Hunger 0 is only flagged: nobody dies automatically.`),
    h('p', { class: 'muted small' }, 'Thirst has no rule yet (RULE NEEDED): pick what happened for each character.'),
    h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => (tracked.forEach((g) => g.rows.forEach((r) => (plan.thirst[r.c.id] = 'drank'))), refresh()) }, 'Everyone drank')),
    tracked.map((g) => [factionHeading(g), g.rows.map((r) => needsRow(plan, r, refresh))]),
    skippedNote(resolved.groups.filter((g) => !g.settings.trackNeeds), 'Needs not tracked (Hunger and Thirst stay as they are)'),
  ];
}

export function conditionsStep(world, plan, resolved, refresh) {
  const rows = resolved.rows.flatMap(({ c, conditions }) =>
    conditions.countdown.map((cd) => {
      const key = `${c.id}|${cd.index}`;
      const edit = (changes) => ((plan.conditionEdits[key] = { after: cd.after, remove: cd.remove, ...changes }), refresh());
      return h(
        'div',
        { class: cd.remove ? 'wizard-row warn' : 'wizard-row' },
        h('span', { class: 'wizard-name' }, c.name),
        h('span', {}, cd.name),
        h('span', { class: 'small' }, `${cd.before} ->`),
        numberInput(cd.after, (n) => edit({ after: n }), `wiz.cond.${key}`),
        h('span', { class: 'small' }, 'days'),
        h('label', { class: 'check-label small' }, h('input', { type: 'checkbox', checked: cd.remove, onchange: (e) => edit({ remove: e.target.checked }) }), ' Remove'),
      );
    }),
  );
  return [
    h('p', { class: 'small' }, 'Conditions with a duration count down by 1 day, in every faction. Those reaching 0 are proposed for removal.'),
    rows.length ? rows : h('p', { class: 'muted' }, 'No condition has a duration.'),
  ];
}

export function staminaStep(world, plan, resolved, refresh) {
  const using = resolved.groups.filter((g) => g.settings.usesStamina);
  return [
    h('p', { class: 'small' }, "Stamina remaining goes back to Stamina max for every faction that uses Stamina."),
    using.map((g) => [
      factionHeading(g),
      g.rows.map(({ c, stamina }) =>
        h(
          'div',
          { class: 'wizard-row' },
          h('span', { class: 'wizard-name' }, c.name),
          h('span', { class: 'small' }, `${stamina.before ?? '-'}/${c.staminaMax ?? '-'} ->`),
          numberInput(stamina.after, (n) => ((plan.staminaEdits[c.id] = Math.max(0, n)), refresh()), `wiz.stamina.${c.id}`, `Proposed: ${stamina.proposed ?? '-'}`),
          c.staminaMax === null || c.staminaMax === undefined ? h('span', { class: 'muted small' }, 'No Stamina max set') : null,
        ),
      ),
    ]),
    skippedNote(resolved.groups.filter((g) => !g.settings.usesStamina), 'Does not use Stamina'),
  ];
}
