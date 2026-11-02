// The level progression table of a Body Type: Lv, Body Lv, STR, SPD, TOU,
// notes. Each edit replaces the whole table (one undo step).
import { h } from '../../ui/dom.js';

const COLUMNS = [
  { key: 'lv', label: 'Lv', number: true },
  { key: 'bodyLv', label: 'Body Lv', number: true },
  { key: 'STR', label: 'STR', number: true },
  { key: 'SPD', label: 'SPD', number: true },
  { key: 'TOU', label: 'TOU', number: true },
  { key: 'notes', label: 'Notes' },
];

export function levelsTable(levels, set, key) {
  const update = (i, field, value) => set(levels.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  const rows = levels.map((row, i) =>
    h(
      'tr',
      {},
      COLUMNS.map((c) =>
        h(
          'td',
          {},
          h('input', {
            type: c.number ? 'number' : 'text',
            step: 'any',
            class: c.number ? 'tiny-number' : '',
            value: row[c.key] ?? '',
            'data-key': `${key}.${i}.${c.key}`,
            onchange: (e) => {
              if (!c.number) return update(i, c.key, e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(n)) update(i, c.key, n);
            },
          }),
        ),
      ),
      h('td', {}, h('button', { class: 'btn small danger', title: 'Remove level', onclick: () => set(levels.filter((_, j) => j !== i)) }, 'x')),
    ),
  );
  // A new row continues from the last one (next Lv and Body Lv, same stats).
  const addRow = () => {
    const last = levels[levels.length - 1];
    set([...levels, last ? { ...last, lv: last.lv + 1, bodyLv: last.bodyLv + 1, notes: '' } : { lv: 1, bodyLv: 1, STR: 1, SPD: 1, TOU: 1, notes: '' }]);
  };
  return h(
    'div',
    { class: 'table-scroll' },
    h('table', { class: 'building-table levels-table small' }, h('thead', {}, h('tr', {}, [...COLUMNS.map((c) => h('th', {}, c.label)), h('th', {}, '')])), h('tbody', {}, rows)),
    h('button', { class: 'btn small', onclick: addRow }, '+ Level'),
  );
}
