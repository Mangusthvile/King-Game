// Resources with an Availability rating, for any container record that has
// a resources list (Biomes and Areas).
import { h } from './dom.js';
import { dispatch } from '../data/store.js';
import { newId } from '../data/ids.js';
import { setField, addRecord, batch } from '../commands/recordCommands.js';
import availabilityTable from '../rules/tables/availability.json';

// The Availability ratings come from the Harvest Availability Tables in RULES.md.
function availabilitySelect(value, onValue, key) {
  const levels = availabilityTable.levels;
  const options = ['', ...levels, ...(value && !levels.includes(value) ? [value] : [])];
  const select = h(
    'select',
    { 'data-key': key, title: 'Availability', onchange: (e) => onValue(e.target.value) },
    options.map((l) => h('option', { value: l }, l || 'Availability...')),
  );
  select.value = value ?? '';
  return select;
}

// Each entry is { resourceTypeId, availability, notes, known }. known = the
// followers have found it (Resolution Logs hide unknown resources). Resource types are
// shared definitions, so renaming one here renames it everywhere.
export function resourcesEditor(world, record) {
  const types = world.definitions.resourceTypes;
  const list = record.resources;
  const setList = (next) => setField(world, 'containers', record.id, 'resources', next, record.name);
  const updateEntry = (i, changes) => dispatch(setList(list.map((r, j) => (j === i ? { ...r, ...changes } : r))));

  const rows = list.map((r, i) => {
    const type = types[r.resourceTypeId];
    const key = `${record.id}.res.${r.resourceTypeId}`;
    return h(
      'div',
      { class: 'resource-row' },
      h('input', {
        type: 'text',
        value: type?.name ?? '(deleted resource)',
        title: 'Resource name (renames it everywhere)',
        disabled: !type,
        'data-key': `${key}.name`,
        onchange: (e) => {
          const name = e.target.value.trim();
          if (name && name !== type.name) dispatch(setField(world, 'definitions.resourceTypes', type.id, 'name', name, type.name));
        },
      }),
      availabilitySelect(r.availability, (v) => updateEntry(i, { availability: v }), `${key}.availability`),
      h('input', {
        type: 'text',
        value: r.notes ?? '',
        placeholder: 'Notes',
        'data-key': `${key}.notes`,
        onchange: (e) => updateEntry(i, { notes: e.target.value }),
      }),
      h(
        'div',
        { class: 'row resource-end' },
        h(
          'label',
          { class: 'check-label small', title: 'Known: the followers have found this resource' },
          h('input', { type: 'checkbox', checked: r.known ?? true, 'data-key': `${key}.known`, onchange: (e) => updateEntry(i, { known: e.target.checked }) }),
          ' Known',
        ),
        h('button', { class: 'btn small danger', title: 'Remove resource', onclick: () => dispatch(setList(list.filter((_, j) => j !== i))) }, 'x'),
      ),
    );
  });

  // Add form: typing a name that doesn't exist yet creates the resource type.
  const listId = `res-names-${record.id}`;
  const nameInput = h('input', { type: 'text', placeholder: 'Resource name', 'data-key': `${record.id}.res.new` });
  nameInput.setAttribute('list', listId);
  const newAvailability = availabilitySelect('', () => {}, `${record.id}.res.newAvailability`);
  const add = (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    const availability = newAvailability.value;
    const existing = Object.values(types).find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing && list.some((r) => r.resourceTypeId === existing.id)) return; // already listed
    const type = existing ?? { id: newId('resource'), name, description: '', tags: [], customFields: {} };
    dispatch(
      batch(`Added resource "${name}" to "${record.name}"`, [
        existing ? null : addRecord('definitions.resourceTypes', type),
        setList([...list, { resourceTypeId: type.id, availability, notes: '', known: true }]),
      ]),
    );
  };

  return h(
    'div',
    { class: 'resources' },
    rows.length ? rows : h('p', { class: 'muted small' }, 'None yet.'),
    h(
      'form',
      { class: 'resource-row add', onsubmit: add },
      nameInput,
      newAvailability,
      h('datalist', { id: listId }, Object.values(types).map((t) => h('option', { value: t.name }))),
      h('button', { class: 'btn small', type: 'submit' }, 'Add'),
    ),
  );
}
