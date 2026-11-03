// The character stat sheet in the right-hand panel. Every field is
// editable and every edit is a command, so it can be undone.
import { canSeeFaction, pvActive } from '../../ui/playerView.js';
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, removeRecord, batch } from '../../commands/recordCommands.js';
import { createCommand } from '../../commands/registry.js';
import { textField, selectField, fieldSetter } from '../../ui/fields.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import { infoSections } from '../../ui/infoSections.js';
import { swatchStyle } from '../../ui/colors.js';
import { locationOptions } from './characterModel.js';
import { refOptions } from './libraryEditor.js';
import { renderBodySection } from './bodySection.js';
import { renderAbilities } from './abilitiesSection.js';
import { renderGear } from './gearSection.js';
import { deathForm, deathDetails } from './death.js';
import { staminaInput, staminaNote } from './staminaSection.js';
import { renderFactionSection } from './factionSection.js';
import { charactersView as view } from './state.js';

// refresh(): redraws the panel after a view-only change (opening a helper).
export function renderCharacterPanel(world, c, refresh) {
  // Player View: another faction's character is not shown.
  if (!canSeeFaction(world, c.factionId)) return [h('h2', {}, 'Character'), h('p', { class: 'muted small' }, 'This character belongs to another faction.')];
  const set = (field) => fieldSetter(world, 'characters', c.id, field);
  const key = (part) => `${c.id}.${part}`;
  const faction = world.definitions.factions?.[c.factionId];
  const closeHelper = () => ((view.helper = null), refresh());

  return [
    h('h2', {}, c.alive ? 'Character' : 'Character (dead)', faction ? h('span', { class: 'team-chip', style: swatchStyle(faction.color) }, faction.name) : null),
    ...textField('Name', c.name, (v) => v.trim() && set('name')(v.trim()), { key: key('name') }),
    ...renderFactionSection(world, c),
    ...selectField('Species', c.speciesId, [{ value: '', label: '(none)' }, ...refOptions(world, 'species')], (id) => id !== c.speciesId && dispatch(changeSpecies(world, c, id)), {
      key: key('species'),
      missingLabel: () => '(deleted species)',
    }),
    ...selectField('Location', c.locationContainerId, [{ value: '', label: '(not set)' }, ...locationOptions(world)], set('locationContainerId'), {
      key: key('location'),
      missingLabel: () => '(removed place)',
    }),
    ...textField('Current assignment', c.currentAssignment, set('currentAssignment'), { key: key('assignment'), placeholder: 'Free text' }),
    // Other systems add their sections here (the Projects system: the
    // Project this character is assigned to).
    ...infoSections(world, c, 'character'),
    ...renderBodySection(world, c, refresh),
    h('h3', {}, 'Stamina and Needs'),
    h(
      'div',
      { class: 'stat-grid' },
      staminaInput(world, c),
      pairInput(world, c, 'Hunger', 'hunger'),
      pairInput(world, c, 'Thirst', 'thirst'),
    ),
    staminaNote(world, c),
    ...renderAbilities(world, c, refresh),
    ...renderGear(world, c),
    ...textField('Bio', c.bio, set('bio'), { key: key('bio'), multiline: true }),
    ...textField('Notes', c.notes, set('notes'), { key: key('notes'), multiline: true }),
    renderCustomFields(world, 'characters', c.id),
    h('h3', { class: 'arbiter-only' }, 'Life'),
    pvActive(world) ? (c.alive ? null : deathDetails(world, c)) : c.alive
      ? view.helper?.kind === 'death'
        ? deathForm(world, c, closeHelper)
        : h('button', { class: 'btn small danger', onclick: () => ((view.helper = { kind: 'death' }), refresh()) }, 'Mark dead...')
      : deathDetails(world, c),
    h(
      'div',
      { class: 'row actions' },
      h(
        'button',
        {
          class: 'btn small danger',
          title: 'Deletes the record. To record a death, use Mark dead instead.',
          onclick: () => confirm(`Delete ${c.name} from the world? (Not the same as dying.) Ctrl+Z undoes it.`) && dispatch(removeRecord(world, 'characters', c.id)),
        },
        'Delete character',
      ),
    ),
  ];
}

// Changing species is one undo step: set it and add the species' default
// fields the character doesn't have yet (matched by name). Nothing is removed.
function changeSpecies(world, c, speciesId) {
  const species = world.definitions.species[speciesId];
  const names = new Set(Object.values(c.customFields).map((f) => f.name.toLowerCase()));
  const missing = Object.entries(species?.defaultFields ?? {}).filter(([id, f]) => !c.customFields[id] && !names.has(f.name.toLowerCase()));
  return batch(`Set species of ${c.name} to ${species?.name ?? 'none'}`, [
    setField(world, 'characters', c.id, 'speciesId', speciesId, c.name),
    ...missing.map(([fieldId, field]) => createCommand('addCustomField', { path: 'characters', id: c.id, fieldId, field: structuredClone(field) })),
  ]);
}

// { current, max } as two number boxes (empty = not set).
function pairInput(world, c, label, field) {
  const save = (part, value) => dispatch(setField(world, 'characters', c.id, field, { ...c[field], [part]: value }, c.name));
  const input = (part) =>
    h('input', {
      type: 'number',
      step: 'any',
      value: c[field]?.[part] ?? '',
      placeholder: 'not set',
      'data-key': `${c.id}.${field}.${part}`,
      onchange: (e) => {
        const n = Number(e.target.value);
        if (e.target.value === '') save(part, null);
        else if (Number.isFinite(n)) save(part, n);
      },
    });
  return h('div', { class: 'stat-pair', title: 'current / max' }, h('span', { class: 'stat-label' }, label), input('current'), h('span', { class: 'muted' }, '/'), input('max'));
}
