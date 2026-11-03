// The selected Crown (a relic) in the side panel: name, description, the
// attuned Crown Bearer, where it is now, notes.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { removeRecord } from '../../commands/recordCommands.js';
import { textField, selectField, fieldSetter } from '../../ui/fields.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import { crownLocationText } from './crownModel.js';
import { askCrownLocation } from './crownDialogs.js';

export function renderCrownPanel(world, crown) {
  const set = (field) => fieldSetter(world, 'crowns', crown.id, field);
  const key = (part) => `${crown.id}.${part}`;
  return [
    h('h2', {}, 'Crown'),
    ...textField('Name', crown.name, (v) => v.trim() && set('name')(v.trim()), { key: key('name') }),
    ...textField('Description', crown.description, set('description'), { key: key('description'), multiline: true }),
    ...selectField('Attuned Crown Bearer', crown.attunedBearerId, [{ value: '', label: '(none)' }, ...Object.values(world.crownBearers ?? {}).map((b) => ({ value: b.id, label: b.name }))], set('attunedBearerId'), {
      key: key('attuned'),
      missingLabel: () => '(removed Crown Bearer)',
    }),
    h('label', {}, 'Where it is'),
    h('div', { class: 'row' }, h('span', {}, crownLocationText(world, crown)), h('button', { class: 'btn small arbiter-only', onclick: () => askCrownLocation(world, crown) }, 'Change...')),
    ...textField('Notes', crown.notes, set('notes'), { key: key('notes'), multiline: true }),
    renderCustomFields(world, 'crowns', crown.id),
    h('div', { class: 'row actions arbiter-only' }, h('button', { class: 'btn small danger', onclick: () => confirm(`Delete the ${crown.name}? Ctrl+Z undoes it.`) && dispatch(removeRecord(world, 'crowns', crown.id)) }, 'Delete Crown')),
  ];
}
