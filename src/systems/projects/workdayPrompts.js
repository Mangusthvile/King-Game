// The questions the workday log asks as it plays (an Oregon Trail style
// prompt under the log): roll the Work Dice? Y/N (N = type in physical
// dice), roll the Event? Y/N, then type the effect, the Workload change,
// any Conditions and notes, and finally "Accept this workday? Y/N".
// Answers change the draft only; Accept is the one commit.
import { h } from '../../ui/dom.js';
import { EVENT_DIE } from '../../rules/projects.js';
import { rollAll, rollEvent, typeRoll, typeEventRoll } from './workdayDraft.js';
import { parseNumber } from './workdayParticipants.js';

// The first stop not answered yet, or null when every question is done.
export function currentStop(script, draft) {
  return script.stops.find((s) => !draft.answered[s.name]) ?? null;
}

// "> Question (Y/N)" with a box that answers as soon as Y or N is typed,
// plus buttons. (Reacting to the typed text, not the key, also works with
// on-screen keyboards and pasted text.)
function ynPrompt(question, onYes, onNo) {
  const input = h('input', {
    type: 'text',
    class: 'prompt-input',
    maxLength: 3,
    'data-autofocus': true,
    oninput: (e) => {
      const answer = e.target.value.trim().toLowerCase();
      if (answer.startsWith('y')) onYes();
      else if (answer.startsWith('n')) onNo();
      else e.target.value = '';
    },
  });
  return h(
    'div',
    { class: 'log-prompt' },
    h('span', { class: 'prompt-text' }, `> ${question} (Y/N)`),
    h('div', { class: 'row' }, input, h('button', { class: 'btn tiny', onclick: onYes }, 'Y'), h('button', { class: 'btn tiny', onclick: onNo }, 'N')),
  );
}

// "> Question" with a text box; Enter (or Submit) answers. extras: nodes
// under the box (quick picks).
function typedPrompt(question, initial, onSubmit, { placeholder = 'Enter for none', extras = null, number = false } = {}) {
  const input = h('input', { type: 'text', class: 'prompt-input wide', value: initial ?? '', placeholder, 'data-autofocus': true });
  const message = h('span', { class: 'flag-text small' });
  const submit = () => {
    const value = input.value.trim();
    if (number && value !== '' && !Number.isInteger(Number(value))) return (message.textContent = 'Type a whole number, like +5 or -10.');
    onSubmit(value, input);
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), submit()));
  return h(
    'div',
    { class: 'log-prompt' },
    h('span', { class: 'prompt-text' }, `> ${question}`),
    h('div', { class: 'row' }, input, h('button', { class: 'btn tiny', onclick: submit }, 'Submit')),
    extras ? extras(input) : null,
    message,
  );
}

// N to "Roll the Work Dice?": a box per die for the physical results.
function manualDice(world, draft, resolved, done, refresh) {
  const message = h('span', { class: 'flag-text small' });
  const rows = resolved.working.map((r) =>
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'setup-name' }, `${r.name} ${r.p.stamina}d${r.die}`),
      r.p.rolls.map((roll, i) =>
        h('input', {
          type: 'number',
          class: 'die-input',
          min: 1,
          max: r.die,
          value: roll ?? '',
          placeholder: `d${r.die}`,
          'data-key': `prompt.${r.p.characterId}.${i}`,
          'data-autofocus': i === 0 && r === resolved.working[0] ? true : null,
          onchange: (e) => {
            if (!typeRoll(world, r.p, i, parseNumber(e.target.value))) {
              message.textContent = `A d${r.die} result is a whole number from 1 to ${r.die}.`;
              e.target.value = roll ?? '';
            }
          },
        }),
      ),
    ),
  );
  const submit = () => {
    const missing = draft.participants.some((p) => p.stamina > 0 && p.rolls.some((x) => x === null));
    if (missing) return (message.textContent = 'Fill in every die first.');
    done();
  };
  return h('div', { class: 'log-prompt' }, h('span', { class: 'prompt-text' }, '> Type in the dice you rolled:'), rows, h('div', { class: 'row' }, h('button', { class: 'btn tiny', onclick: submit }, 'Submit rolls'), h('button', { class: 'btn tiny', onclick: () => ((draft.sub = null), refresh()) }, 'Back')), message);
}

