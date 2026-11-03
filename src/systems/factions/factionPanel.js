// The selected faction in the right-hand panel: every field editable, its
// stance toward every other faction, the end-of-day settings, Player
// fields, and delete (only when it owns nothing).
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, removeRecord } from '../../commands/recordCommands.js';
import { textField, selectField, checkboxField, fieldSetter } from '../../ui/fields.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import { swatchStyle } from '../../ui/colors.js';
import { placeOptions } from '../../data/places.js';
import { FACTION_TYPES, STANCES, factionList, factionIcon, stanceOf } from '../../data/factions.js';

const PATH = 'definitions.factions';

// What a faction owns, for the delete check.
export function ownedCounts(world, id) {
  const count = (list, test) => Object.values(list ?? {}).filter(test).length;
  return {
    characters: count(world.characters, (c) => c.factionId === id),
    stockpiles: count(world.stockpiles, (s) => s.ownerFactionId === id),
    buildings: count(world.buildings, (b) => b.ownerFactionId === id),
    projects: count(world.projects, (p) => p.ownerFactionId === id),
    tasks: count(world.tasks, (t) => t.ownerFactionId === id),
    claims: count(world.containers, (c) => c.claimFactionId === id),
  };
}

function relationsEditor(world, f) {
  const others = factionList(world).filter((o) => o.id !== f.id);
  if (!others.length) return h('p', { class: 'muted small' }, 'No other factions yet.');
  return others.map((o) => {
    const select = h(
      'select',
      { 'data-key': `${f.id}.rel.${o.id}`, onchange: (e) => dispatch(setField(world, PATH, f.id, 'relations', { ...f.relations, [o.id]: e.target.value }, f.name)) },
      STANCES.map((s) => h('option', { value: s.id }, s.name)),
    );
    select.value = stanceOf(world, f.id, o.id);
    return h('div', { class: 'row relation-row' }, h('span', { class: 'team-chip', style: swatchStyle(o.color) }, o.name), select, h('span', { class: 'muted small' }, `(they: ${STANCES.find((s) => s.id === stanceOf(world, o.id, f.id))?.name})`));
  });
}

function deleteButton(world, f) {
  const owned = ownedCounts(world, f.id);
  const parts = Object.entries(owned).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
  return h(
    'button',
    {
      class: 'btn small danger',
      disabled: parts.length > 0,
      title: parts.length ? `It still owns ${parts.join(', ')}. Move them to another faction first.` : 'Delete this faction (Ctrl+Z undoes it)',
      onclick: () => confirm(`Delete the faction ${f.name}?`) && dispatch(removeRecord(world, PATH, f.id)),
    },
    'Delete faction',
  );
}

export function renderFactionPanel(world, f) {
  const set = (field) => fieldSetter(world, PATH, f.id, field);
  const key = (part) => `${f.id}.${part}`;
  const members = Object.values(world.characters).filter((c) => c.factionId === f.id);
  const players = Object.values(world.players ?? {}).filter((p) => p.factionIds?.includes(f.id));
  const color = h('input', { type: 'color', value: f.color || '#888888', 'data-key': key('color'), onchange: (e) => set('color')(e.target.value) });
  const bearers = Object.values(world.crownBearers ?? {}).filter((b) => b.factionId === f.id);

  return [
    h('h2', {}, h('span', { class: 'team-chip', style: swatchStyle(f.color) }, factionIcon(f)), ` ${f.name}`),
    ...textField('Name', f.name, (v) => v.trim() && set('name')(v.trim()), { key: key('name') }),
    ...selectField('Type', f.type, FACTION_TYPES.map((t) => ({ value: t.id, label: t.name })), set('type'), { key: key('type') }),
    h('div', { class: 'row' }, h('span', { class: 'small' }, 'Color'), color),
    ...textField('Banner icon (a symbol or emoji; blank = first letter)', f.bannerIcon, (v) => set('bannerIcon')(v.trim()), { key: key('icon') }),
    ...selectField('Leader', f.leaderId, [{ value: '', label: '(none)' }, ...members.map((c) => ({ value: c.id, label: c.name }))], set('leaderId'), { key: key('leader'), missingLabel: () => '(not in this faction)' }),
    ...selectField('Home', f.homeContainerId, [{ value: '', label: '(not set)' }, ...placeOptions(world)], set('homeContainerId'), { key: key('home'), missingLabel: () => '(removed place)' }),
    ...textField('Description', f.description, set('description'), { key: key('description'), multiline: true }),
    ...textField('Notes', f.notes, set('notes'), { key: key('notes'), multiline: true }),
    h('h3', {}, 'End of day'),
    ...checkboxField('Track needs (Meal, Hunger and Thirst at Advance Day)', f.trackNeeds, set('trackNeeds'), { key: key('trackNeeds') }),
    ...checkboxField('Uses Stamina (reset at Advance Day)', f.usesStamina !== false, set('usesStamina'), { key: key('usesStamina') }),
    f.type === 'player'
      ? [
          h('h3', {}, 'Player faction'),
          // Authority Level belongs to the Crown Bearer (Crown Bearers tab).
          bearers.length
            ? bearers.map((b) => h('p', { class: 'small' }, `Crown Bearer: ${b.name}${b.title && b.title !== b.name ? `, ${b.title}` : ''} (Authority Level ${b.authorityLevel ?? 'not set'})`))
            : h('p', { class: 'muted small' }, 'No Crown Bearer rules it (Crown Bearers tab).'),
          ...textField('Spark of Change notes', f.sparkNotes, set('sparkNotes'), { key: key('spark'), multiline: true }),
          ...textField('Follower call notes', f.followerCallNotes, set('followerCallNotes'), { key: key('followers'), multiline: true }),
          h('p', { class: 'muted small' }, players.length ? `Controlled by: ${players.map((p) => p.name).join(', ')}` : 'No player controls it yet (Crown Bearers tab > Players).'),
        ]
      : null,
    h('h3', {}, 'Stance toward others'),
    relationsEditor(world, f),
    h('p', { class: 'muted small' }, `${members.filter((c) => c.alive).length} living member(s).`),
    renderCustomFields(world, PATH, f.id),
    h('div', { class: 'row actions' }, deleteButton(world, f)),
  ];
}
