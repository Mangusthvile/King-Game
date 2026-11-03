// The selected Crown Bearer in the side panel: vessel portrait and link,
// status, Authority Level, each player's Connectivity with that level's
// RULES.md text as a reminder, today's Spark of Change notes, Change vessel,
// the vessel history, divergence notes. Every field is editable.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, removeRecord } from '../../commands/recordCommands.js';
import { navigate } from '../../ui/navigation.js';
import { textField, selectField, fieldSetter } from '../../ui/fields.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import { portrait } from '../../ui/taskCard.js';
import { swatchStyle } from '../../ui/colors.js';
import { BEARER_STATUSES } from '../../data/crownBearers.js';
import { factionOptions, factionColor } from '../../data/factions.js';
import { connectivityLevel } from '../../rules/connectivity.js';
import { selectCharacter } from '../characters/state.js';
import { connectionsOf, crownLocationText } from './crownModel.js';
import { askChangeVessel, askConnectivity } from './crownDialogs.js';

function vesselBox(world, b) {
  const vessel = world.characters[b.vesselId];
  return h(
    'div',
    { class: 'vessel-box' },
    portrait(vessel?.name ?? '?', factionColor(world, vessel?.factionId ?? b.factionId), 'large'),
    h(
      'div',
      { class: 'member-lines' },
      vessel
        ? h('button', { class: 'link-button', title: "Open the vessel's stat sheet", onclick: () => (selectCharacter(vessel.id), navigate({ tab: 'characters' })) }, `Vessel: ${vessel.name}`)
        : h('span', { class: 'flag-text' }, 'No vessel'),
      h('span', { class: b.status === 'withoutVessel' ? 'flag-text small' : 'ok-text small' }, BEARER_STATUSES.find((s) => s.id === b.status)?.name ?? b.status),
      h('button', { class: 'btn small arbiter-only', onclick: () => askChangeVessel(world, b) }, 'Change vessel...'),
    ),
  );
}

// Connectivity: one block per player linked to this Crown Bearer.
function connectivityBlocks(world, b) {
  const links = connectionsOf(world, b.id);
  if (!links.length) return h('p', { class: 'muted small' }, 'No player is connected yet (Players view).');
  return links.map(({ player, connection, index }) => {
    const text = connectivityLevel(world, connection.connectivity);
    return h(
      'div',
      { class: 'connectivity-box' },
      h('div', { class: 'row' }, h('strong', {}, `Connectivity ${connection.connectivity ?? '-'}`), h('span', { class: 'muted small' }, `with ${player.name}`), h('div', { class: 'spacer' }), h('button', { class: 'btn tiny arbiter-only', onclick: () => askConnectivity(world, player, index) }, 'Change...')),
      h('p', { class: 'small connectivity-text', title: 'Reminder from RULES.md (not enforced)' }, text?.description ?? 'No text for this level.'),
      text?.notes ? h('p', { class: 'muted small' }, text.notes) : null,
    );
  });
}

function sparkNotes(world, b) {
  const day = world.meta.currentDay;
  const notes = b.sparkNotes ?? {};
  const set = (value) => dispatch(setField(world, 'crownBearers', b.id, 'sparkNotes', { ...notes, [day]: value }, b.name));
  const earlier = Object.entries(notes)
    .filter(([d, text]) => Number(d) !== day && text)
    .sort((a, b2) => Number(b2[0]) - Number(a[0]));
  return [
    ...textField(`Spark of Change notes, Day ${day}`, notes[day] ?? '', set, { key: `${b.id}.spark.${day}`, multiline: true }),
    earlier.length ? h('details', {}, h('summary', { class: 'small' }, `Earlier days (${earlier.length})`), earlier.map(([d, text]) => h('p', { class: 'small' }, h('strong', {}, `Day ${d}: `), text))) : null,
  ];
}

