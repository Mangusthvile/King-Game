// Small form widgets for detail panels. They only report the new value
// (onValue); the caller turns it into a command, so every edit can be undone.
// key: a stable name like "region_123.notes". After an edit redraws the
// screen, dom.js uses it to put the cursor back in the field you clicked.
// It also names the field for Player View (ui/playerView.js): a record
// field gets an eye toggle in its label, and an Arbiter-only field is left
// out in Player View (the helpers then return an empty list).
import { h } from './dom.js';
import { dispatch, getWorld } from '../data/store.js';
import { getCollection, setField } from '../commands/recordCommands.js';
import { hiddenNow, eyeToggle } from './playerView.js';

const hidden = (key) => hiddenNow(getWorld(), key);
const fieldLabel = (label, key) => h('label', {}, label, key ? [' ', eyeToggle(getWorld(), key, label)] : null);

// A labelled text box. multiline = a textarea that grows with its text.
export function textField(label, value, onValue, { key, multiline = false, placeholder = '' } = {}) {
  if (hidden(key)) return [];
  const input = multiline
    ? h('textarea', { rows: 3, value: value ?? '', placeholder, 'data-key': key })
    : h('input', { type: 'text', class: 'wide', value: value ?? '', placeholder, 'data-key': key });
  input.addEventListener('change', () => onValue(input.value));
  return [fieldLabel(label, key), input];
}

// options: [{ value, label }]. A current value that is not in the list (for
// example a deleted type) is still shown, so nothing is silently changed.
export function selectField(label, value, options, onValue, { key, missingLabel = (v) => `${v} (missing)` } = {}) {
  if (hidden(key)) return [];
  const all = [...options];
  if (value && !all.some((o) => o.value === value)) all.push({ value, label: missingLabel(value) });
  const select = h(
    'select',
    { class: 'wide', 'data-key': key, onchange: (e) => onValue(e.target.value) },
    all.map((o) => h('option', { value: o.value }, o.label)),
  );
  select.value = value ?? '';
  return [fieldLabel(label, key), select];
}

// A labelled checkbox.
export function checkboxField(label, checked, onValue, { key, title = '' } = {}) {
  if (hidden(key)) return [];
  const box = h('input', { type: 'checkbox', checked: !!checked, 'data-key': key, onchange: (e) => onValue(e.target.checked) });
  return [h('label', { class: 'check-label', title }, box, ' ', label, key ? [' ', eyeToggle(getWorld(), key, label)] : null)];
}

// A list of removable chips plus a box to add one more.
//   items: [{ label, title, onRemove }]
//   suggestions: names offered while typing (an HTML datalist)
export function chipList(label, items, { onAdd, suggestions = [], placeholder = 'Add...', key }) {
  if (hidden(key)) return [];
  const listId = `list-${key}`;
  const input = h('input', { type: 'text', placeholder, 'data-key': key });
  input.setAttribute('list', listId); // "list" is read-only as a property, so h() can't set it
  const add = (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (value) onAdd(value);
  };
  return [
    fieldLabel(label, key),
    h(
      'div',
      { class: 'chip-list' },
      items.length
        ? items.map((item) =>
            h(
              'span',
              { class: 'chip', title: item.title ?? '' },
              item.label,
              h('button', { class: 'chip-x', title: 'Remove', onclick: item.onRemove }, 'x'),
            ),
          )
        : h('span', { class: 'muted small' }, 'None yet.'),
    ),
    h(
      'form',
      { class: 'row chip-add', onsubmit: add },
      input,
      h('datalist', { id: listId }, suggestions.map((s) => h('option', { value: s }))),
      h('button', { class: 'btn small', type: 'submit' }, 'Add'),
    ),
  ];
}

// onValue for a plain field of a record: dispatches setField if it changed.
export function fieldSetter(world, path, id, field) {
  return (value) => {
    const record = getCollection(world, path)[id];
    if (record[field] !== value) dispatch(setField(world, path, id, field, value, record.name));
  };
}
