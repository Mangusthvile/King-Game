// Fields that Regions, Biomes and Areas share: name, type, description,
// Danger Level and notes. regionInfo.js, biomeInfo.js and areaInfo.js add the rest.
import { pvActive, placeName } from './playerView.js';
import { h } from './dom.js';
import { dispatch } from '../data/store.js';
import { setField } from '../commands/recordCommands.js';
import { textField, selectField, checkboxField, fieldSetter } from './fields.js';
import { typesFor, changeType } from '../map/containerTypes.js';
import dangerTable from '../rules/tables/dangerLevels.json';
import { factionOptions } from '../data/factions.js';

// typeLabel: what the type is called for this kind (an Area's type is its focus).
export function nameAndType(world, c, typeLabel = 'Type') {
  const types = Object.values(typesFor(world, c.kind));
  const setName = fieldSetter(world, 'containers', c.id, 'name');
  return [
    ...textField('Name', c.name, (v) => v.trim() && setName(v.trim()), { key: `${c.id}.name` }),
    ...selectField(
      typeLabel,
      c.typeId,
      [{ value: '', label: '(no type)' }, ...types.map((t) => ({ value: t.id, label: t.name }))],
      (typeId) => typeId !== c.typeId && dispatch(changeType(world, c, typeId)),
      { key: `${c.id}.typeId`, missingLabel: () => '(deleted type)' },
    ),
  ];
}

// The faction that claims it (optional). The map draws its border.
export function claimField(world, c) {
  return selectField('Claimed by', c.claimFactionId ?? '', [{ value: '', label: '(unclaimed)' }, ...factionOptions(world)], fieldSetter(world, 'containers', c.id, 'claimFactionId'), {
    key: `${c.id}.claim`,
    missingLabel: () => '(deleted faction)',
  });
}

// Discovered or not, and the name Resolution Logs use while it isn't.
export function discoveryFields(world, c) {
  if (pvActive(world)) return []; // the Arbiter's switch, not for players
  const setName = fieldSetter(world, 'containers', c.id, 'undiscoveredName');
  return [
    ...checkboxField('Discovered', c.discovered ?? true, fieldSetter(world, 'containers', c.id, 'discovered'), {
      key: `${c.id}.discovered`,
      title: 'Undiscovered places are shown in logs by their undiscovered name',
    }),
    ...textField('Undiscovered name', c.undiscoveredName ?? '', (v) => setName(v.trim()), { key: `${c.id}.undiscoveredName`, placeholder: '???' }),
  ];
}

export function descriptionField(world, c) {
  return textField('Description', c.description, fieldSetter(world, 'containers', c.id, 'description'), {
    key: `${c.id}.description`,
    multiline: true,
  });
}

// The levels come from the Environmental Damage Table in RULES.md.
// unsetLabel: what '' means for this record, e.g. an Area's "(same as Biome: High)".
export function dangerField(world, c, label, unsetLabel = '(not set)') {
  return selectField(
    label,
    c.dangerLevel,
    [{ value: '', label: unsetLabel }, ...dangerTable.levels.map((l) => ({ value: l, label: l }))],
    fieldSetter(world, 'containers', c.id, 'dangerLevel'),
    { key: `${c.id}.dangerLevel`, missingLabel: (v) => v }, // older free-text values stay as they were
  );
}

export function notesField(world, c) {
  return textField('Notes', c.notes, fieldSetter(world, 'containers', c.id, 'notes'), {
    key: `${c.id}.notes`,
    multiline: true,
  });
}

// How many child map cells one parent map cell becomes (see map/mapFrame.js),
// for Regions and Biomes. A map setting, not a game rule. Changing it can
// leave things outside the map's edge; they stay where they are and can be
// moved back in.
export function mapScaleField(world, c, label) {
  const input = h('input', {
    type: 'number',
    min: 1,
    max: 100,
    step: 1,
    value: c.mapScale,
    'data-key': `${c.id}.mapScale`,
    onchange: (e) => {
      const n = Number(e.target.value);
      if (Number.isInteger(n) && n >= 1 && n <= 100 && n !== c.mapScale) {
        dispatch(setField(world, 'containers', c.id, 'mapScale', n, c.name));
      } else {
        e.target.value = c.mapScale;
      }
    },
  });
  return [h('label', {}, label), input];
}

// A list of the Regions or Biomes placed on a container's map, each with
// an Open button. Used for "Biomes here" in the Region panel.
export function childList(world, c, onOpen) {
  const children = c.placedObjectIds
    .map((id) => world.containers[world.placedObjects[id]?.refId])
    .filter((child) => child && child.parentId === c.id);
  if (children.length === 0) return h('p', { class: 'muted small' }, 'None placed yet.');
  return h(
    'ul',
    { class: 'child-list' },
    children.map((child) =>
      h(
        'li',
        {},
        h('span', {}, placeName(world, child)),
        h('span', { class: 'muted small' }, typesFor(world, child.kind)[child.typeId]?.name ?? ''),
        h('button', { class: 'btn small', onclick: () => onOpen(child.id) }, 'Open'),
      ),
    ),
  );
}
