// Where characters show up outside their own tab: a "Characters here" list
// in the Biome and Area panels, and a count badge on each Area on the
// Biome Map. Location is the character's locationContainerId.
import { h } from '../../ui/dom.js';
import { navigate } from '../../ui/navigation.js';
import { registerInfoSection } from '../../ui/infoSections.js';
import { registerMapBadge } from '../../map/objectKinds.js';
import { charactersAt } from './characterModel.js';
import { selectCharacter } from './state.js';

function characterList(world, characters, hostId) {
  if (!characters.length) return h('p', { class: 'muted small' }, 'Nobody is located here.');
  return h(
    'div',
    { class: 'chip-list' },
    characters.map((c) =>
      h(
        'button',
        {
          class: 'chip chip-button',
          title: 'Open in the Characters tab',
          style: `border-color:${world.definitions.factions?.[c.factionId]?.color ?? ''}`,
          onclick: () => {
            selectCharacter(c.id);
            navigate({ main: 'people', sub: 'roster', subsub: 'living' });
          },
        },
        c.name,
        hostId && c.locationContainerId !== hostId ? h('span', { class: 'muted' }, ` (${world.containers[c.locationContainerId]?.name})`) : null,
      ),
    ),
  );
}

export function registerCharacterLocations() {
  // A Biome lists everyone in it, including those in its Areas.
  registerInfoSection('biome', (world, biome) => {
    const here = charactersAt(world, biome.id, { nested: true });
    return [h('label', {}, `Characters here (${here.length})`), characterList(world, here, biome.id)];
  });
  registerInfoSection('area', (world, area) => {
    const here = charactersAt(world, area.id);
    return [h('label', {}, `Characters located here (${here.length})`), characterList(world, here, null)];
  });
  // The number of living characters in each Area, on the Biome Map.
  registerMapBadge((world, obj) => {
    const area = world.containers[obj.refId];
    if (area?.kind !== 'area') return null;
    const n = charactersAt(world, area.id).length;
    return n ? { text: String(n), title: `${n} character(s)` } : null;
  });
}
