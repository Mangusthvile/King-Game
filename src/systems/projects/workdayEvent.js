// The end-of-workday Project Event (RULES.md): a d20 (rolled or typed in),
// the event's description, and the effect the Arbiter writes or picks.
// Common effects can be applied directly on Accept: a Workload change, a
// Condition on a participant, a note.
// RULE NEEDED: the specific Boon and Setback options (Open Rules). The quick
// picks are only the examples RULES.md lists in each description.
import { h } from '../../ui/dom.js';
import { PROJECT_EVENTS, EVENT_DIE } from '../../rules/projects.js';
import { rollEvent, typeEventRoll } from './workdayDraft.js';
import { parseNumber } from './workdayParticipants.js';

function conditionAdder(world, draft, refresh) {
  const people = draft.participants.map((p) => world.characters[p.characterId]).filter(Boolean);
  if (!people.length) return null;
  const library = Object.values(world.definitions.conditions ?? {});
  const who = h('select', { 'data-key': 'workday.cond.who' }, people.map((c) => h('option', { value: c.id }, c.name)));
  const from = h('select', { 'data-key': 'workday.cond.lib' }, h('option', { value: '' }, '(one-off, type a name)'), library.map((c) => h('option', { value: c.id }, c.name)));
  const name = h('input', { type: 'text', placeholder: 'Condition name', 'data-key': 'workday.cond.name' });
  const modifier = h('input', { type: 'text', placeholder: 'Modifier, e.g. -3 to all tasks', 'data-key': 'workday.cond.mod' });
  const days = h('input', { type: 'number', step: 1, min: 0, placeholder: 'days', class: 'short-input', 'data-key': 'workday.cond.days' });
  const add = () => {
    const def = world.definitions.conditions?.[from.value];
    const label = name.value.trim() || def?.name || '';
    if (!label) return alert('Give the Condition a name or pick one from the library.');
    draft.conditionsToAdd.push({ characterId: who.value, conditionId: def?.id ?? '', name: label, modifier: modifier.value.trim(), durationDays: parseNumber(days.value) });
    refresh();
  };
  return [
    h('label', {}, 'Add a Condition to a participant'),
    h('div', { class: 'row' }, who, from, name, modifier, days, h('button', { class: 'btn small', onclick: add }, 'Add')),
    draft.conditionsToAdd.length
      ? h(
          'div',
          { class: 'chip-list' },
          draft.conditionsToAdd.map((c, i) =>
            h(
              'span',
              { class: 'chip' },
              `${world.characters[c.characterId]?.name ?? '?'}: ${[c.name, c.modifier, c.durationDays ? `${c.durationDays} day(s)` : ''].filter(Boolean).join(', ')}`,
              h('button', { class: 'chip-x', onclick: () => (draft.conditionsToAdd.splice(i, 1), refresh()) }, 'x'),
            ),
          ),
        )
      : null,
  ];
}

export function renderEvent(world, draft, resolved, refresh) {
  const event = resolved.event;
  const rollBox = h('input', {
    type: 'number',
    step: 1,
    min: 1,
    max: EVENT_DIE,
    class: 'die-input',
    placeholder: `d${EVENT_DIE}`,
    value: draft.eventRoll ?? '',
    'data-key': 'workday.event.roll',
    onchange: (e) => (typeEventRoll(draft, parseNumber(e.target.value)) ? refresh() : alert(`The Event roll is a whole number from 1 to ${EVENT_DIE}.`)),
  });
  const pick = h(
    'select',
    { 'data-key': 'workday.event.override', title: 'Set the event by hand', onchange: (e) => ((draft.eventOverrideId = e.target.value), refresh()) },
    h('option', { value: '' }, 'Event from the roll'),
    PROJECT_EVENTS.map((ev) => h('option', { value: ev.id }, `Set by hand: ${ev.name} (${ev.min === ev.max ? ev.min : `${ev.min}-${ev.max}`})`)),
  );
  pick.value = draft.eventOverrideId;

  const effect = h('input', { type: 'text', class: 'wide', value: draft.effect, placeholder: 'What happened (written by the Arbiter)', 'data-key': 'workday.effect', onchange: (e) => ((draft.effect = e.target.value), refresh()) });
  const appendEffect = (text) => {
    draft.effect = draft.effect.trim() ? `${draft.effect.trim()}; ${text}` : text;
    refresh();
  };
  const notes = h('textarea', { rows: 2, value: draft.notes, placeholder: 'Arbiter notes for this workday', 'data-key': 'workday.notes', onchange: (e) => ((draft.notes = e.target.value), refresh()) });

  return [
    h('h3', {}, 'End of Workday: Project Event'),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => (rollEvent(draft), refresh()) }, `Roll Event (d${EVENT_DIE})`),
      rollBox,
      draft.eventEdited ? h('span', { class: 'muted small' }, '(edited)') : null,
      pick,
    ),
    event
      ? h('div', { class: `event-box event-${event.id}` }, h('strong', {}, event.name), h('p', { class: 'small' }, event.description))
      : h('p', { class: 'muted small' }, 'Roll the Event or type in a d20 result.'),
    h('label', {}, 'Effect'),
    effect,
    event?.effectOptions.length ? h('div', { class: 'row' }, h('span', { class: 'muted small' }, 'Pick:'), event.effectOptions.map((o) => h('button', { class: 'btn tiny', onclick: () => appendEffect(o) }, o))) : null,
    h('label', { title: 'Added to the Current Workload on Accept (negative for Progress loss)' }, 'Workload change from the Event'),
    h('input', {
      type: 'number',
      step: 1,
      class: 'short-input',
      value: draft.workloadChange || '',
      placeholder: '0',
      'data-key': 'workday.change',
      onchange: (e) => {
        const n = parseNumber(e.target.value);
        if (n === null || Number.isInteger(n)) draft.workloadChange = n ?? 0;
        refresh();
      },
    }),
    conditionAdder(world, draft, refresh),
    h('label', {}, 'Notes'),
    notes,
  ];
}
