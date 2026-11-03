// World > Region > Biome trail above each map. Each step opens its map tab.
import { h } from './dom.js';
import { getNavigation, navigate } from './navigation.js';
import { placeName } from './playerView.js';

const LEVELS = ['world', 'region', 'biome'];

export function renderBreadcrumb(world) {
  const nav = getNavigation(world);
  const depth = LEVELS.indexOf(nav.tab);
  const steps = [
    { tab: 'world', name: world.containers[world.meta.rootContainerId].name },
    { tab: 'region', name: placeName(world, world.containers[nav.regionId]) || null },
    { tab: 'biome', name: placeName(world, world.containers[nav.biomeId]) || null },
  ].slice(0, depth + 1);

  const parts = [];
  steps.forEach((step, i) => {
    if (i > 0) parts.push(h('span', { class: 'crumb-sep' }, '>'));
    const current = i === depth;
    parts.push(
      h(
        'button',
        {
          class: current ? 'crumb current' : 'crumb',
          disabled: current,
          title: current ? '' : 'Go back up to this map',
          onclick: () => navigate({ tab: step.tab }),
        },
        step.name ?? '(none chosen)',
      ),
    );
  });
  return h('nav', { class: 'breadcrumb small' }, parts);
}
