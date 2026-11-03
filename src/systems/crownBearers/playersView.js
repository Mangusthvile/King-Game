// The Players view: each player, the factions they control, and the Crown
// Bearer(s) they are connected to, each with a Connectivity level (1 to 10)
// and its history. Changing a level asks for a reason and adds a history line.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { addRecord, removeRecord, setField } from '../../commands/recordCommands.js';
import { createPlayer, factionList } from '../../data/factions.js';
import { createConnection } from '../../data/crownBearers.js';
import { connectivityLevel } from '../../rules/connectivity.js';
import { askConnectivity } from './crownDialogs.js';
import { eyeSection, canSeeFaction, pvActive } from '../../ui/playerView.js';

function connectionRow(world, p, link, index) {
  const bearer = world.crownBearers?.[link.crownBearerId];
  const history = link.history ?? [];
  const remove = () => confirm(`Disconnect ${p.name} from ${bearer?.name ?? 'this Crown Bearer'}?`) && dispatch(setField(world, 'players', p.id, 'connections', p.connections.filter((_, i) => i !== index), p.name));
  return h(
    'div',
    { class: 'connectivity-box' },
    h(
      'div',
      { class: 'row' },
      h('strong', {}, bearer?.name ?? '(removed Crown Bearer)'),
      h('span', {}, `Connectivity ${link.connectivity ?? '-'}`),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn tiny', onclick: () => askConnectivity(world, p, index) }, 'Change...'),
      h('button', { class: 'btn tiny danger', onclick: remove }, 'x'),
    ),
    h('p', { class: 'muted small connectivity-text' }, connectivityLevel(world, link.connectivity)?.description ?? ''),
    // Arbiter-only by default (Player View).
    history.length
      ? eyeSection(
          world,
          `${p.id}.connectivityHistory`,
          h(
            'details',
            {},
            h('summary', { class: 'small' }, `Connectivity history (${history.length})`),
            h('ul', { class: 'wizard-list small' }, history.map((x) => h('li', {}, `Day ${x.day}: ${x.oldLevel ?? '-'} -> ${x.newLevel}${x.reason ? ` (${x.reason})` : ''}`))),
          ),
          'Connectivity history',
        )
      : null,
  );
}

function playerRow(world, p) {
  const set = (field, value) => dispatch(setField(world, 'players', p.id, field, value, p.name));
  const name = h('input', { type: 'text', value: p.name, 'data-key': `${p.id}.name` });
  name.addEventListener('change', () => name.value.trim() && set('name', name.value.trim()));
  const notes = h('textarea', { rows: 2, class: 'wide', value: p.notes ?? '', placeholder: 'Notes', 'data-key': `${p.id}.notes` });
  notes.addEventListener('change', () => set('notes', notes.value));
  const toggle = (fid, on) => set('factionIds', on ? [...(p.factionIds ?? []), fid] : p.factionIds.filter((x) => x !== fid));
  const linked = new Set((p.connections ?? []).map((c) => c.crownBearerId));
  const free = Object.values(world.crownBearers ?? {}).filter((b) => !linked.has(b.id));
  const connect = h('select', { onchange: (e) => e.target.value && set('connections', [...(p.connections ?? []), createConnection(e.target.value, 9)]) }, h('option', { value: '' }, '+ Connect to a Crown Bearer...'), free.map((b) => h('option', { value: b.id }, b.name)));
  return h(
    'div',
    { class: 'player-row' },
    h('div', { class: 'row' }, name, h('div', { class: 'spacer' }), h('button', { class: 'btn small danger', onclick: () => confirm(`Delete the player ${p.name}?`) && dispatch(removeRecord(world, 'players', p.id)) }, 'Delete player')),
    h(
      'div',
      { class: 'wizard-checks' },
      h('span', { class: 'small muted' }, 'Controls:'),
      factionList(world).map((f) => h('label', { class: 'check-label small' }, h('input', { type: 'checkbox', checked: (p.factionIds ?? []).includes(f.id), onchange: (e) => toggle(f.id, e.target.checked) }), ` ${f.name}`)),
    ),
    (p.connections ?? []).map((link, i) => connectionRow(world, p, link, i)),
    free.length ? connect : null,
    notes,
  );
}

export function renderPlayers(world) {
  // Player View: only the players of the faction shown.
  const players = Object.values(world.players ?? {}).filter((p) => !pvActive(world) || (p.factionIds ?? []).some((id) => canSeeFaction(world, id)));
  const name = h('input', { type: 'text', placeholder: 'Player name' });
  const add = (e) => {
    e.preventDefault();
    dispatch(addRecord('players', createPlayer(name.value.trim() || 'New Player')));
  };
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, `Players (${players.length})`),
    h('p', { class: 'muted small' }, 'Each player, the factions they control, and the Crown Bearer(s) they are connected to. A new connection starts at Connectivity 9.'),
    h('form', { class: 'row arbiter-only', onsubmit: add }, name, h('button', { class: 'btn small primary', type: 'submit' }, '+ New player')),
    players.length ? players.map((p) => playerRow(world, p)) : h('p', { class: 'muted small' }, 'No players yet.'),
  );
}
