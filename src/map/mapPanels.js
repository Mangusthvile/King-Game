// The right-hand detail panel for a map. Shows, in order of priority:
//   the selected object's properties, the tile type editor (Paint/Erase),
//   or a short help card.
import { h } from '../ui/dom.js';
import { dispatch } from '../data/store.js';
import { newId } from '../data/ids.js';
import { setField, addRecord, removeRecord } from '../commands/recordCommands.js';
import { renderCustomFields } from '../ui/customFieldsEditor.js';
import { isSpaceFree } from './grid.js';
import { isEnterable } from '../ui/navigation.js';
import { moveObject } from './mapCommands.js';
import { objectName, recordFor, withFootprint } from './placement.js';
import { objectKind } from './objectKinds.js';
import { kindName } from './containerTree.js';
import { spriteKeys, spriteExists } from './sprites.js';

// Remembered between redraws: is "Map placement" / "Controls" expanded?
let placementOpen = false;
let controlsOpen = false;

export function renderMapDetail(view) {
  const obj = view.world.placedObjects[view.state.selectedId];
  if (obj) return objectPanel(view, obj);
  if (view.state.tool === 'paint' || view.state.tool === 'erase') return tileTypesPanel(view);
  return helpPanel(view);
}

// ---- Selected object ----

function objectPanel(view, obj) {
  const { world } = view;
  const rec = recordFor(world, obj);
  const name = objectName(world, obj);
  // A Region, Biome or Area: its info panel comes from the map's system.
  // A registered kind (a building) brings its own panel.
  const container = obj.refId && world.containers[obj.refId];
  const kind = objectKind(obj.kind);
  const containerInfo = container && view.infoPanels[container.kind];
  const info = containerInfo ? () => containerInfo(world, container) : kind?.infoPanel ? () => kind.infoPanel(world, obj, view) : null;
  const title = containerInfo ? kindName(container.kind) : kind?.title;
  const message = h('p', { class: 'message error small' });

  const wholeNumber = (value, min) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= min ? n : null;
  };

  const setPosition = (x, y) => {
    if (x === null || y === null) return (message.textContent = 'Position must be whole numbers.');
    if (!view.inBounds(x, y, obj.w, obj.h)) return (message.textContent = 'That is outside the edge of the map.');
    if (!isSpaceFree(view.layerOf(obj), x, y, obj.w, obj.h, obj.id)) return (message.textContent = 'Another object is in the way.');
    dispatch(withFootprint(world, obj, { x, y }, moveObject(world, obj.id, x, y, name)));
  };
  const setSize = (field, value) => {
    const n = wholeNumber(value, 1);
    if (n === null) return (message.textContent = 'Size must be a whole number of at least 1.');
    const w = field === 'w' ? n : obj.w;
    const hgt = field === 'h' ? n : obj.h;
    if (!view.inBounds(obj.x, obj.y, w, hgt)) return (message.textContent = 'That would go past the edge of the map.');
    if (!isSpaceFree(view.layerOf(obj), obj.x, obj.y, w, hgt, obj.id)) return (message.textContent = 'Not enough room to grow there.');
    dispatch(withFootprint(world, obj, { [field]: n }, setField(world, 'placedObjects', obj.id, field, n, name)));
  };

  const numberInput = (value, onchange) => h('input', { type: 'number', step: 1, value, onchange: (e) => onchange(e.target.value) });

  const placement = [
    h(
      'div',
      { class: 'field-grid' },
      h('label', {}, 'X'),
      numberInput(obj.x, (v) => setPosition(wholeNumber(v, -Infinity), obj.y)),
      h('label', {}, 'Y'),
      numberInput(obj.y, (v) => setPosition(obj.x, wholeNumber(v, -Infinity))),
      h('label', {}, 'Width'),
      numberInput(obj.w, (v) => setSize('w', v)),
      h('label', {}, 'Height'),
      numberInput(obj.h, (v) => setSize('h', v)),
      h('label', {}, 'Color'),
      h('input', {
        type: 'color',
        value: obj.color || '#888888',
        onchange: (e) => dispatch(setField(world, 'placedObjects', obj.id, 'color', e.target.value, name)),
      }),
      h('label', {}, 'Sprite'),
      spritePicker(obj, (key) => dispatch(setField(world, 'placedObjects', obj.id, 'spriteKey', key, name))),
    ),
    obj.spriteKey && !spriteExists(obj.spriteKey)
      ? h('p', { class: 'message error small' }, `No file src/assets/sprites/${obj.spriteKey}.png, so a plain shape is shown.`)
      : null,
    message,
  ];

  const actions = h(
    'div',
    { class: 'row actions' },
    container && isEnterable(container.kind)
      ? h('button', { class: 'btn small primary', title: 'Or double-click it, or press Enter', onclick: () => view.enterSelected() }, `Enter ${kindName(container.kind)}`)
      : null,
    obj.w !== obj.h ? h('button', { class: 'btn small', title: 'Quarter turn (R)', onclick: () => view.rotateSelected() }, 'Rotate') : null,
    h('button', { class: 'btn small', title: 'Ctrl+D', onclick: () => view.duplicateSelected() }, 'Duplicate'),
    h('button', { class: 'btn small danger', title: 'Delete key', onclick: () => view.removeSelected() }, 'Remove'),
  );

  if (info) {
    const details = h(
      'details',
      { class: 'placement', open: placementOpen },
      h('summary', { class: 'small muted' }, 'Map placement (position, size, color, sprite)'),
      placement,
    );
    details.addEventListener('toggle', () => (placementOpen = details.open));
    return [
      h('h2', {}, title),
      actions,
      ...info(),
      details,
      renderCustomFields(world, rec.path, rec.id),
    ];
  }

  return [
    h('h2', {}, 'Details'),
    h('span', { class: 'label-tag kind-tag' }, obj.kind),
    h('label', {}, 'Name'),
    h('input', {
      type: 'text',
      value: name,
      class: 'wide',
      onchange: (e) => {
        const value = e.target.value.trim();
        if (value) dispatch(setField(world, rec.path, rec.id, rec.nameField, value, name));
      },
    }),
    ...placement,
    actions,
    renderCustomFields(world, rec.path, rec.id),
  ];
}

