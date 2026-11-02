// Info panel for a Region: name, type, description, species that live there,
// civilizations or cities, notes, and the Region Map scale. Regions have no
// Danger Level of their own: danger belongs to each Biome inside them.
import { h } from './dom.js';
import { dispatch } from '../data/store.js';
import { newId } from '../data/ids.js';
import { setField, addRecord, batch } from '../commands/recordCommands.js';
import { chipList } from './fields.js';
import { nameAndType, discoveryFields, descriptionField, notesField, childList } from './containerFields.js';
import { enterContainer } from './navigation.js';

export function renderRegionInfo(world, region) {
  return [
    ...nameAndType(world, region),
    ...discoveryFields(world, region),
    ...descriptionField(world, region),
    ...speciesField(world, region),
    ...civilizationsField(world, region),
    h('label', {}, 'Biomes here'),
    childList(world, region, (id) => enterContainer(world, id)),
    ...notesField(world, region),
    ...mapScaleField(world, region),
  ];
}

// How many Region Map cells one World Map cell becomes (see map/regionFrame.js).
// A map setting, not a game rule. Shrinking it can leave Biomes outside the
// Region's edge; they stay where they are and can be moved back in.
function mapScaleField(world, region) {
  const input = h('input', {
    type: 'number',
    min: 1,
    max: 100,
    step: 1,
    value: region.mapScale,
    'data-key': `${region.id}.mapScale`,
    onchange: (e) => {
      const n = Number(e.target.value);
      if (Number.isInteger(n) && n >= 1 && n <= 100 && n !== region.mapScale) {
        dispatch(setField(world, 'containers', region.id, 'mapScale', n, region.name));
      } else {
        e.target.value = region.mapScale;
      }
    },
  });
  return [h('label', {}, 'Region Map scale (cells per World Map cell)'), input];
}

// Species are shared definitions (definitions.species), so the same species
// can live in many Regions and, from Stage 4, be a follower's species.
// Typing a new name creates the species.
function speciesField(world, region) {
  const all = world.definitions.species;
  const setIds = (ids) => setField(world, 'containers', region.id, 'speciesIds', ids, region.name);

  const add = (name) => {
    const existing = Object.values(all).find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!region.speciesIds.includes(existing.id)) dispatch(setIds([...region.speciesIds, existing.id]));
      return;
    }
    const species = { id: newId('species'), name, baseAttributes: {}, notes: '', customFields: {} };
    dispatch(
      batch(`Added species "${name}" to "${region.name}"`, [
        addRecord('definitions.species', species),
        setIds([...region.speciesIds, species.id]),
      ]),
    );
  };

  return chipList(
    'Species that live here',
    region.speciesIds.map((id) => ({
      label: all[id]?.name ?? '(deleted species)',
      onRemove: () => dispatch(setIds(region.speciesIds.filter((x) => x !== id))),
    })),
    { onAdd: add, suggestions: Object.values(all).map((s) => s.name), placeholder: 'Species name', key: `${region.id}.species` },
  );
}

function civilizationsField(world, region) {
  const list = region.civilizations;
  const setList = (names) => dispatch(setField(world, 'containers', region.id, 'civilizations', names, region.name));
  return chipList(
    'Civilizations or cities',
    list.map((name, i) => ({ label: name, onRemove: () => setList(list.filter((_, j) => j !== i)) })),
    {
      onAdd: (name) => !list.includes(name) && setList([...list, name]),
      placeholder: 'Name',
      key: `${region.id}.civilizations`,
    },
  );
}
