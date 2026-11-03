// World settings panels, used by the System screens (systems/settings) and
// Codex > Rules > Log Templates:
//   worldPanel:      the world's name and info (System > Worlds > Open)
//   exportPanel:     Export JSON (System > Worlds > Import/Export)
//   snapshotsPanel:  how many end-of-day snapshots are kept (Preferences)
//   logOptionsPanel: Resolution Log options ("(edited)" marks)
// Set Day is in Chronicle > History, with Reverse Day.
import { h, formatDate } from './dom.js';
import { dispatch } from '../data/store.js';
import { renameWorld } from '../commands/worldCommands.js';
import { exportWorld } from '../data/exportImport.js';
import { checkboxField } from './fields.js';
import { setField } from '../commands/recordCommands.js';
import { snapshotsKept } from '../data/snapshots.js';

export function worldPanel(world) {
  const message = h('p', { class: 'message error' });
  const nameInput = h('input', { type: 'text', value: world.meta.name, maxLength: 80 });
  const nameForm = h(
    'form',
    {
      class: 'row',
      onsubmit: (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return (message.textContent = 'The world needs a name.');
        if (name !== world.meta.name) dispatch(renameWorld(world, name));
      },
    },
    nameInput,
    h('button', { class: 'btn', type: 'submit' }, 'Rename'),
  );
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'This world'),
    h('label', {}, 'Name'),
    nameForm,
    message,
    h(
      'dl',
      { class: 'info' },
      h('dt', {}, 'Current day'),
      h('dd', {}, `Day ${world.meta.currentDay} (set it in Chronicle > History)`),
      h('dt', {}, 'Schema version'),
      h('dd', {}, world.schemaVersion),
      h('dt', {}, 'Created'),
      h('dd', {}, formatDate(world.meta.created)),
      h('dt', {}, 'World id'),
      h('dd', { class: 'small' }, world.meta.id),
    ),
  );
}

export function exportPanel(world) {
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Export'),
    h('p', { class: 'muted small' }, 'Downloads the whole world, including its action log, as a JSON file. Import JSON (on the world list) on another computer brings it in once; it does not stay in sync.'),
    h('button', { class: 'btn', onclick: () => exportWorld(world) }, 'Export JSON'),
  );
}

export function logOptionsPanel(world) {
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Resolution Log options'),
    ...checkboxField('Add "(edited)" after values changed by hand', world.meta.settings?.markEdited, (on) => dispatch(setField(world, 'meta', 'settings', 'markEdited', on)), {
      key: 'settings.markEdited',
      title: 'Logs always show the final value; this also marks it as edited.',
    }),
  );
}

// How many end-of-day snapshots Reverse Day can go back to.
export function snapshotsPanel(world) {
  const input = h('input', { type: 'number', class: 'short-input', min: 0, step: 1, value: snapshotsKept(world), 'data-key': 'settings.snapshotsKept' });
  input.addEventListener('change', () => {
    const n = Math.round(Number(input.value));
    if (Number.isInteger(n) && n >= 0 && n !== snapshotsKept(world)) dispatch(setField(world, 'meta', 'settings', 'snapshotsKept', n));
  });
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Snapshots'),
    h('label', {}, 'Days of snapshots kept'),
    h('div', { class: 'row' }, input, h('span', { class: 'muted small' }, 'Advance Day saves a snapshot of the day; Reverse Day (Chronicle > History) goes back to one. Older snapshots are dropped at the next Advance Day. Each snapshot is a full copy of the world, so the save and world file grow with this number.')),
  );
}
