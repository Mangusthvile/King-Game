// Stamina on the stat sheet: remaining today / max, and how the max comes
// from the formula (RULES.md, Followers > Stamina):
//   Stamina = Species Base Stamina + FLOOR((SPD - 1) / 2)
// Stamina max is a stored field. It follows the formula unless the Arbiter
// overrode it (staminaMaxOverride). When SPD changes, the new formula value
// is PROPOSED (a "Use" button), never applied by itself.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, batch } from '../../commands/recordCommands.js';
import { staminaFor } from './characterModel.js';

// Typing a Stamina max: a value other than the formula's is an override;
// typing the formula's value (or clearing the box) follows the formula again.
function setStaminaMax(world, c, value, formula) {
  const override = value !== null && formula !== null && value !== formula;
  return batch(`Set Stamina max of ${c.name} to ${value ?? 'not set'}`, [
    value !== c.staminaMax ? setField(world, 'characters', c.id, 'staminaMax', value, c.name) : null,
    override !== !!c.staminaMaxOverride ? setField(world, 'characters', c.id, 'staminaMaxOverride', override, c.name) : null,
  ]);
}

// Back to the formula: clears the override and sets the formula's value.
function returnToFormula(world, c, formula) {
  return batch(`${c.name}: Stamina max back to the formula (${formula})`, [
    setField(world, 'characters', c.id, 'staminaMaxOverride', false, c.name),
    formula !== c.staminaMax ? setField(world, 'characters', c.id, 'staminaMax', formula, c.name) : null,
  ]);
}

// "Stamina [remaining] / [max]" (empty = not set). Not the SPD stat.
export function staminaInput(world, c) {
  const formula = staminaFor(world, c).breakdown?.total ?? null;
  const box = (field, onValue) =>
    h('input', {
      type: 'number',
      step: 'any',
      value: c[field] ?? '',
      placeholder: 'not set',
      'data-key': `${c.id}.${field}`,
      onchange: (e) => {
        const n = Number(e.target.value);
        if (e.target.value === '') onValue(null);
        else if (Number.isFinite(n)) onValue(n);
      },
    });
  return h(
    'div',
    { class: 'stat-pair', title: 'Stamina remaining today / Stamina max (the daily activity budget)' },
    h('span', { class: 'stat-label' }, 'Stamina'),
    box('staminaRemaining', (n) => dispatch(setField(world, 'characters', c.id, 'staminaRemaining', n, c.name))),
    h('span', { class: 'muted' }, '/'),
    box('staminaMax', (n) => dispatch(setStaminaMax(world, c, n, formula))),
  );
}

// Under the Stamina box: the formula's breakdown, and either the override
// marker with "Return to formula", a proposal to use the formula's value,
// or a warning that the species has no Base Stamina (manual).
export function staminaNote(world, c) {
  const { species, breakdown, missingBase } = staminaFor(world, c);
  if (missingBase) {
    return h(
      'p',
      { class: 'message warning small' },
      species ? `${species.name} has no Base Stamina set, so Stamina max is manual. Set it in Characters > Libraries > Species.` : 'No species set, so Stamina max is manual.',
    );
  }
  if (!breakdown) return h('p', { class: 'muted small' }, 'Set SPD to work out Stamina max from the formula.');
  const formula = breakdown.total;
  const title = 'Stamina = Base Stamina + FLOOR((SPD - 1) / 2). Conditions, Traits and other effects can change it: override it here.';
  if (c.staminaMaxOverride) {
    return h(
      'p',
      { class: 'small', title },
      h('span', { class: 'label-tag stage-tag' }, 'override'),
      h('span', { class: 'muted' }, ` Formula: ${breakdown.text}. `),
      h('button', { class: 'btn small', onclick: () => dispatch(returnToFormula(world, c, formula)) }, 'Return to formula'),
    );
  }
  return h(
    'p',
    { class: 'muted small', title },
    `Formula: ${breakdown.text}. `,
    formula !== c.staminaMax ? h('button', { class: 'btn small', title: 'SPD or the species changed: accept the formula value', onclick: () => dispatch(setField(world, 'characters', c.id, 'staminaMax', formula, c.name)) }, `Use ${formula}`) : null,
  );
}
