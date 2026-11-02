// An editor for a list field of a character (skills, theories, traits,
// conditions, weapons, inventory). Every edit replaces the whole list with
// one setField, so it undoes in one step.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField } from '../../commands/recordCommands.js';

// columns: [{ key, label, type, options, wide }]
//   type 'text' | 'number' | 'select' (options: [{ value, label }], may include
//   the current value's label via optionsFor(item))
// newItem(): the item added by the + button.
// extras(item, index): optional nodes at the end of a row (bonus, helper buttons).
export function listEditor(world, character, field, columns, { newItem, addLabel = '+ Add', extras = null }) {
  const list = character[field] ?? [];
  const setList = (next) => dispatch(setField(world, 'characters', character.id, field, next, character.name));
  const update = (i, changes) => setList(list.map((item, j) => (j === i ? { ...item, ...changes } : item)));

  const rows = list.map((item, i) =>
    h(
      'div',
      { class: 'list-row' },
      h('div', { class: 'list-cells' }, columns.map((col) => cell(col, item, (changes) => update(i, changes), `${character.id}.${field}.${i}.${col.key}`))),
      h(
        'div',
        { class: 'row list-actions' },
        extras?.(item, i),
        h('button', { class: 'btn small danger', title: 'Remove', onclick: () => setList(list.filter((_, j) => j !== i)) }, 'x'),
      ),
    ),
  );

  return h(
    'div',
    { class: 'list-editor' },
    rows.length ? rows : h('p', { class: 'muted small' }, 'None.'),
    h('button', { class: 'btn small', onclick: () => setList([...list, newItem()]) }, addLabel),
  );
}

// One input. onChange gets the changed fields of the item.
function cell(col, item, onChange, key) {
  const label = (input) =>
    h('label', { class: `list-cell${col.wide ? ' wide' : ''}`, title: col.title ?? col.label }, h('span', { class: 'list-cell-label' }, col.label), input);
  const value = item[col.key];
  if (col.type === 'select') {
    const options = typeof col.options === 'function' ? col.options(item) : col.options;
    const all = value && !options.some((o) => o.value === value) ? [...options, { value, label: `${value} (missing)` }] : options;
    const select = h('select', { 'data-key': key, onchange: (e) => onChange({ [col.key]: e.target.value }) }, all.map((o) => h('option', { value: o.value }, o.label)));
    select.value = value ?? '';
    return label(select);
  }
  if (col.type === 'number') {
    return label(
      h('input', {
        type: 'number',
        step: 'any',
        value: value ?? '',
        'data-key': key,
        onchange: (e) => {
          // Empty is allowed (for example a condition with no set duration).
          if (e.target.value === '') return onChange({ [col.key]: '' });
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange({ [col.key]: n });
        },
      }),
    );
  }
  return label(h('input', { type: 'text', value: value ?? '', placeholder: col.placeholder ?? '', 'data-key': key, onchange: (e) => onChange({ [col.key]: e.target.value }) }));
}