// The vessel history: every line editable (the Arbiter has the last word).
function vesselHistory(world, b) {
  const list = b.vesselHistory ?? [];
  const setList = (next) => dispatch(setField(world, 'crownBearers', b.id, 'vesselHistory', next, b.name));
  const update = (i, changes) => setList(list.map((line, j) => (j === i ? { ...line, ...changes } : line)));
  const num = (v) => (v === '' ? null : Number(v));
  const rows = list.map((line, i) =>
    h(
      'div',
      { class: 'vessel-line' },
      h('span', { class: 'small' }, world.characters[line.characterId]?.name ?? line.name ?? '(removed)'),
      h('input', { type: 'number', class: 'tiny-input', title: 'From day', value: line.fromDay ?? '', onchange: (e) => update(i, { fromDay: num(e.target.value) }) }),
      h('input', { type: 'number', class: 'tiny-input', title: 'To day (blank = still the vessel)', value: line.toDay ?? '', onchange: (e) => update(i, { toDay: num(e.target.value) }) }),
      h('input', { type: 'text', value: line.ended ?? '', placeholder: 'How it ended', onchange: (e) => update(i, { ended: e.target.value }) }),
      h('button', { class: 'btn tiny danger', title: 'Remove line', onclick: () => setList(list.filter((_, j) => j !== i)) }, 'x'),
    ),
  );
  return rows.length ? [h('div', { class: 'vessel-line muted small' }, h('span', {}, 'Vessel'), h('span', {}, 'From'), h('span', {}, 'To'), h('span', {}, 'How it ended'), h('span', {})), rows] : h('p', { class: 'muted small' }, 'No vessel yet.');
}

export function renderBearerPanel(world, b) {
  const set = (field) => fieldSetter(world, 'crownBearers', b.id, field);
  const key = (part) => `${b.id}.${part}`;
  const crown = world.crowns?.[b.crownId];
  const authority = h('input', { type: 'number', class: 'short-input', step: 1, value: b.authorityLevel ?? '', placeholder: 'not set', 'data-key': key('authority') });
  authority.addEventListener('change', () => set('authorityLevel')(authority.value === '' ? null : Math.round(Number(authority.value))));
  return [
    h('h2', {}, 'Crown Bearer', b.factionId ? h('span', { class: 'team-chip', style: swatchStyle(factionColor(world, b.factionId)) }, world.definitions.factions[b.factionId]?.name) : null),
    vesselBox(world, b),
    h('div', { class: 'row' }, h('span', { class: 'small' }, 'Authority Level'), authority),
    h('h3', {}, 'Connectivity (reminder only)'),
    connectivityBlocks(world, b),
    h('h3', {}, 'Spark of Change'),
    ...sparkNotes(world, b),
    h('h3', {}, 'Identity'),
    ...textField('Name', b.name, (v) => v.trim() && set('name')(v.trim()), { key: key('name') }),
    ...textField('Title', b.title, set('title'), { key: key('title'), placeholder: 'e.g. First Sky King' }),
    ...textField('Pronouns', b.pronouns, set('pronouns'), { key: key('pronouns'), placeholder: 'e.g. he/him' }),
    ...textField('Personality and values', b.personalityNotes, set('personalityNotes'), { key: key('personality'), multiline: true }),
    ...selectField('Faction ruled', b.factionId, [{ value: '', label: '(none)' }, ...factionOptions(world)], set('factionId'), { key: key('faction'), missingLabel: () => '(deleted faction)' }),
    ...selectField('Status', b.status, BEARER_STATUSES.map((s) => ({ value: s.id, label: s.name })), set('status'), { key: key('status') }),
    ...selectField('Crown', b.crownId, [{ value: '', label: '(none)' }, ...Object.values(world.crowns ?? {}).map((c) => ({ value: c.id, label: c.name }))], set('crownId'), { key: key('crown'), missingLabel: () => '(removed Crown)' }),
    crown ? h('p', { class: 'muted small' }, `${crown.name}: ${crownLocationText(world, crown)}`) : null,
    h('h3', {}, 'Vessel history'),
    vesselHistory(world, b),
    ...textField('Divergence notes', b.divergenceNotes, set('divergenceNotes'), { key: key('divergence'), multiline: true, placeholder: 'Where the Crown Bearer went their own way' }),
    ...textField('Notes', b.notes, set('notes'), { key: key('notes'), multiline: true }),
    renderCustomFields(world, 'crownBearers', b.id),
    h('div', { class: 'row actions arbiter-only' }, h('button', { class: 'btn small danger', onclick: () => confirm(`Delete the Crown Bearer ${b.name}? Ctrl+Z undoes it.`) && dispatch(removeRecord(world, 'crownBearers', b.id)) }, 'Delete Crown Bearer')),
  ];
}
