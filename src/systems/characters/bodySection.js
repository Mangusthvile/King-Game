// The Body part of the stat sheet: Body Type and level, Body Level, STR,
// SPD, TOU, Health, and today's Speed. The Body Type table and the Health
// formula only PROPOSE values; the Arbiter applies them or keeps their own.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, batch } from '../../commands/recordCommands.js';
import { proposedStats, differencesFromTable, statsOverCeiling, nextBodyLevel, BODY_STATS } from '../../rules/bodyTypes.js';
import { healthFor } from '../../rules/health.js';
import { refOptions } from './libraryEditor.js';
import { charactersView as view } from './state.js';

const LABELS = { bodyLevel: 'Body Lv', STR: 'STR', SPD: 'SPD', TOU: 'TOU' };

// One number field of the character (null allowed when empty is allowed).
function numberField(world, c, field, { allowEmpty = false } = {}) {
  return h('input', {
    type: 'number',
    step: 'any',
    value: c[field] ?? '',
    'data-key': `${c.id}.${field}`,
    onchange: (e) => {
      const n = Number(e.target.value);
      if (e.target.value === '' && allowEmpty) dispatch(setField(world, 'characters', c.id, field, null, c.name));
      else if (e.target.value !== '' && Number.isFinite(n)) dispatch(setField(world, 'characters', c.id, field, n, c.name));
    },
  });
}

// Health { current, max }: both editable. The formula's max is shown next
// to it with a Use button when they differ.
function healthField(world, c) {
  const save = (part, value) => dispatch(setField(world, 'characters', c.id, 'health', { ...c.health, [part]: value }, c.name));
  const formula = healthFor(c);
  const input = (part) =>
    h('input', {
      type: 'number',
      step: 'any',
      value: c.health?.[part] ?? '',
      'data-key': `${c.id}.health.${part}`,
      onchange: (e) => save(part, e.target.value === '' ? null : Number(e.target.value)),
    });
  return [
    h('div', { class: 'stat-pair' }, h('span', { class: 'stat-label' }, 'Health'), input('current'), h('span', { class: 'muted' }, '/'), input('max')),
    h(
      'p',
      { class: 'muted small', title: 'Health = MAX(1, ROUNDUP((Body Level + STR + TOU) / 3))' },
      `Formula max: ${formula ?? '-'} (Body Lv + STR + TOU, divided by 3, rounded up). `,
      formula !== null && formula !== c.health?.max ? h('button', { class: 'btn small', onclick: () => save('max', formula) }, `Use ${formula}`) : null,
    ),
  ];
}

// Sets Health max to the formula for these stats, if it changes. Current
// Health is left alone (whether it changes too is the Arbiter's call).
function healthCommand(world, c, stats) {
  const max = healthFor({ ...c, ...stats });
  return max !== null && max !== c.health?.max ? setField(world, 'characters', c.id, 'health', { ...c.health, max }, c.name) : null;
}

// Traits a Body Type grants that the character doesn't have yet.
function missingGrantedTraits(world, c, bodyType) {
  const have = new Set(c.traits.map((t) => t.traitId));
  return (bodyType?.grantsTraitIds ?? []).filter((id) => !have.has(id) && world.definitions.traits[id]);
}

function traitBoxes(world, ids) {
  return ids.map((id) => ({ id, box: h('input', { type: 'checkbox', checked: true }), name: world.definitions.traits[id].name }));
}

function addTraits(world, c, boxes) {
  const picked = boxes.filter((b) => b.box.checked).map((b) => ({ traitId: b.id, note: '' }));
  return picked.length ? setField(world, 'characters', c.id, 'traits', [...c.traits, ...picked], c.name) : null;
}

// The changed stats as setField commands.
function statCommands(world, c, stats) {
  return ['bodyLevel', ...BODY_STATS].filter((k) => stats[k] !== undefined && stats[k] !== c[k]).map((k) => setField(world, 'characters', c.id, k, stats[k], c.name));
}

