// Editor for Region, Biome or Area types: name, color and default fields.
// Default fields are copied onto a Region, Biome or Area when it gets the type.
import { pvActive } from './playerView.js';
import { h } from './dom.js';
import { dispatch } from '../data/store.js';
import { newId } from '../data/ids.js';
import { setField, addRecord, removeRecord } from '../commands/recordCommands.js';
import { renderCustomFields } from './customFieldsEditor.js';
import { TYPE_PATHS, typesFor, countUsing } from '../map/containerTypes.js';

// Which types have their default fields expanded, so a redraw keeps them open.
const expanded = new Set();

// kind: 'region' | 'biome' | 'area'.  title: heading text.
export function renderTypeEditor(world, kind, title) {
  if (pvActive(world)) return []; // an Arbiter tool, not shown in Player View
  const path = TYPE_PATHS[kind];
  const types = Object.values(typesFor(world, kind));

  const rows = types.map((t) => {
    const fieldCount = Object.keys(t.defaultFields ?? {}).length;
    const details = h(
      'details',
      { class: 'type-fields', open: expanded.has(t.id) },
      h('summary', { class: 'small muted' }, `Default fields (${fieldCount})`),
      renderCustomFields(world, path, t.id, { key: 'defaultFields', title: 'Default fields' }),
    );
    details.addEventListener('toggle', () => (details.open ? expanded.add(t.id) : expanded.delete(t.id)));
    return h(
      'div',
      { class: 'type-row' },
      h(
        'div',
        { class: 'type-head' },
        h('input', {
          type: 'color',
          value: t.color,
          title: 'Color',
          onchange: (e) => dispatch(setField(world, path, t.id, 'color', e.target.value, t.name)),
        }),
        h('input', {
          type: 'text',
          value: t.name,
          'data-key': `${t.id}.name`,
          onchange: (e) => e.target.value.trim() && dispatch(setField(world, path, t.id, 'name', e.target.value.trim(), t.name)),
        }),
        h('button', { class: 'btn small danger', title: 'Delete type', onclick: () => deleteType(world, kind, t) }, 'x'),
      ),
      details,
    );
  });

  return h(
    'div',
    { class: 'type-editor' },
    h('h3', {}, title),
    h('p', { class: 'muted small' }, 'Changing a type later adds its missing default fields; it never removes fields.'),
    rows.length ? rows : h('p', { class: 'muted small' }, 'No types yet.'),
    h(
      'button',
      {
        class: 'btn small',
        onclick: () => {
          const type = { id: newId(`${kind}Type`), name: 'New Type', color: '#888888', defaultFields: {}, customFields: {} };
          expanded.add(type.id);
          dispatch(addRecord(path, type));
        },
      },
      '+ Add type',
    ),
  );
}

function deleteType(world, kind, type) {
  const used = countUsing(world, type.id);
  const warning = used ? `\n\n${used} record(s) use it. They keep their fields and show the type as missing.` : '';
  if (!confirm(`Delete type "${type.name}"?${warning}\n\nYou can undo this with Ctrl+Z.`)) return;
  dispatch(removeRecord(world, TYPE_PATHS[kind], type.id));
}
