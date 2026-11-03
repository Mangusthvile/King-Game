// The Start of Day record: the Arbiter's game events for the day, all free
// text and optional, one per Player faction. Saved on the day's Day Log
// record and shown (and copied) at the top of that faction's day. Its text
// comes from templates/startOfDay.txt and is rebuilt on every edit.
import template from './templates/startOfDay.txt?raw';
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { fillTemplate } from '../../rules/logTemplate.js';
import { startOfDay, setStartOfDay } from '../../data/dayLog.js';
import { factionList, factionName } from '../../data/factions.js';
import { factionConnectivity } from '../../data/crownBearers.js';
import { connectivityLevel } from '../../rules/connectivity.js';

// Which Player faction the panel shows when the selector doesn't pick one.
let chosenId = '';

export const START_FIELDS = [
  { key: 'sparkOfChange', label: 'Spark of Change (the wish)', multiline: true },
  { key: 'sparkOfBalance', label: 'Spark of Balance (the result)', multiline: true },
  { key: 'followersOffered', label: 'Followers offered' },
  { key: 'dayEvent', label: 'Day event', multiline: true },
  { key: 'notes', label: 'Other notes', multiline: true },
];

const DECISIONS = [
  { value: '', label: '-' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'refused', label: 'Refused' },
];

// connectivity: lines like "First Sky King 9 (with Ash)", shown at the top.
export function startOfDayText(day, record, factionLabel = '', connectivity = []) {
  const decision = DECISIONS.find((d) => d.value === record.followersDecision && d.value);
  const filled = fillTemplate(template, { ...record, day, factionName: factionLabel, connectivity, decisionText: decision ? ` (${decision.label})` : '' }).trim();
  // Only the heading: nothing was filled in.
  return START_FIELDS.some((f) => (record[f.key] ?? '').trim()) ? filled : '';
}

// The current Connectivity of the faction's Crown Bearer(s), as text.
const connectivityLines = (world, factionId) => factionConnectivity(world, factionId).map((x) => `${x.bearer.name} ${x.level ?? '-'} (with ${x.player.name})`);

// The Connectivity box at the top of the panel, with each level's reminder.
function connectivityBox(world, factionId) {
  const links = factionConnectivity(world, factionId);
  if (!links.length) return h('p', { class: 'muted small' }, 'No Crown Bearer with a connected player rules this faction (Crown Bearers tab).');
  return links.map((x) =>
    h(
      'div',
      { class: 'connectivity-box' },
      h('strong', {}, `${x.bearer.name}: Connectivity ${x.level ?? '-'}`),
      h('span', { class: 'muted small' }, ` (with ${x.player.name})`),
      h('p', { class: 'small connectivity-text', title: 'Reminder from RULES.md (not enforced)' }, connectivityLevel(world, x.level)?.description ?? ''),
    ),
  );
}

function save(world, day, factionId, changes) {
  const old = startOfDay(world, day, factionId) ?? {};
  const record = { ...Object.fromEntries(START_FIELDS.map((f) => [f.key, ''])), followersDecision: '', ...old, ...changes };
  record.text = startOfDayText(day, record, factionName(world, factionId), connectivityLines(world, factionId));
  dispatch(setStartOfDay(world, day, factionId, record));
}

// The form, for the Today tab's side panel. selectedId: the faction the
// top bar shows ('' = all). Only Player factions have a Start of Day.
export function renderStartOfDay(world, selectedId) {
  const day = world.meta.currentDay;
  const players = factionList(world).filter((f) => f.type === 'player');
  if (!players.length) return [h('h2', {}, `Start of Day ${day}`), h('p', { class: 'muted small' }, 'Only Player factions have a Start of Day record. Make one in the Factions tab.')];
  const fixed = players.find((f) => f.id === selectedId);
  if (fixed) chosenId = fixed.id;
  if (!players.some((f) => f.id === chosenId)) chosenId = players[0].id;
  const factionId = chosenId;
  const picker = fixed
    ? null
    : (() => {
        const select = h('select', { class: 'wide', onchange: (e) => ((chosenId = e.target.value), redraw()) }, players.map((f) => h('option', { value: f.id }, f.name)));
        select.value = factionId;
        return select;
      })();
  const redraw = () => {
    const panel = picker?.closest('.detail-panel');
    if (panel) panel.replaceChildren(...renderStartOfDay(world, selectedId).flat(Infinity).filter(Boolean));
  };
  const save_ = (changes) => save(world, day, factionId, changes);
  const record = startOfDay(world, day, factionId) ?? {};
  const fields = START_FIELDS.map((f) => {
    const input = f.multiline
      ? h('textarea', { rows: 2, value: record[f.key] ?? '', 'data-key': `sod.${day}.${factionId}.${f.key}` })
      : h('input', { type: 'text', class: 'wide', value: record[f.key] ?? '', 'data-key': `sod.${day}.${factionId}.${f.key}` });
    input.addEventListener('change', () => input.value !== (record[f.key] ?? '') && save_({ [f.key]: input.value }));
    const extra =
      f.key === 'followersOffered'
        ? (() => {
            const select = h('select', { 'data-key': `sod.${day}.${factionId}.decision`, onchange: (e) => save_({ followersDecision: e.target.value }) }, DECISIONS.map((d) => h('option', { value: d.value }, d.label)));
            select.value = record.followersDecision ?? '';
            return h('div', { class: 'row inline' }, h('span', { class: 'small muted' }, 'Accepted or refused:'), select);
          })()
        : null;
    return [h('label', {}, f.label), input, extra];
  });
  return [
    h('h2', {}, `Start of Day ${day}: ${factionName(world, factionId)}`),
    picker,
    connectivityBox(world, factionId),
    h('p', { class: 'muted small' }, "Optional. Saved at the top of this faction's Day Log for this day."),
    fields,
    record.text ? h('pre', { class: 'log-pre small' }, record.text) : null,
  ];
}
