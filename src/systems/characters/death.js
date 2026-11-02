// Death and revival. Marking a character dead is one undo step: it records
// the cause and day, clears their assignment and takes them off every Area
// they were assigned to work in. They stay in the world, in the Death Log.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, batch } from '../../commands/recordCommands.js';

export function markDead(world, character, cause, day) {
  const areas = Object.values(world.containers).filter((c) => c.assignedFollowerIds?.includes(character.id));
  return batch(`${character.name} died (${cause || 'unknown cause'}, Day ${day})`, [
    setField(world, 'characters', character.id, 'alive', false, character.name),
    setField(world, 'characters', character.id, 'death', { cause, day }, character.name),
    character.currentAssignment ? setField(world, 'characters', character.id, 'currentAssignment', '', character.name) : null,
    ...areas.map((a) => setField(world, 'containers', a.id, 'assignedFollowerIds', a.assignedFollowerIds.filter((id) => id !== character.id), a.name)),
  ]);
}

export function revive(world, character) {
  return batch(`${character.name} is alive again`, [
    setField(world, 'characters', character.id, 'alive', true, character.name),
    setField(world, 'characters', character.id, 'death', null, character.name),
  ]);
}

// The "Mark dead" form: asks for a cause and a day (today by default).
export function deathForm(world, character, onClose) {
  const cause = h('input', { type: 'text', class: 'wide', placeholder: 'Cause of death', 'data-key': `${character.id}.deathCause` });
  const day = h('input', { type: 'number', step: 1, value: world.meta.currentDay, 'data-key': `${character.id}.deathDay` });
  const message = h('p', { class: 'message error small' });
  return h(
    'form',
    {
      class: 'helper-box',
      onsubmit: (e) => {
        e.preventDefault();
        const n = Number(day.value);
        if (!Number.isInteger(n)) return (message.textContent = 'The day must be a whole number.');
        onClose();
        dispatch(markDead(world, character, cause.value.trim(), n));
      },
    },
    h('h3', {}, `Mark ${character.name} dead`),
    h('label', {}, 'Cause'),
    cause,
    h('label', {}, 'Day'),
    day,
    h('p', { class: 'muted small' }, 'They move to the Death Log, lose their assignment and are taken off any Area they work in. Ctrl+Z undoes it.'),
    message,
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn small danger', type: 'submit' }, 'Mark dead'),
      h('button', { class: 'btn small', type: 'button', onclick: onClose }, 'Cancel'),
    ),
  );
}

// Cause and day of a dead character, editable, plus Revive.
export function deathDetails(world, character) {
  const death = character.death ?? { cause: '', day: null };
  const set = (changes) => dispatch(setField(world, 'characters', character.id, 'death', { ...death, ...changes }, character.name));
  return h(
    'div',
    { class: 'helper-box dead' },
    h('h3', {}, 'Death Log'),
    h('label', {}, 'Cause'),
    h('input', { type: 'text', class: 'wide', value: death.cause ?? '', 'data-key': `${character.id}.death.cause`, onchange: (e) => set({ cause: e.target.value }) }),
    h('label', {}, 'Day'),
    h('input', {
      type: 'number',
      step: 1,
      value: death.day ?? '',
      'data-key': `${character.id}.death.day`,
      onchange: (e) => set({ day: e.target.value === '' ? null : Number(e.target.value) }),
    }),
    h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => dispatch(revive(world, character)) }, 'Revive')),
  );
}
