// The Libraries view: one editor per library (Species, Body Types, Skills,
// Traits & Pacts, Conditions, Equipment, Teams), driven by the field lists
// in libraries.js. Every edit is a command.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, addRecord, removeRecord } from '../../commands/recordCommands.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import { LIBRARIES, library, libraryPath, countUsers, inStasis } from './libraries.js';
import { levelsTable } from './levelsTable.js';
import { charactersView as view } from './state.js';

// Which entries are open, so a redraw keeps them open.
const expanded = new Set();

// Libraries in stasis (Teams, Conditions) are hidden until the Combat stage.
const SHOWN = LIBRARIES.filter((l) => !inStasis(l.key));

export function renderLibraries(world, refresh) {
  const lib = SHOWN.find((l) => l.key === view.libraryKey) ?? SHOWN[0];
  const entries = Object.values(world.definitions[lib.key] ?? {});
  const filter = view.librarySearch.trim().toLowerCase();
  const shown = entries.filter((e) => !filter || e.name.toLowerCase().includes(filter));
  const search = h('input', { type: 'search', placeholder: `Search ${lib.label}...`, value: view.librarySearch, class: 'roster-search' });
  search.addEventListener('change', () => ((view.librarySearch = search.value), refresh()));

  return h(
    'div',
    { class: 'library-page' },
    h(
      'div',
      { class: 'row library-tabs' },
      SHOWN.map((l) =>
        h(
          'button',
          { class: l.key === lib.key ? 'btn small active' : 'btn small', onclick: () => ((view.libraryKey = l.key), (view.librarySearch = ''), refresh()) },
          `${l.label} (${Object.keys(world.definitions[l.key] ?? {}).length})`,
        ),
      ),
    ),
    h(
      'section',
      { class: 'frame panel' },
      h('div', { class: 'row' }, h('h2', {}, lib.label), h('div', { class: 'spacer' }), search),
      shown.length ? shown.map((e) => entryCard(world, lib, e, refresh)) : h('p', { class: 'muted small' }, 'None yet.'),
      h(
        'button',
        {
          class: 'btn small',
          onclick: () => {
            const created = lib.create();
            expanded.add(created.id);
            dispatch(addRecord(libraryPath(lib.key), created));
          },
        },
        `+ New`,
      ),
    ),
  );
}

function entryCard(world, lib, e, refresh) {
  const path = libraryPath(lib.key);
  const open = expanded.has(e.id);
  const used = countUsers(world, lib.key, e.id);
  return h(
    'div',
    { class: `library-card${open ? ' open' : ''}` },
    h(
      'div',
      { class: 'library-head' },
      // An empty span keeps the grid columns lined up when there is no color dot.
      e.color ? h('span', { class: 'team-dot', style: `background:${e.color}` }) : h('span'),
      h('input', {
        type: 'text',
        value: e.name,
        'data-key': `${e.id}.name`,
        onchange: (ev) => ev.target.value.trim() && dispatch(setField(world, path, e.id, 'name', ev.target.value.trim(), e.name)),
      }),
      h('span', { class: 'muted small library-summary' }, lib.summary(world, e), used ? ` · used by ${used}` : ''),
      h('button', { class: 'btn small', onclick: () => (open ? expanded.delete(e.id) : expanded.add(e.id), refresh()) }, open ? 'Close' : 'Edit'),
      h(
        'button',
        {
          class: 'btn small danger',
          title: 'Delete',
          onclick: () =>
            confirm(`Delete "${e.name}"?${used ? ` ${used} character(s) use it and will show it as deleted.` : ''} Ctrl+Z undoes it.`) &&
            dispatch(removeRecord(world, path, e.id)),
        },
        'x',
      ),
    ),
    open
      ? h(
          'div',
          { class: 'library-body' },
          lib.fields.map((f) => fieldEditor(world, path, e, f)),
          renderCustomFields(world, path, e.id),
        )
      : null,
  );
}

