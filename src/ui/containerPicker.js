// Shown on the Region Map or Biome Map tab when no Region / Biome is
// open yet: a list of them to choose from.
import { h } from './dom.js';
import { enterContainer } from './navigation.js';

// kind: 'region' | 'biome'
export function renderContainerPicker(world, kind, { title, emptyText }) {
  const all = Object.values(world.containers).filter((c) => c.kind === kind);
  const parentName = (c) => world.containers[c.parentId]?.name ?? '';

  return h(
    'div',
    { class: 'tab-page' },
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, title),
      all.length === 0
        ? h('p', { class: 'muted' }, emptyText)
        : h(
            'ul',
            { class: 'child-list' },
            all.map((c) =>
              h(
                'li',
                {},
                h('span', {}, c.name),
                h('span', { class: 'muted small' }, kind === 'biome' ? `in ${parentName(c)}` : ''),
                h('button', { class: 'btn small', onclick: () => enterContainer(world, c.id) }, 'Open'),
              ),
            ),
          ),
    ),
  );
}
