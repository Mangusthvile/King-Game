// Reusable editor for a record's customFields: the Arbiter adds, renames,
// retypes and removes fields with no code. Any panel can include it.
import { h } from './dom.js';
import { dispatch } from '../data/store.js';
import { getCollection } from '../commands/recordCommands.js';
import { addCustomField, updateCustomField, removeCustomField } from '../commands/customFieldCommands.js';

const TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'boolean', label: 'Yes/No' },
];

function typeSelect(value, onchange) {
  return h(
    'select',
    { onchange },
    TYPES.map((t) => h('option', { value: t.id, selected: t.id === value }, t.label)),
  );
}

// path + id name the record, for example ('containers', regionId).
// key = 'defaultFields' edits a type's default fields instead.
export function renderCustomFields(world, path, id, { key = 'customFields', title = 'Custom fields' } = {}) {
  const fields = getCollection(world, path)[id][key] ?? {};
  const update = (fieldId, changes) => dispatch(updateCustomField(world, path, id, fieldId, changes, key));

  const rows = Object.entries(fields).map(([fieldId, field]) =>
    h(
      'div',
      { class: 'custom-field' },
      h('input', {
        type: 'text',
        value: field.name,
        title: 'Field name',
        onchange: (e) => e.target.value.trim() && update(fieldId, { name: e.target.value.trim() }),
      }),
      typeSelect(field.type, (e) => update(fieldId, { type: e.target.value })),
      valueInput(field, (value) => update(fieldId, { value })),
      h(
        'button',
        {
          class: 'btn small danger',
          title: 'Remove field',
          onclick: () => dispatch(removeCustomField(world, path, id, fieldId, key)),
        },
        'x',
      ),
    ),
  );

  const nameInput = h('input', { type: 'text', placeholder: 'New field name' });
  const newType = typeSelect('text');
  const addForm = h(
    'form',
    {
      class: 'row',
      onsubmit: (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (name) dispatch(addCustomField(path, id, name, newType.value, key));
      },
    },
    nameInput,
    newType,
    h('button', { class: 'btn small', type: 'submit' }, 'Add'),
  );

  return h(
    'div',
    { class: 'custom-fields' },
    h('h3', {}, title),
    rows.length ? rows : h('p', { class: 'muted small' }, 'None yet.'),
    addForm,
  );
}

function valueInput(field, onValue) {
  if (field.type === 'boolean') {
    return h('input', { type: 'checkbox', checked: !!field.value, onchange: (e) => onValue(e.target.checked) });
  }
  if (field.type === 'number') {
    return h('input', {
      type: 'number',
      value: field.value,
      onchange: (e) => {
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n)) onValue(n);
      },
    });
  }
  return h('input', { type: 'text', value: field.value, onchange: (e) => onValue(e.target.value) });
}
