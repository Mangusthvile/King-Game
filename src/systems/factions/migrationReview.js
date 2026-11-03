// The owner review shown once after the migration to factions (schema 16):
// every owned thing with its owner, so the Arbiter can reassign anything.
// Each change is a command (Ctrl+Z undoes it). "Done" ends the review
// (meta.settings.factionReview = false); "Later" hides it until the world
// is opened again.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField, batch } from '../../commands/recordCommands.js';
import { factionOptions, factionName } from '../../data/factions.js';
import { stockpileName } from '../resources/stockpileModel.js';
import { navigate } from '../../ui/navigation.js';

let hiddenFor = null; // the world id "Later" was pressed for

export function reviewPending(world) {
  return !!world.meta.settings?.factionReview && hiddenFor !== world.meta.id;
}

function ownerSelect(world, value, onValue, empty = 'No faction') {
  const select = h('select', { onchange: (e) => onValue(e.target.value) }, h('option', { value: '' }, empty), factionOptions(world).map((o) => h('option', { value: o.value }, o.label)));
  select.value = value ?? '';
  return select;
}

// A character's faction, with the history entry made by the migration.
function setCharacterFaction(world, c, factionId) {
  const history = (c.factionHistory ?? []).length === 1 && c.factionHistory[0].fromDay === null ? [{ ...c.factionHistory[0], factionId }] : c.factionHistory;
  return batch(`${c.name}: faction set to ${factionName(world, factionId)}`, [setField(world, 'characters', c.id, 'factionId', factionId, c.name), setField(world, 'characters', c.id, 'factionHistory', history, c.name)]);
}

// One group: a "set all" picker, then one row per record.
function group(world, title, items) {
  if (!items.length) return null;
  const setAll = ownerSelect(world, '', (v) => v && dispatch(batch(`${title}: all set to ${factionName(world, v)}`, items.map((i) => i.command(v)))), 'Set all to...');
  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `${title} (${items.length})`), h('div', { class: 'spacer' }), setAll),
    items.map((i) => h('div', { class: 'review-row' }, h('span', { class: 'small ellipsis', title: i.label }, i.label), ownerSelect(world, i.value, (v) => dispatch(i.command(v))))),
  );
}

// Day Log entries are grouped by day: one picker per entry.
function dayLogGroups(world) {
  return Object.values(world.dayLogs ?? {})
    .sort((a, b) => a.day - b.day)
    .flatMap((d) => [
      ...Object.entries(d.startOfDays ?? {}).map(([fid, record]) => ({
        label: `Day ${d.day}: Start of Day`,
        value: fid,
        command: (to) => {
          const all = { ...d.startOfDays };
          delete all[fid];
          all[to] = record;
          return setField(world, 'dayLogs', d.id, 'startOfDays', all, `Day ${d.day} Log`);
        },
      })),
      ...(d.entries ?? []).map((e) => ({
        label: `Day ${d.day}: ${e.text.split('\n').find((l) => /[a-z0-9]/i.test(l)) ?? e.kind}`, // skips "=====" lines
        value: e.factionId,
        // Rebuilt from the current list when run, so several changes in one day stack.
        command: (to) => setField(world, 'dayLogs', d.id, 'entries', world.dayLogs[d.id].entries.map((x) => (x.id === e.id ? { ...x, factionId: to } : x)), `Day ${d.day} Log`),
      })),
    ]);
}

export function renderMigrationReview(world, { detailPanel }) {
  const owner = (collection, labelOf) =>
    Object.values(world[collection] ?? {}).map((r) => ({ label: labelOf(r), value: r.ownerFactionId, command: (to) => setField(world, collection, r.id, 'ownerFactionId', to, labelOf(r)) }));
  detailPanel.replaceChildren(
    h('h2', {}, 'Review owners'),
    h('p', { class: 'small' }, 'Factions were added to this world. Characters got a faction from their old team (Ally: Apollyon, Enemy: Vulture Pack, other: Unaligned); everything else went to Apollyon.'),
    h('p', { class: 'muted small' }, 'Change anything here. Every change can be undone. Press Done when it is right; the Factions tab has the factions themselves.'),
  );
  // "Set all" on Day Log entries changes one day at a time, so it runs per entry list.
  const logItems = dayLogGroups(world);
  return h(
    'div',
    { class: 'tab-page wide-page' },
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, 'Factions: review owners'),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => dispatch(setField(world, 'meta', 'settings', 'factionReview', false)) }, 'Done'),
        h('button', { class: 'btn', title: 'Hide the review until the world is opened again', onclick: () => ((hiddenFor = world.meta.id), navigate({})) }, 'Later'),
      ),
    ),
    group(world, 'Characters', Object.values(world.characters).map((c) => ({ label: `${c.alive ? '' : '✝ '}${c.name}`, value: c.factionId, command: (to) => setCharacterFaction(world, c, to) }))),
    group(world, 'Stockpiles', owner('stockpiles', (s) => stockpileName(world, s))),
    group(world, 'Buildings', owner('buildings', (b) => b.name)),
    group(world, 'Projects', owner('projects', (p) => p.name)),
    group(world, 'Simple tasks', owner('tasks', (t) => `Day ${t.day}: ${t.description}`)),
    logItems.length ? reviewLogGroup(world, logItems) : null,
  );
}

// Like group(), but "set all" changes every Day Log entry in one command per day.
function reviewLogGroup(world, items) {
  const setAll = ownerSelect(
    world,
    '',
    (to) => {
      if (!to) return;
      const commands = Object.values(world.dayLogs).map((d) => {
        const all = Object.keys(d.startOfDays ?? {}).length ? { [to]: Object.values(d.startOfDays)[0] } : d.startOfDays;
        return [setField(world, 'dayLogs', d.id, 'entries', d.entries.map((e) => ({ ...e, factionId: to })), `Day ${d.day} Log`), setField(world, 'dayLogs', d.id, 'startOfDays', all, `Day ${d.day} Log`)];
      });
      dispatch(batch(`Day Log: all set to ${factionName(world, to)}`, commands.flat()));
    },
    'Set all to...',
  );
  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `Day Log (${items.length})`), h('div', { class: 'spacer' }), setAll),
    h('p', { class: 'muted small' }, '"Set all" keeps one Start of Day record per day (they were all Apollyon\'s).'),
    items.map((i) => h('div', { class: 'review-row' }, h('span', { class: 'small ellipsis', title: i.label }, i.label), ownerSelect(world, i.value, (v) => dispatch(i.command(v))))),
  );
}
