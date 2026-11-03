// The Resources tab (minimal until the Resources stage): one table per
// stockpile of the selected faction (or every faction's), main stockpiles
// first. Each row is a resource with its count, tags and Food value. Counts
// are set by hand; the Advance Day meal takes food out of them, and the
// transfer form moves resources between factions.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { newId } from '../../data/ids.js';
import { placeOptions } from '../../data/places.js';
import { addRecord, removeRecord, setField, batch } from '../../commands/recordCommands.js';
import { isFood, foodValueOf, foodNeeded, NEEDS } from '../../rules/needs.js';
import { factionName, factionOptions, factionSettings, inFaction, activeFactionIds } from '../../data/factions.js';
import { selectedFactionId } from '../../ui/factionSelector.js';
import { createStockpile, stockpilesOf, mainStockpile, stockpileName, setStockCount, setCounts, foodAvailable } from './stockpileModel.js';
import { transferForm } from './transferForm.js';

// Realm > Resources > Stockpiles or Transfers.
export function renderResourcesTab(world, { path }) {
  const factionId = selectedFactionId(world);
  const root = h('div', { class: 'tab-page wide-page' });
  if (path.endsWith('/transfers')) root.append(transferForm(world, factionId));
  else root.append(foodSummary(world, factionId), ...stockpilesOf(world, factionId).map((s) => stockpileSection(world, s)), addStockpileSection(world, factionId));
  return root;
}

// Food against the need of one faction.
function foodLine(world, factionId) {
  const living = Object.values(world.characters).filter((c) => c.alive && inFaction(c, factionId)).length;
  const need = foodNeeded(living);
  const have = foodAvailable(world, factionId);
  const tracked = factionSettings(world, factionId).trackNeeds;
  const cls = !tracked ? 'muted' : have < need ? 'flag-text' : 'ok-text';
  return h('p', { class: cls }, `${factionName(world, factionId)}: Food ${have}. ${living} living character(s) need ${need} a day.${tracked ? '' : ' (Needs not tracked for this faction.)'}`);
}

function foodSummary(world, factionId) {
  const ids = factionId ? [factionId] : activeFactionIds(world).filter(Boolean);
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, factionId ? `Resources: ${factionName(world, factionId)}` : 'Resources: all factions'),
    ids.map((id) => foodLine(world, id)),
    h('p', { class: 'muted small' }, `A resource with the tag "${NEEDS.foodTag}" is food; its Food value is how much Food one unit gives (default ${NEEDS.defaultFoodValue}). Names, tags and Food values are shared by every stockpile. This is a minimal stockpile until the Resources stage.`),
  );
}

const parseTags = (text) =>
  text
    .split(',')
    .map((t) => t.replace(/[[\]]/g, '').trim())
    .filter(Boolean);

function resourceRow(world, stockpileId, typeId, count) {
  const type = world.definitions.resourceTypes[typeId];
  const key = `stock.${stockpileId}.${typeId}`;
  const setCount = (n) => Number.isFinite(n) && n !== count && dispatch(setStockCount(world, stockpileId, typeId, Math.max(0, n)));
  const countInput = h('input', { type: 'number', class: 'short-input', min: 0, step: 1, value: count, 'data-key': `${key}.count`, onchange: (e) => setCount(Math.round(Number(e.target.value))) });
  return h(
    'div',
    { class: 'stock-row' },
    h('input', {
      type: 'text',
      value: type?.name ?? '(deleted resource)',
      disabled: !type,
      title: 'Resource name (renames it everywhere)',
      'data-key': `${key}.name`,
      onchange: (e) => {
        const name = e.target.value.trim();
        if (name && name !== type.name) dispatch(setField(world, 'definitions.resourceTypes', typeId, 'name', name, type.name));
      },
    }),
    h('div', { class: 'row inline' }, h('button', { class: 'btn tiny', title: '-1', onclick: () => setCount(count - 1) }, '-'), countInput, h('button', { class: 'btn tiny', title: '+1', onclick: () => setCount(count + 1) }, '+')),
    h('input', {
      type: 'text',
      value: (type?.tags ?? []).join(', '),
      placeholder: 'Tags, e.g. Food, Wood',
      disabled: !type,
      title: 'Tags, separated by commas (shared by every stockpile)',
      'data-key': `${key}.tags`,
      onchange: (e) => {
        const tags = parseTags(e.target.value);
        if (tags.join('|') !== (type.tags ?? []).join('|')) dispatch(setField(world, 'definitions.resourceTypes', typeId, 'tags', tags, type.name));
      },
    }),
    h(
      'label',
      { class: isFood(type) ? 'stock-food' : 'stock-food muted', title: 'Food per unit (used when this resource is tagged Food)' },
      'Food ',
      h('input', {
        type: 'number',
        class: 'short-input',
        min: 0,
        step: 'any',
        value: foodValueOf(type),
        disabled: !type,
        'data-key': `${key}.food`,
        onchange: (e) => {
          const value = Number(e.target.value);
          if (Number.isFinite(value) && value !== type.foodValue) dispatch(setField(world, 'definitions.resourceTypes', typeId, 'foodValue', value, type.name));
        },
      }),
    ),
    h('button', { class: 'btn small danger', title: 'Remove from this stockpile', onclick: () => dispatch(setStockCount(world, stockpileId, typeId, null)) }, 'x'),
  );
}

