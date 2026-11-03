// The Transfer form on the Resources tab: move resources between
// stockpiles of different factions as a trade, gift, theft or loss. The
// move and its Day Log entries (one for each faction) are one undo step
// (systems/factions/transfers.js).
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { RESOURCE_TRANSFER_KINDS, resourceTransferBlocker, transferResources } from '../factions/transfers.js';
import { stockpilesOf, stockpileName } from './stockpileModel.js';

// The form's values while it is being filled in (view state).
const draft = { kind: 'gift', fromStockpileId: '', toStockpileId: '', resourceTypeId: '', count: 1, returnResourceTypeId: '', returnCount: 1, note: '' };

function selectOf(options, value, onValue, empty) {
  const select = h('select', { onchange: (e) => onValue(e.target.value) }, empty ? h('option', { value: '' }, empty) : null, options.map((o) => h('option', { value: o.value }, o.label)));
  select.value = value;
  return select;
}

function resourceOptions(world, stockpile) {
  return Object.entries(stockpile?.counts ?? {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ value: id, label: `${world.definitions.resourceTypes[id]?.name ?? '(deleted)'} (${n})` }));
}

export function transferForm(world, factionId) {
  const root = h('section', { class: 'frame panel arbiter-only' });
  const redraw = () => root.replaceChildren(...content(world, factionId, redraw));
  redraw();
  return root;
}

function content(world, factionId, redraw) {
  const set = (field) => (value) => ((draft[field] = value), redraw());
  const num = (field) => {
    const input = h('input', { type: 'number', class: 'short-input', min: 1, step: 1, value: draft[field] });
    input.addEventListener('change', () => set(field)(Math.max(0, Math.round(Number(input.value) || 0))));
    return input;
  };
  // The selected faction's stockpiles come first in "From".
  const all = [...stockpilesOf(world, factionId), ...stockpilesOf(world, '').filter((s) => factionId && s.ownerFactionId !== factionId)];
  const options = all.map((s) => ({ value: s.id, label: stockpileName(world, s) }));
  if (!world.stockpiles[draft.fromStockpileId]) draft.fromStockpileId = all[0]?.id ?? '';
  const from = world.stockpiles[draft.fromStockpileId];
  const to = world.stockpiles[draft.toStockpileId];
  const isLoss = draft.kind === 'loss';
  const note = h('input', { type: 'text', class: 'wide', value: draft.note, placeholder: 'Reason or note (optional)' });
  note.addEventListener('change', () => (draft.note = note.value));
  const blocker = resourceTransferBlocker(world, draft);
  const go = () => {
    dispatch(transferResources(world, { ...draft, note: note.value }));
    Object.assign(draft, { count: 1, returnResourceTypeId: '', returnCount: 1, note: '' });
  };

  return [
    h('h2', {}, 'Transfer between factions'),
    h('div', { class: 'row' }, h('span', { class: 'small' }, 'Kind'), selectOf(RESOURCE_TRANSFER_KINDS.map((k) => ({ value: k.id, label: k.name })), draft.kind, set('kind'))),
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'small' }, draft.kind === 'theft' ? 'Stolen from' : 'From'),
      selectOf(options, draft.fromStockpileId, set('fromStockpileId')),
      selectOf(resourceOptions(world, from), draft.resourceTypeId, set('resourceTypeId'), 'Resource...'),
      num('count'),
    ),
    isLoss
      ? null
      : h(
          'div',
          { class: 'row' },
          h('span', { class: 'small' }, draft.kind === 'theft' ? 'Taken to' : 'To'),
          selectOf(options.filter((o) => o.value !== draft.fromStockpileId), draft.toStockpileId, set('toStockpileId'), 'Stockpile...'),
        ),
    draft.kind === 'trade'
      ? h(
          'div',
          { class: 'row' },
          h('span', { class: 'small' }, 'In return (optional)'),
          selectOf(resourceOptions(world, to), draft.returnResourceTypeId, set('returnResourceTypeId'), 'Nothing'),
          draft.returnResourceTypeId ? num('returnCount') : null,
        )
      : null,
    note,
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn primary', disabled: !!blocker, title: blocker || 'Move the resources and log it for both factions (Ctrl+Z undoes it)', onclick: go }, 'Transfer'),
      blocker ? h('span', { class: 'muted small' }, blocker) : null,
    ),
  ];
}