// Dropdown of the PNGs in src/assets/sprites. A key whose file is missing
// (for example from an imported world) is kept and listed as "missing".
function spritePicker(obj, onKey) {
  const keys = spriteKeys();
  const options = [h('option', { value: '' }, keys.length ? '(none)' : '(no sprites in src/assets/sprites)')];
  if (obj.spriteKey && !keys.includes(obj.spriteKey)) {
    options.push(h('option', { value: obj.spriteKey }, `${obj.spriteKey} (missing)`));
  }
  for (const key of keys) options.push(h('option', { value: key }, key));
  const select = h('select', { onchange: (e) => onKey(e.target.value) }, options);
  select.value = obj.spriteKey;
  return select;
}

// ---- Tile types (definitions, editable in the app) ----

function tileTypesPanel(view) {
  const { world, state } = view;
  const types = world.definitions.tileTypes;
  const path = 'definitions.tileTypes';

  const rows = Object.values(types).map((t) =>
    h(
      'div',
      { class: t.id === state.tileTypeId ? 'tile-row active' : 'tile-row' },
      h('button', {
        class: 'swatch',
        style: `background:${t.color}`,
        title: 'Use this tile',
        onclick: () => {
          state.tileTypeId = t.id;
          if (state.tool !== 'paint') view.setTool('paint');
          else view.refreshUi();
        },
      }),
      h('input', {
        type: 'text',
        value: t.name,
        onchange: (e) => e.target.value.trim() && dispatch(setField(world, path, t.id, 'name', e.target.value.trim(), t.name)),
      }),
      h('input', {
        type: 'color',
        value: t.color,
        onchange: (e) => dispatch(setField(world, path, t.id, 'color', e.target.value, t.name)),
      }),
      h('button', { class: 'btn small danger', title: 'Delete tile type', onclick: () => deleteTileType(world, t) }, 'x'),
    ),
  );

  return [
    h('h2', {}, 'Tile Types'),
    h('p', { class: 'muted small' }, 'Click a swatch to paint with it. Names and colors are editable.'),
    h('div', { class: 'tile-list' }, rows),
    h(
      'button',
      {
        class: 'btn small',
        onclick: () => {
          const tile = { id: newId('tile'), name: 'New Tile', color: '#777777', spriteKey: '' };
          state.tileTypeId = tile.id;
          dispatch(addRecord(path, tile));
        },
      },
      '+ Add tile type',
    ),
  ];
}

function deleteTileType(world, tile) {
  // Count painted cells using it, across every map, so the Arbiter knows.
  let used = 0;
  for (const c of Object.values(world.containers)) {
    for (const id of Object.values(c.tiles)) if (id === tile.id) used++;
  }
  const warning = used ? `\n\n${used} painted cell(s) use it and will show as magenta until repainted.` : '';
  if (!confirm(`Delete tile type "${tile.name}"?${warning}\n\nYou can undo this with Ctrl+Z.`)) return;
  dispatch(removeRecord(world, 'definitions.tileTypes', tile.id));
}

// ---- Help ----

function helpPanel(view) {
  const c = view.container;
  const line = (keys, text) => h('li', {}, h('span', { class: 'key-hint' }, keys), ' ', text);
  const controls = h(
    'ul',
    { class: 'help-list small' },
    line('WASD / arrows', 'pan'),
    line('Right or middle drag', 'pan'),
    line('Wheel', 'zoom at cursor'),
    line('V H B E P X', 'tools'),
    line('Delete', 'remove selected'),
    line('R', 'rotate selected (not square)'),
    line('Ctrl+D', 'duplicate selected'),
    line('Esc', 'cancel / deselect'),
    line('Double-click / Enter', 'open a Region or Biome'),
    line('Ctrl+Z / Ctrl+Y', 'undo / redo'),
  );

  // The map's system can show its own panel (for example the Region's info
  // and the type editor); the controls then fold away below it.
  if (view.idlePanel) {
    const details = h('details', { class: 'controls-help', open: controlsOpen }, h('summary', { class: 'small muted' }, 'Controls'), controls);
    details.addEventListener('toggle', () => (controlsOpen = details.open));
    return [...view.idlePanel(view), details];
  }
  return [
    h('h2', {}, c.name),
    h(
      'p',
      { class: 'muted small' },
      `${c.placedObjectIds.length} object(s), ${Object.keys(c.tiles).length} painted cell(s).`,
    ),
    h('h3', {}, 'Controls'),
    controls,
  ];
}
