// The faction part of the stat sheet: the current faction (changing it is
// a move to another faction, logged for both factions with a reason), and
// the faction history, editable like any other list.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { openDialog } from '../../ui/dialog.js';
import { factionOptions, factionName } from '../../data/factions.js';
import { moveCharacter } from '../factions/transfers.js';
import { listEditor } from './listEditor.js';

function askMove(world, c, toFactionId, select) {
  const reason = h('input', { type: 'text', class: 'wide', placeholder: 'e.g. Captured, joined willingly, exiled...' });
  openDialog({
    title: `Move ${c.name} to ${factionName(world, toFactionId)}?`,
    body: [
      h('p', {}, `${c.name} leaves ${factionName(world, c.factionId)} today (Day ${world.meta.currentDay}). Both factions get a Day Log entry, and the faction history gets a new line.`),
      h('label', {}, 'Reason (optional)'),
      reason,
    ],
    buttons: [
      { label: 'Move', primary: true, onClick: () => dispatch(moveCharacter(world, c.id, toFactionId, reason.value)) },
      { label: 'Cancel', onClick: () => (select.value = c.factionId ?? '') },
    ],
  });
}

export function renderFactionSection(world, c) {
  const select = h('select', { class: 'wide', 'data-key': `${c.id}.faction` }, h('option', { value: '' }, '(none)'), factionOptions(world).map((o) => h('option', { value: o.value }, o.label)));
  select.value = c.factionId ?? '';
  select.addEventListener('change', () => select.value !== (c.factionId ?? '') && askMove(world, c, select.value, select));
  const history = listEditor(
    world,
    c,
    'factionHistory',
    [
      { key: 'factionId', label: 'Faction', type: 'select', options: [{ value: '', label: '(none)' }, ...factionOptions(world)] },
      { key: 'fromDay', label: 'From day', type: 'number' },
      { key: 'toDay', label: 'To day', type: 'number' },
      { key: 'reason', label: 'Reason', type: 'text', wide: true },
    ],
    { newItem: () => ({ factionId: c.factionId ?? '', fromDay: world.meta.currentDay, toDay: null, reason: '' }), addLabel: '+ Add history line' },
  );
  return [
    h('label', {}, 'Faction'),
    select,
    h('details', { class: 'faction-history' }, h('summary', { class: 'small' }, `Faction history (${(c.factionHistory ?? []).length})`), history),
  ];
}