// Y to "Add a Condition?": who, which Condition, its modifier and length.
function conditionForm(world, draft, done, refresh) {
  const people = draft.participants.filter((p) => p.stamina > 0).map((p) => world.characters[p.characterId]).filter(Boolean);
  const library = Object.values(world.definitions.conditions ?? {});
  const who = h('select', { 'data-autofocus': true }, people.map((c) => h('option', { value: c.id }, c.name)));
  const from = h('select', {}, h('option', { value: '' }, '(one-off)'), library.map((c) => h('option', { value: c.id }, c.name)));
  const name = h('input', { type: 'text', placeholder: 'Condition name' });
  const modifier = h('input', { type: 'text', placeholder: 'e.g. -3 to all tasks' });
  const days = h('input', { type: 'number', step: 1, min: 0, class: 'tiny-input', placeholder: 'days' });
  const message = h('span', { class: 'flag-text small' });
  const submit = () => {
    const def = world.definitions.conditions?.[from.value];
    const label = name.value.trim() || def?.name || '';
    if (!label) return (message.textContent = 'Give the Condition a name or pick one.');
    draft.conditionsToAdd.push({ characterId: who.value, conditionId: def?.id ?? '', name: label, modifier: modifier.value.trim(), durationDays: parseNumber(days.value) });
    done();
  };
  return h(
    'div',
    { class: 'log-prompt' },
    h('span', { class: 'prompt-text' }, '> Which Condition, on whom?'),
    h('div', { class: 'row' }, who, from, name),
    h('div', { class: 'row' }, modifier, days, h('button', { class: 'btn tiny', onclick: submit }, 'Submit'), h('button', { class: 'btn tiny', onclick: () => ((draft.sub = null), refresh()) }, 'Back')),
    message,
  );
}

// The prompt for a stop. answer() marks the stop answered and continues.
export function renderPrompt(world, draft, resolved, stop, refresh) {
  const answer = () => {
    draft.answered[stop.name] = true;
    draft.sub = null;
    refresh();
  };
  const sub = (name) => () => ((draft.sub = name), refresh());

  switch (stop.name) {
    case 'rollDice':
      if (draft.sub === 'manualDice') return manualDice(world, draft, resolved, answer, refresh);
      return ynPrompt('Roll the Work Dice?', () => (rollAll(world, draft), answer()), sub('manualDice'));
    case 'rollEvent':
      if (draft.sub === 'manualEvent') {
        return typedPrompt(`Type the Project Event roll (1 to ${EVENT_DIE}):`, draft.eventRoll ?? '', (value) => (typeEventRoll(draft, parseNumber(value)) && value !== '' ? answer() : alert(`A whole number from 1 to ${EVENT_DIE}.`)), { placeholder: `d${EVENT_DIE}` });
      }
      return ynPrompt(`Roll the Project Event (d${EVENT_DIE})?`, () => (rollEvent(draft), answer()), sub('manualEvent'));
    case 'effect': {
      const picks = resolved.event?.effectOptions ?? [];
      return typedPrompt('What is the effect of the Event?', draft.effect, (value) => ((draft.effect = value), answer()), {
        extras: picks.length
          ? (input) => h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'Pick:'), picks.map((o) => h('button', { class: 'btn tiny', onclick: () => ((input.value = input.value.trim() ? `${input.value.trim()}; ${o}` : o), input.focus()) }, o)))
          : null,
      });
    }
    case 'workloadChange':
      return typedPrompt('Workload change from the Event? (+5, -10...)', draft.workloadChange || '', (value) => ((draft.workloadChange = value === '' ? 0 : Number(value)), answer()), { number: true });
    case 'conditions':
      if (draft.sub === 'conditionForm') return conditionForm(world, draft, () => ((draft.sub = null), refresh()), refresh);
      return ynPrompt(draft.conditionsToAdd.length ? 'Add another Condition?' : 'Add a Condition to a participant?', sub('conditionForm'), answer);
    case 'notes':
      return typedPrompt('Any notes for this workday?', draft.notes, (value) => ((draft.notes = value), answer()));
    default:
      // A stop the app doesn't know (typo in an edited template): just continue.
      return ynPrompt(`Continue? (unknown stop "${stop.name}")`, answer, answer);
  }
}

// The last question, once the whole log has played.
export function renderAcceptPrompt(draft, blocker, onAccept, refresh) {
  if (blocker) return h('div', { class: 'log-prompt' }, h('span', { class: 'flag-text' }, `> ${blocker}`), h('span', { class: 'muted small' }, 'Fix it under Edit details.'));
  if (draft.declined) {
    return h('div', { class: 'log-prompt' }, h('span', { class: 'prompt-text' }, '> Not accepted. Change anything under Edit details, then Accept, or cancel the workday.'));
  }
  return ynPrompt('Accept this workday?', onAccept, () => ((draft.declined = true), refresh()));
}