// One field of a library entry. Number fields left empty are stored as null.
function fieldEditor(world, path, e, f) {
  const set = (value) => dispatch(setField(world, path, e.id, f.key, value, e.name));
  const key = `${e.id}.${f.key}`;
  const value = e[f.key];
  const wrap = (input) => h('div', { class: 'lib-field' }, h('label', {}, f.label), input);

  switch (f.type) {
    case 'textarea':
      return wrap(h('textarea', { rows: 2, value: value ?? '', 'data-key': key, onchange: (ev) => set(ev.target.value) }));
    case 'number':
      return wrap(
        h('input', {
          type: 'number',
          step: 'any',
          value: value ?? '',
          placeholder: f.placeholder ?? '',
          'data-key': key,
          onchange: (ev) => {
            const n = Number(ev.target.value);
            if (ev.target.value === '') set(null);
            else if (Number.isFinite(n)) set(n);
          },
        }),
      );
    case 'value': // a stat that is usually a number but may be text ("N/A")
      return wrap(
        h('input', {
          type: 'text',
          value: value ?? '',
          'data-key': key,
          onchange: (ev) => {
            const raw = ev.target.value.trim();
            set(raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw);
          },
        }),
      );
    case 'checkbox':
      return h('label', { class: 'check-label lib-check' }, h('input', { type: 'checkbox', checked: !!value, onchange: (ev) => set(ev.target.checked) }), ' ', f.label);
    case 'color':
      return wrap(h('input', { type: 'color', value: value || '#888888', onchange: (ev) => set(ev.target.value) }));
    case 'select':
      return wrap(selectBox(value, f.options.map((o) => ({ value: o, label: o })), set, key));
    case 'triState':
      return wrap(
        selectBox(
          value === true ? 'yes' : value === false ? 'no' : '',
          [
            { value: '', label: '(blank)' },
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
          (v) => set(v === 'yes' ? true : v === 'no' ? false : null),
          key,
        ),
      );
    case 'ref':
      return wrap(selectBox(value, [{ value: '', label: '(none)' }, ...refOptions(world, f.library)], set, key));
    case 'stringList':
      return wrap(stringList(value ?? [], set, key));
    case 'refList':
      return wrap(refList(world, f.library, value ?? [], set, key));
    case 'levels':
      return wrap(levelsTable(value ?? [], set, key));
    case 'defaultFields':
      return renderCustomFields(world, path, e.id, { key: 'defaultFields', title: f.label });
    default: {
      const input = h('input', { type: 'text', value: value ?? '', 'data-key': key, onchange: (ev) => set(ev.target.value) });
      if (f.suggestions) {
        input.setAttribute('list', `list-${f.key}`);
        return wrap([input, h('datalist', { id: `list-${f.key}` }, f.suggestions.map((s) => h('option', { value: s })))]);
      }
      return wrap(input);
    }
  }
}

export function refOptions(world, libraryKey) {
  return Object.values(world.definitions[libraryKey] ?? {}).map((x) => ({ value: x.id, label: x.name }));
}

function selectBox(value, options, onValue, key) {
  const all = [...options];
  if (value && !all.some((o) => o.value === value)) all.push({ value, label: '(deleted)' });
  const el = h('select', { 'data-key': key, onchange: (ev) => onValue(ev.target.value) }, all.map((o) => h('option', { value: o.value }, o.label)));
  el.value = value ?? '';
  return el;
}

// Removable chips plus an input to add one (tags, required Theories).
function stringList(list, set, key) {
  const input = h('input', { type: 'text', placeholder: 'Add...', 'data-key': `${key}.new` });
  return h(
    'div',
    {},
    h(
      'div',
      { class: 'chip-list' },
      list.map((s, i) => h('span', { class: 'chip' }, s, h('button', { class: 'chip-x', title: 'Remove', onclick: () => set(list.filter((_, j) => j !== i)) }, 'x'))),
    ),
    h(
      'form',
      {
        class: 'row chip-add',
        onsubmit: (ev) => {
          ev.preventDefault();
          const v = input.value.trim();
          if (v && !list.includes(v)) set([...list, v]);
        },
      },
      input,
      h('button', { class: 'btn small', type: 'submit' }, 'Add'),
    ),
  );
}

// Chips of other library entries (a Body Type's granted Traits).
function refList(world, libraryKey, ids, set, key) {
  const lib = world.definitions[libraryKey] ?? {};
  const select = h('select', { 'data-key': `${key}.new` }, h('option', { value: '' }, 'Add...'), refOptions(world, libraryKey).filter((o) => !ids.includes(o.value)).map((o) => h('option', { value: o.value }, o.label)));
  select.addEventListener('change', () => select.value && set([...ids, select.value]));
  return h(
    'div',
    {},
    h(
      'div',
      { class: 'chip-list' },
      ids.map((id) => h('span', { class: 'chip' }, lib[id]?.name ?? '(deleted)', h('button', { class: 'chip-x', title: 'Remove', onclick: () => set(ids.filter((x) => x !== id)) }, 'x'))),
    ),
    select,
  );
}