export function renderBodySection(world, c, refresh) {
  const types = world.definitions.bodyTypes;
  const bodyType = types[c.bodyTypeId];
  const proposal = proposedStats(bodyType, c.bodyTypeLevel);
  const differences = differencesFromTable(c, proposal);
  const missingTraits = missingGrantedTraits(world, c, bodyType);
  const over = statsOverCeiling(c, bodyType);
  const next = nextBodyLevel(bodyType, c.bodyTypeLevel);

  const typeSelect = h(
    'select',
    { 'data-key': `${c.id}.bodyType`, onchange: (e) => dispatch(setField(world, 'characters', c.id, 'bodyTypeId', e.target.value, c.name)) },
    h('option', { value: '' }, '(none)'),
    refOptions(world, 'bodyTypes').map((o) => h('option', { value: o.value }, o.label)),
    c.bodyTypeId && !bodyType ? h('option', { value: c.bodyTypeId }, '(deleted Body Type)') : null,
  );
  typeSelect.value = c.bodyTypeId ?? '';

  return [
    h('h3', {}, 'Body'),
    h(
      'div',
      { class: 'field-grid' },
      h('label', {}, 'Body Type'),
      typeSelect,
      h('label', {}, 'Body Type level'),
      numberField(world, c, 'bodyTypeLevel'),
      h('label', {}, 'Body Level'),
      numberField(world, c, 'bodyLevel'),
      ...BODY_STATS.flatMap((k) => [h('label', {}, k), numberField(world, c, k)]),
    ),
    bodyType && !proposal ? h('p', { class: 'muted small' }, `${bodyType.name} has no table row for level ${c.bodyTypeLevel}.`) : null,
    differences.length || missingTraits.length ? proposalBox(world, c, bodyType, proposal, differences, missingTraits) : null,
    over.length ? h('p', { class: 'message warning small' }, `Above ${bodyType.name}'s stat ceiling of ${bodyType.statCeiling}: ${over.join(', ')}. (A warning only.)`) : null,
    view.helper?.kind === 'levelUp'
      ? levelUpForm(world, c, bodyType, next, refresh)
      : bodyType && next
        ? h('button', { class: 'btn small', onclick: () => ((view.helper = { kind: 'levelUp' }), refresh()) }, `Level up body (to ${bodyType.name} Lv ${next.level})`)
        : bodyType
          ? h('p', { class: 'muted small' }, `${bodyType.name} is at its max level (${bodyType.maxLevel}).`)
          : null,
    ...healthField(world, c),
    h('h3', {}, 'Speed today'),
    h(
      'div',
      { class: 'stat-pair', title: 'SPD is also the daily Speed budget' },
      h('span', { class: 'stat-label' }, 'Remaining'),
      numberField(world, c, 'speedRemaining'),
      h('span', { class: 'muted' }, '/'),
      h('span', { class: 'speed-max' }, `SPD ${c.SPD}`),
    ),
  ];
}

// "The table says..." with Apply. Ignoring it keeps the Arbiter's values.
function proposalBox(world, c, bodyType, proposal, differences, missingTraits) {
  const boxes = traitBoxes(world, missingTraits);
  return h(
    'div',
    { class: 'helper-box proposal' },
    h('h3', {}, `${bodyType.name} Lv ${c.bodyTypeLevel} table`),
    differences.length
      ? h('p', { class: 'small' }, differences.map((d) => `${LABELS[d.key]} ${d.proposed} (now ${d.current ?? '-'})`).join(', '), proposal ? `. Health max ${healthFor(proposal)}.` : '')
      : null,
    boxes.length ? h('p', { class: 'small' }, 'This Body Type grants:') : null,
    boxes.map((b) => h('label', { class: 'check-label small' }, b.box, ` Add Trait: ${b.name}`)),
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'btn small primary',
          onclick: () =>
            dispatch(
              batch(`${c.name}: applied the ${bodyType.name} Lv ${c.bodyTypeLevel} table`, [
                ...(proposal ? statCommands(world, c, proposal) : []),
                proposal ? healthCommand(world, c, proposal) : null,
                addTraits(world, c, boxes),
              ]),
            ),
        },
        'Apply',
      ),
      h('span', { class: 'muted small' }, 'or edit the numbers above to keep your own.'),
    ),
  );
}

// Shows the next level's stats and the prerequisite; the Arbiter confirms.
function levelUpForm(world, c, bodyType, next, refresh) {
  const close = () => ((view.helper = null), refresh());
  if (!bodyType || !next) return null;
  const boxes = traitBoxes(world, missingGrantedTraits(world, c, bodyType));
  const row = next.row;
  return h(
    'div',
    { class: 'helper-box' },
    h('h3', {}, `Level up: ${bodyType.name} Lv ${next.level}`),
    h('p', { class: 'small' }, h('b', {}, 'Prerequisite: '), bodyType.prerequisite || '(none written)'),
    row
      ? h(
          'p',
          { class: 'small' },
          `Body Lv ${row.bodyLv}, STR ${row.STR}, SPD ${row.SPD}, TOU ${row.TOU}, Health max ${healthFor({ bodyLevel: row.bodyLv, STR: row.STR, TOU: row.TOU })}${row.notes ? ` (${row.notes})` : ''}`,
        )
      : h('p', { class: 'message warning small' }, `The table has no row for Lv ${next.level} yet, so only the Body Type level changes. Add the row in Libraries > Body Types.`),
    boxes.map((b) => h('label', { class: 'check-label small' }, b.box, ` Add granted Trait: ${b.name}`)),
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'btn small primary',
          onclick: () => {
            view.helper = null;
            const stats = row ? { bodyLevel: row.bodyLv, STR: row.STR, SPD: row.SPD, TOU: row.TOU } : {};
            dispatch(
              batch(`${c.name}: ${bodyType.name} Lv ${next.level}`, [
                setField(world, 'characters', c.id, 'bodyTypeLevel', next.level, c.name),
                ...statCommands(world, c, stats),
                row ? healthCommand(world, c, stats) : null,
                addTraits(world, c, boxes),
              ]),
            );
          },
        },
        'Confirm level up',
      ),
      h('button', { class: 'btn small', onclick: close }, 'Cancel'),
    ),
  );
}
