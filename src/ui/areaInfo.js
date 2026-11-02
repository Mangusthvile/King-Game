// Info panel for an Area (a mine, a farm, a building site...): name, area
// type (its focus), description, Danger Level, resources with Availability,
// assigned followers, notes. Custom fields are added by the map panel.
import { h } from './dom.js';
import { dispatch } from '../data/store.js';
import { setField } from '../commands/recordCommands.js';
import { nameAndType, descriptionField, dangerField, notesField } from './containerFields.js';
import { resourcesEditor } from './resourcesEditor.js';

export function renderAreaInfo(world, area) {
  // An Area with no Danger Level of its own uses its Biome's.
  const biome = world.containers[area.parentId];
  const inherited = `(same as Biome: ${biome?.dangerLevel || 'not set'})`;
  return [
    ...nameAndType(world, area, 'Area type (focus)'),
    ...descriptionField(world, area),
    ...dangerField(world, area, 'Environmental Danger Level', inherited),
    h('label', {}, 'Resources'),
    resourcesEditor(world, area),
    h('label', {}, 'Assigned followers'),
    followersEditor(world, area),
    ...notesField(world, area),
  ];
}

// Followers come in Stage 4; until then the list is simply empty.
function followersEditor(world, area) {
  const followers = world.followers;
  const ids = area.assignedFollowerIds ?? [];
  const setIds = (next) => dispatch(setField(world, 'containers', area.id, 'assignedFollowerIds', next, area.name));

  const chips = ids.map((id) =>
    h(
      'span',
      { class: 'chip' },
      followers[id]?.name ?? '(removed follower)',
      h('button', { class: 'chip-x', title: 'Unassign', onclick: () => setIds(ids.filter((x) => x !== id)) }, 'x'),
    ),
  );
  const available = Object.values(followers).filter((f) => !ids.includes(f.id));
  if (Object.keys(followers).length === 0) {
    return h('div', {}, chips, h('p', { class: 'muted small' }, 'No followers yet (the roster comes in Stage 4).'));
  }

  const select = h(
    'select',
    { 'data-key': `${area.id}.assign` },
    h('option', { value: '' }, 'Choose a follower...'),
    available.map((f) => h('option', { value: f.id }, f.name)),
  );
  return h(
    'div',
    {},
    h('div', { class: 'chip-list' }, chips.length ? chips : h('span', { class: 'muted small' }, 'None assigned.')),
    h(
      'div',
      { class: 'row chip-add' },
      select,
      h('button', { class: 'btn small', onclick: () => select.value && setIds([...ids, select.value]) }, 'Assign'),
    ),
  );
}
