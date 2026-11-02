// Editors for building types and building categories (Buildings tab).
// Type: name, category, default footprint, construction stage thresholds,
// default properties. Category: name and color (the placeholder color).
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { newId } from '../../data/ids.js';
import { setField, addRecord, removeRecord } from '../../commands/recordCommands.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import { STAGES, defaultThresholds } from './stages.js';
import { keyValueEditor } from './listEditors.js';
import { createBuildingType } from './buildingKind.js';

const TYPES = 'definitions.buildingTypes';
const CATEGORIES = 'definitions.buildingCategories';

// Which types have their extra sections open, so a redraw keeps them open.
const expanded = new Set();

const wholeNumber = (value, min) => {
  const n = Number(value);
  return value !== '' && Number.isInteger(n) && n >= min ? n : null;
};

export function renderBuildingTypes(world) {
  const types = Object.values(world.definitions.buildingTypes);
  const categories = Object.values(world.definitions.buildingCategories);
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Building Types'),
    h('p', { class: 'muted small' }, 'New buildings take their type\'s footprint and default properties. A stage is shown from its threshold (percent progress) upward.'),
    types.length ? types.map((t) => typeRow(world, t, categories)) : h('p', { class: 'muted small' }, 'No building types yet.'),
    h(
      'button',
      {
        class: 'btn small',
        onclick: () => {
          const type = createBuildingType(categories[0]?.id ?? '');
          expanded.add(type.id);
          dispatch(addRecord(TYPES, type));
        },
      },
      '+ Add building type',
    ),
  );
}

function typeRow(world, t, categories) {
  const set = (field, value) => dispatch(setField(world, TYPES, t.id, field, value, t.name));
  const message = h('p', { class: 'message error small' });
  const key = (part) => `${t.id}.${part}`;

  const categorySelect = h(
    'select',
    { 'data-key': key('category'), title: 'Category', onchange: (e) => set('categoryId', e.target.value) },
    h('option', { value: '' }, '(no category)'),
    categories.map((c) => h('option', { value: c.id }, c.name)),
    t.categoryId && !categories.some((c) => c.id === t.categoryId) ? h('option', { value: t.categoryId }, '(deleted category)') : null,
  );
  categorySelect.value = t.categoryId ?? '';

  const sizeInput = (field) =>
    h('input', {
      type: 'number',
      min: 1,
      step: 1,
      value: t[field],
      'data-key': key(field),
      onchange: (e) => {
        const n = wholeNumber(e.target.value, 1);
        if (n === null) return (message.textContent = 'Footprint must be whole numbers of at least 1.');
        set(field, n);
      },
    });

  const thresholds = { ...defaultThresholds(), ...t.stageThresholds };
  const thresholdInputs = STAGES.map((s) => [
    h('label', {}, s.name),
    h('input', {
      type: 'number',
      min: 0,
      max: 100,
      step: 'any',
      value: thresholds[s.id],
      'data-key': key(`threshold.${s.id}`),
      onchange: (e) => {
        const n = Number(e.target.value);
        if (e.target.value === '' || !Number.isFinite(n) || n < 0 || n > 100) return (message.textContent = 'A threshold must be a number from 0 to 100.');
        set('stageThresholds', { ...thresholds, [s.id]: n });
      },
    }),
  ]);
  const values = STAGES.map((s) => thresholds[s.id]);
  const inOrder = values.every((v, i) => i === 0 || v >= values[i - 1]);

  const used = Object.values(world.buildings).filter((b) => b.buildingTypeId === t.id).length;
  const details = h(
    'details',
    { class: 'type-fields', open: expanded.has(t.id) },
    h('summary', { class: 'small muted' }, `Footprint ${t.w} x ${t.h}, stages, properties (used by ${used})`),
    h('div', { class: 'field-grid' }, h('label', {}, 'Width'), sizeInput('w'), h('label', {}, 'Height'), sizeInput('h')),
    h('h3', {}, 'Stage thresholds (%)'),
    h('div', { class: 'field-grid' }, thresholdInputs),
    inOrder ? null : h('p', { class: 'message error small' }, 'The thresholds are not in stage order. Each stage still starts at its own number.'),
    message,
    h('h3', {}, 'Default properties'),
    keyValueEditor(world, TYPES, t.id, 'defaultProperties'),
    renderCustomFields(world, TYPES, t.id),
  );
  details.addEventListener('toggle', () => (details.open ? expanded.add(t.id) : expanded.delete(t.id)));

  return h(
    'div',
    { class: 'type-row' },
    h(
      'div',
      { class: 'type-head building-type-head' },
      h('input', {
        type: 'text',
        value: t.name,
        'data-key': key('name'),
        onchange: (e) => e.target.value.trim() && set('name', e.target.value.trim()),
      }),
      categorySelect,
      h('button', { class: 'btn small danger', title: 'Delete type', onclick: () => deleteType(world, t, used) }, 'x'),
    ),
    details,
  );
}

function deleteType(world, type, used) {
  const warning = used ? `\n\n${used} building(s) use it. They keep everything and show the type as deleted.` : '';
  if (!confirm(`Delete building type "${type.name}"?${warning}\n\nYou can undo this with Ctrl+Z.`)) return;
  dispatch(removeRecord(world, TYPES, type.id));
}

export function renderCategories(world) {
  const categories = Object.values(world.definitions.buildingCategories);
  const rows = categories.map((c) =>
    h(
      'div',
      { class: 'type-head' },
      h('input', {
        type: 'color',
        value: c.color,
        title: 'Placeholder color',
        onchange: (e) => dispatch(setField(world, CATEGORIES, c.id, 'color', e.target.value, c.name)),
      }),
      h('input', {
        type: 'text',
        value: c.name,
        'data-key': `${c.id}.name`,
        onchange: (e) => e.target.value.trim() && dispatch(setField(world, CATEGORIES, c.id, 'name', e.target.value.trim(), c.name)),
      }),
      h('button', { class: 'btn small danger', title: 'Delete category', onclick: () => deleteCategory(world, c) }, 'x'),
    ),
  );
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Building Categories'),
    h('p', { class: 'muted small' }, 'The color is used for the placeholder block of every building whose type has that category.'),
    h('div', { class: 'tile-list' }, rows.length ? rows : h('p', { class: 'muted small' }, 'No categories.')),
    h(
      'button',
      { class: 'btn small', onclick: () => dispatch(addRecord(CATEGORIES, { id: newId('buildingCategory'), name: 'New Category', color: '#888888' })) },
      '+ Add category',
    ),
  );
}

function deleteCategory(world, category) {
  const used = Object.values(world.definitions.buildingTypes).filter((t) => t.categoryId === category.id).length;
  const warning = used ? `\n\n${used} building type(s) use it and will show grey until given another.` : '';
  if (!confirm(`Delete category "${category.name}"?${warning}\n\nYou can undo this with Ctrl+Z.`)) return;
  dispatch(removeRecord(world, CATEGORIES, category.id));
}
