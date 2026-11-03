// The strip above the map: tool buttons, the tile or object picker for the
// current tool, and zoom controls.
import { h } from '../ui/dom.js';
import { TOOLS } from './tools.js';
import { placementTypeId, typeChoices } from './placement.js';

// Player View is read-only: only Select and Pan.
export const READ_ONLY_TOOLS = ['select', 'pan'];

export function renderToolbar(view) {
  const { state } = view;
  const tools = h(
    'div',
    { class: 'tool-group' },
    TOOLS.filter((t) => !view.readOnly || READ_ONLY_TOOLS.includes(t.id)).map((t) =>
      h(
        'button',
        {
          class: t.id === state.tool ? 'btn small tool active' : 'btn small tool',
          title: `${t.hint} (${t.key.toUpperCase()})`,
          onclick: () => view.setTool(t.id),
        },
        t.label,
        h('span', { class: 'key-hint' }, t.key.toUpperCase()),
      ),
    ),
  );

  return [tools, picker(view), h('div', { class: 'spacer' }), zoomControls(view)];
}

// Tile swatches for Paint, object types for Place, nothing for other tools.
function picker(view) {
  const { state, world } = view;
  if (state.tool === 'paint') {
    const types = Object.values(world.definitions.tileTypes);
    if (types.length === 0) return h('span', { class: 'muted small' }, 'No tile types. Add one in the panel.');
    return h(
      'div',
      { class: 'tool-group' },
      types.map((t) =>
        h('button', {
          class: t.id === state.tileTypeId ? 'swatch active' : 'swatch',
          title: t.name,
          style: `background:${t.color}`,
          onclick: () => {
            state.tileTypeId = t.id;
            view.refreshUi();
          },
        }),
      ),
    );
  }
  if (state.tool === 'place') {
    return h(
      'div',
      { class: 'tool-group' },
      view.placeables.map((p) =>
        h(
          'button',
          {
            class: p.id === state.placeableId ? 'btn small active' : 'btn small',
            title: `${p.label} (${p.w}x${p.h})`,
            onclick: () => {
              state.placeableId = p.id;
              view.refreshUi();
            },
          },
          h('span', { class: 'swatch-dot', style: `background:${p.color}` }),
          p.label,
        ),
      ),
      typePicker(view),
    );
  }
  return null;
}

// Type dropdown for a placeable that has types (Region, Biome, Area, Building).
function typePicker(view) {
  const { state, world } = view;
  const p = view.placeables.find((x) => x.id === state.placeableId);
  const choices = typeChoices(world, p);
  if (!choices || p.fixedTypeId) return null;
  const types = Object.values(choices);
  const where = p.kind === 'building' ? 'the Buildings tab' : 'the side panel when nothing is selected';
  const select = h(
    'select',
    {
      title: `Type for the new one (edit types in ${where})`,
      onchange: (e) => {
        state.placeTypeIds[p.id] = e.target.value;
        view.refreshUi();
      },
    },
    h('option', { value: '' }, '(no type)'),
    types.map((t) => h('option', { value: t.id }, t.name)),
  );
  select.value = placementTypeId(world, state, p);
  return select;
}

function zoomControls(view) {
  return h(
    'div',
    { class: 'tool-group' },
    h('button', { class: 'btn small', title: 'Zoom out (mouse wheel)', onclick: () => view.zoomBy(-1) }, '-'),
    h('span', { class: 'small muted zoom-label' }, `${view.camera?.zoom ?? ''}px`),
    h('button', { class: 'btn small', title: 'Zoom in (mouse wheel)', onclick: () => view.zoomBy(1) }, '+'),
    h('button', { class: 'btn small', title: 'Center the view on cell 0, 0', onclick: () => view.centerOnOrigin() }, 'Center'),
  );
}
