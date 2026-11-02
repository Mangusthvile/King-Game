// The questions the workday log asks as it plays (an Oregon Trail style
// prompt under the log): roll the Work Dice? Y/N (N = type in physical
// dice), roll the Event? Y/N (N = type the d20 result), then type the
// effect, the Workload change, any Conditions and notes, and finally
// "Accept this workday? Y/N". Yes/no questions are two buttons; questions
// that need a short answer are one text box (with suggestions where
// RULES.md gives some). Each has an info tip (hover the "i") saying what it
// wants. Answers change the draft only; Accept is the one commit.
import { h } from '../../ui/dom.js';
import { infoTip } from '../../ui/taskCard.js';
import { EVENT_DIE, PROJECT_EVENTS } from '../../rules/projects.js';
import { rollAll, rollEvent, typeRoll, typeEventRoll } from './workdayDraft.js';
import { parseNumber } from './workdayParticipants.js';

// The first stop not answered yet, or null when every question is done.
export function currentStop(script, draft) {
  return script.stops.find((s) => !draft.answered[s.name]) ?? null;
}

// "> Question (Y/N)" answered with two buttons, labelled with what each
// does (yes / no: the button texts). The Y and N keys press them too, since
// the first button gets the focus. info: the hover text of the "i".
function ynPrompt(question, onYes, onNo, { info, yes = 'Yes', no = 'No' } = {}) {
  return h(
    'div',
    {
      class: 'log-prompt',
      onkeydown: (e) => {
        const key = e.key.toLowerCase();
        if (key === 'y') (e.preventDefault(), onYes());
        else if (key === 'n') (e.preventDefault(), onNo());
      },
    },
    h('span', { class: 'prompt-text' }, `> ${question}`, infoTip(info)),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn small primary', 'data-autofocus': true, onclick: onYes }, `[Y] ${yes}`),
      h('button', { class: 'btn small', onclick: onNo }, `[N] ${no}`),
    ),
  );
}

// "> Question" with one text box; Enter answers. suggestions: clickable
// texts that fill the box (they add to what is already typed).
function typedPrompt(question, initial, onSubmit, { placeholder = 'type, then Enter (Enter alone = none)', info, suggestions = [], number = false } = {}) {
  const input = h('input', { type: 'text', class: 'prompt-input wide', value: initial ?? '', placeholder, 'data-autofocus': true });
  const message = h('span', { class: 'flag-text small' });
  const submit = () => {
    const value = input.value.trim();
    if (number && value !== '' && !Number.isInteger(Number(value))) return (message.textContent = 'Type a whole number, like +5 or -10.');
    onSubmit(value, input);
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), submit()));
  const fill = (text) => {
    input.value = number || !input.value.trim() ? text : `${input.value.trim()}; ${text}`;
    input.focus();
  };
  return h(
    'div',
    { class: 'log-prompt' },
    h('span', { class: 'prompt-text' }, `> ${question}`, infoTip(info)),
    h('div', { class: 'row' }, input),
    suggestions.length ? h('div', { class: 'row suggestions' }, h('span', { class: 'muted small' }, 'Suggestions:'), suggestions.map((s) => h('button', { class: 'chip chip-button', title: 'Put this in the box', onclick: () => fill(s) }, s))) : null,
    message,
  );
}

// The d20 ladder, for the Event prompts' info tips.
const EVENT_LADDER = PROJECT_EVENTS.map((e) => `${e.min === e.max ? e.min : `${e.min}-${e.max}`} ${e.name}`).join(', ');

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
      return ynPrompt('Roll the Work Dice?', () => (rollAll(world, draft), answer()), sub('manualDice'), {
        info: 'Y: the app rolls every Work Die for you. N: you roll real dice and type each result in.',
        yes: 'Roll them',
        no: 'I rolled my own',
      });
    case 'rollEvent': {
      const enter = (n) => typeEventRoll(draft, n) && (answer(), true);
      if (draft.sub === 'manualEvent') {
        return typedPrompt(`Type the Project Event roll (1 to ${EVENT_DIE}):`, draft.eventRoll ?? '', (value) => (value !== '' && enter(parseNumber(value)) ? null : alert(`A whole number from 1 to ${EVENT_DIE}.`)), {
          placeholder: `d${EVENT_DIE}, then Enter`,
          info: `The d20 you rolled. ${EVENT_LADDER}.`,
        });
      }
      return ynPrompt(`Roll the Project Event (d${EVENT_DIE})?`, () => (rollEvent(draft), answer()), sub('manualEvent'), {
        info: `Y: the app rolls the d20. N: you type the result of your own d20. ${EVENT_LADDER}.`,
        yes: 'Roll it',
        no: 'I rolled my own',
      });
    }
    case 'effect': {
      const event = resolved.event;
      return typedPrompt('What is the effect of the Event?', draft.effect, (value) => ((draft.effect = value), answer()), {
        info: event ? `${event.name}: ${event.description} Write what happened in your own words, or click a suggestion. Enter alone = no effect.` : 'Write what happened. Enter alone = no effect.',
        suggestions: event?.effectOptions ?? [],
      });
    }
    case 'workloadChange':
      return typedPrompt('Workload change from the Event?', draft.workloadChange || '', (value) => ((draft.workloadChange = value === '' ? 0 : Number(value)), answer()), {
        number: true,
        placeholder: '+5 or -10, then Enter (Enter alone = 0)',
        info: `Work added to (+) or taken from (-) the Project because of the Event, on top of today's dice. ${resolved.event ? `${resolved.event.name}: ${resolved.event.description}` : ''}`,
      });
    case 'conditions':
      if (draft.sub === 'conditionForm') return conditionForm(world, draft, () => ((draft.sub = null), refresh()), refresh);
      return ynPrompt(draft.conditionsToAdd.length ? 'Add another Condition?' : 'Add a Condition to a participant?', sub('conditionForm'), answer, {
        info: 'Y: give a participant a Condition from the Event (an injury, exhaustion...), with its modifier and how many days it lasts. N: nobody gets one.',
        yes: 'Add one',
        no: draft.conditionsToAdd.length ? 'Done' : 'None',
      });
    case 'notes':
      return typedPrompt('Any notes for this workday?', draft.notes, (value) => ((draft.notes = value), answer()), {
        info: 'Anything else worth remembering about today\'s work. It goes in the log and the Project history. Enter alone = no notes.',
      });
    default:
      // A stop the app doesn't know (typo in an edited template): just continue.
      return ynPrompt(`Continue? (unknown stop "${stop.name}")`, answer, answer, { info: 'This question is not known to the app. Either button continues.', yes: 'Continue', no: 'Skip' });
  }
}

// The last question, once the whole log has played.
export function renderAcceptPrompt(draft, blocker, onAccept, refresh) {
  if (blocker) return h('div', { class: 'log-prompt' }, h('span', { class: 'flag-text' }, `> ${blocker}`), h('span', { class: 'muted small' }, 'Fix it under Edit details.'));
  if (draft.declined) {
    return h('div', { class: 'log-prompt' }, h('span', { class: 'prompt-text' }, '> Not accepted. Change anything under Edit details, then Accept, or cancel the workday.'));
  }
  return ynPrompt('Accept this workday?', onAccept, () => ((draft.declined = true), refresh()), {
    info: 'Y: save the workday (Workload, Stamina spent, history, Day Log). Ctrl+Z undoes it. N: open Edit details to change something first.',
    yes: 'Accept',
    no: 'Not yet',
  });
}

