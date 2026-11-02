// Settings tab: world name, current day, Resolution Log options, backup export.
import { h, formatDate } from './dom.js';
import { dispatch } from '../data/store.js';
import { renameWorld, setCurrentDay } from '../commands/worldCommands.js';
import { exportWorld } from '../data/exportImport.js';
import { checkboxField } from './fields.js';
import { setField } from '../commands/recordCommands.js';

export function renderSettingsTab(world) {
  const message = h('p', { class: 'message' });
  const fail = (text) => {
    message.textContent = text;
    message.classList.add('error');
  };

  const nameInput = h('input', { type: 'text', value: world.meta.name, maxLength: 80 });
  const nameForm = h(
    'form',
    {
      class: 'row',
      onsubmit: (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return fail('The world needs a name.');
        if (name !== world.meta.name) dispatch(renameWorld(world, name));
      },
    },
    nameInput,
    h('button', { class: 'btn', type: 'submit' }, 'Rename'),
  );

  // The Arbiter can set the day to any whole number (CLAUDE.md: "The Arbiter
  // can manually set currentDay").
  const dayInput = h('input', { type: 'number', step: 1, value: world.meta.currentDay });
  const dayForm = h(
    'form',
    {
      class: 'row',
      onsubmit: (e) => {
        e.preventDefault();
        const day = Number(dayInput.value);
        if (!Number.isInteger(day)) return fail('Day must be a whole number.');
        if (day !== world.meta.currentDay) dispatch(setCurrentDay(world, day));
      },
    },
    dayInput,
    h('button', { class: 'btn', type: 'submit' }, 'Set Day'),
  );

  return h(
    'div',
    { class: 'tab-page' },
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, 'World'),
      h('label', {}, 'Name'),
      nameForm,
      h('label', {}, 'Current day'),
      dayForm,
      message,
    ),
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, 'Resolution Logs'),
      ...checkboxField('Add "(edited)" after values changed by hand', world.meta.settings?.markEdited, (on) => dispatch(setField(world, 'meta', 'settings', 'markEdited', on)), {
        key: 'settings.markEdited',
        title: 'Logs always show the final value; this also marks it as edited.',
      }),
    ),
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, 'Backup'),
      h('p', { class: 'muted' }, 'Downloads the whole world, including its action log, as a JSON file.'),
      h('button', { class: 'btn', onclick: () => exportWorld(world) }, 'Export JSON'),
    ),
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, 'Info'),
      h(
        'dl',
        { class: 'info' },
        h('dt', {}, 'Schema version'),
        h('dd', {}, world.schemaVersion),
        h('dt', {}, 'Created'),
        h('dd', {}, formatDate(world.meta.created)),
        h('dt', {}, 'World id'),
        h('dd', { class: 'small' }, world.meta.id),
      ),
    ),
  );
}
