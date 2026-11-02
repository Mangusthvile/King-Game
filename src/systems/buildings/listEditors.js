// Small editors for a building's properties and storage. Each edit replaces
// the whole list with setField, so it is one undo step.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { newId } from '../../data/ids.js';
import { getCollection, setField, addRecord, batch } from '../../commands/recordCommands.js';

// Free-form key/value pairs: [{ key, value }]. Used for a building's
// properties (path 'buildings') and a type's defaultProperties.
export function keyValueEditor(world, path, id, field) {
  const record = getCollection(world, path)[id];
  const list = record[field] ?? [];
  const setList = (next) => dispatch(setField(world, path, id, field, next, record.name));
  const update = (i, changes) => setList(list.map((p, j) => (j === i ? { ...p, ...changes } : p)));
  const dataKey = (i, part) => `${id}.${field}.${i}.${part}`;

  const rows = list.map((p, i) =>
    h(
      'div',
      { class: 'kv-row' },
      h('input', { type: 'text', value: p.key, placeholder: 'Name', 'data-key': dataKey(i, 'key'), onchange: (e) => e.target.value.trim() && update(i, { key: e.target.value.trim() }) }),
      h('input', { type: 'text', value: p.value, placeholder: 'Value', 'data-key': dataKey(i, 'value'), onchange: (e) => update(i, { value: e.target.value }) }),
      h('button', { class: 'btn small danger', title: 'Remove', onclick: () => setList(list.filter((_, j) => j !== i)) }, 'x'),
    ),
  );

  const keyInput = h('input', { type: 'text', placeholder: 'New property', 'data-key': `${id}.${field}.newKey` });
  const valueInput = h('input', { type: 'text', placeholder: 'Value', 'data-key': `${id}.${field}.newValue` });
  const add = (e) => {
    e.preventDefault();
    const key = keyInput.value.trim();
    if (key) setList([...list, { key, value: valueInput.value }]);
  };

  return h(
    'div',
    { class: 'kv-list' },
    rows.length ? rows : h('p', { class: 'muted small' }, 'None yet.'),
    h('form', { class: 'kv-row add', onsubmit: add }, keyInput, valueInput, h('button', { class: 'btn small', type: 'submit' }, 'Add')),
  );
}

// Resource counts kept in a building: { resourceTypeId: count }. Set by hand
// for now. Resource types are shared definitions (typing a new name creates one).
export function storageEditor(world, building) {
  const types = world.definitions.resourceTypes;
  const storage = building.storage ?? {};
  const setStorage = (next) => setField(world, 'buildings', building.id, 'storage', next, building.name);
  const countOf = (value) => {
    const n = Number(value);
    return value !== '' && Number.isFinite(n) ? n : null;
  };

  const rows = Object.entries(storage).map(([typeId, count]) =>
    h(
      'div',
      { class: 'kv-row' },
      h('span', { class: types[typeId] ? '' : 'muted' }, types[typeId]?.name ?? '(deleted resource)'),
      h('input', {
        type: 'number',
        value: count,
        title: 'Count',
        'data-key': `${building.id}.storage.${typeId}`,
        onchange: (e) => {
          const n = countOf(e.target.value);
          if (n !== null) dispatch(setStorage({ ...storage, [typeId]: n }));
        },
      }),
      h(
        'button',
        {
          class: 'btn small danger',
          title: 'Remove from storage',
          onclick: () => {
            const next = { ...storage };
            delete next[typeId];
            dispatch(setStorage(next));
          },
        },
        'x',
      ),
    ),
  );

  const listId = `storage-names-${building.id}`;
  const nameInput = h('input', { type: 'text', placeholder: 'Resource name', 'data-key': `${building.id}.storage.newName` });
  nameInput.setAttribute('list', listId); // read-only as a property, so h() can't set it
  const countInput = h('input', { type: 'number', value: 0, title: 'Count', 'data-key': `${building.id}.storage.newCount` });
  const add = (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const count = countOf(countInput.value);
    if (!name || count === null) return;
    const existing = Object.values(types).find((t) => t.name.toLowerCase() === name.toLowerCase());
    const type = existing ?? { id: newId('resource'), name, description: '', tags: [], customFields: {} };
    dispatch(
      batch(`Stored ${count} ${name} in "${building.name}"`, [
        existing ? null : addRecord('definitions.resourceTypes', type),
        setStorage({ ...storage, [type.id]: count }),
      ]),
    );
  };

  return h(
    'div',
    { class: 'kv-list' },
    rows.length ? rows : h('p', { class: 'muted small' }, 'Empty.'),
    h(
      'form',
      { class: 'kv-row add', onsubmit: add },
      nameInput,
      countInput,
      h('datalist', { id: listId }, Object.values(types).map((t) => h('option', { value: t.name }))),
      h('button', { class: 'btn small', type: 'submit' }, 'Add'),
    ),
  );
}