// Typing a name that doesn't exist yet creates the resource type.
function addRow(world, stockpileId) {
  const types = world.definitions.resourceTypes;
  const listId = `stock-names-${stockpileId}`;
  const name = h('input', { type: 'text', placeholder: 'Resource name', 'data-key': `stock.${stockpileId}.new` });
  name.setAttribute('list', listId);
  const count = h('input', { type: 'number', class: 'short-input', min: 0, step: 1, value: 1 });
  const add = (e) => {
    e.preventDefault();
    const text = name.value.trim();
    if (!text) return;
    const n = Math.max(0, Math.round(Number(count.value) || 0));
    const existing = Object.values(types).find((t) => t.name.toLowerCase() === text.toLowerCase());
    const type = existing ?? { id: newId('resource'), name: text, description: '', tags: [], foodValue: NEEDS.defaultFoodValue, customFields: {} };
    const counts = { ...world.stockpiles[stockpileId].counts };
    counts[type.id] = (counts[type.id] ?? 0) + n;
    dispatch(batch(`Added ${n} ${text} to the ${stockpileName(world, world.stockpiles[stockpileId])} stockpile`, [existing ? null : addRecord('definitions.resourceTypes', type), setCounts(world, stockpileId, counts)]));
  };
  return h('form', { class: 'stock-row add', onsubmit: add }, name, count, h('datalist', { id: listId }, Object.values(types).map((t) => h('option', { value: t.name }))), h('button', { class: 'btn small', type: 'submit' }, 'Add'));
}

function stockpileSection(world, s) {
  const rows = Object.entries(s.counts ?? {}).map(([typeId, count]) => resourceRow(world, s.id, typeId, count));
  const set = (field) => (value) => value !== s[field] && dispatch(setField(world, 'stockpiles', s.id, field, value, stockpileName(world, s)));
  const owner = h(
    'select',
    { title: 'Owner faction. To move resources between factions with a log entry, use Transfer below.', 'data-key': `stock.${s.id}.owner`, onchange: (e) => set('ownerFactionId')(e.target.value) },
    h('option', { value: '' }, 'No faction'),
    factionOptions(world).map((o) => h('option', { value: o.value }, o.label)),
  );
  owner.value = s.ownerFactionId ?? '';
  const name = h('input', { type: 'text', value: s.name ?? '', placeholder: stockpileName(world, { ...s, name: '' }), title: 'Stockpile name (blank = named after its owner and place)', 'data-key': `stock.${s.id}.name` });
  name.addEventListener('change', () => set('name')(name.value.trim()));
  const remove = () => confirm(`Remove the ${stockpileName(world, s)} stockpile and everything in it? Ctrl+Z brings it back.`) && dispatch(removeRecord(world, 'stockpiles', s.id));
  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `Stockpile: ${stockpileName(world, s)}`), h('div', { class: 'spacer' }), h('button', { class: 'btn small danger', onclick: remove }, 'Remove stockpile')),
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'small muted' }, 'Owner'),
      owner,
      h('span', { class: 'small muted' }, 'Name'),
      name,
      h('span', { class: 'small muted' }, s.placeId ? `At ${world.containers[s.placeId]?.name ?? '(removed place)'}` : 'Main stockpile'),
    ),
    rows.length
      ? [h('div', { class: 'stock-row stock-header muted small' }, h('span', {}, 'Resource'), h('span', {}, 'Count'), h('span', {}, 'Tags'), h('span', {}, 'Food value'), h('span', {})), rows]
      : h('p', { class: 'muted small' }, 'Empty.'),
    addRow(world, s.id),
  );
}

// A new stockpile: a faction's main one, or one kept at a place.
function addStockpileSection(world, factionId) {
  const owner = h('select', {}, factionOptions(world).map((o) => h('option', { value: o.value }, o.label)));
  owner.value = factionId || factionOptions(world)[0]?.value || '';
  const place = h('select', {}, h('option', { value: '' }, 'Main stockpile (no place)'), placeOptions(world).map((o) => h('option', { value: o.value }, o.label)));
  const add = () => {
    if (!owner.value) return;
    if (!place.value && mainStockpile(world, owner.value)) return alert(`${factionName(world, owner.value)} already has a main stockpile. Pick a place for this one.`);
    dispatch(addRecord('stockpiles', createStockpile(owner.value, place.value)));
  };
  return h(
    'section',
    { class: 'frame panel arbiter-only' },
    h('h2', {}, 'New stockpile'),
    h('p', { class: 'muted small' }, 'Each faction has a main stockpile and may keep more at a Region, Biome or Area. Advance Day feeds a faction from all of its stockpiles.'),
    h('div', { class: 'row' }, h('span', { class: 'small' }, 'Owner'), owner, h('span', { class: 'small' }, 'Where'), place, h('button', { class: 'btn small', onclick: add }, 'Add stockpile')),
  );
}
