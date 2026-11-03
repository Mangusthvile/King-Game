// The Day Log and Action Log screens (Chronicle, see systems/chronicle):
//   dayLog:     each day's entries in order (Resolution Logs, tasks,
//               transfers, Advance Day summaries, narration) for the faction
//               the top bar selects, editable, with Copy whole day
//   copyDayPage: the whole day as one text box, ready to copy
//   actionLog:  every command applied to the world, newest first
import { h } from './dom.js';
import { dispatch } from '../data/store.js';
import { describeCommand } from '../commands/registry.js';
import { dayEntries, factionEntries, loggedDays, dayLogText, newEntry, addDayLogEntry, updateDayLogEntry, removeDayLogEntry, startOfDay } from '../data/dayLog.js';
import { factionName, factionColor } from '../data/factions.js';
import { selectedFactionId } from './factionSelector.js';
import { swatchStyle } from './colors.js';
import { copyText } from './taskCard.js';

// View state: which day is shown (not saved), shared by By Day and Copy Day.
const logView = { day: null };

// The days with a Day Log, plus today, and the one shown.
function dayChoice(world) {
  const days = [...new Set([...loggedDays(world), world.meta.currentDay])].sort((a, b) => a - b);
  return { days, day: days.includes(logView.day) ? logView.day : world.meta.currentDay };
}

// Copy Day: the selected faction's day (or every faction's under a heading)
// as one text box, ready to paste into the day's write-up.
export function copyDayPage(world, refresh) {
  const factionId = selectedFactionId(world);
  const { days, day } = dayChoice(world);
  const text = dayLogText(world, day, factionId);
  const select = h('select', { onchange: (e) => ((logView.day = Number(e.target.value)), refresh()) }, days.map((d) => h('option', { value: d }, `Day ${d}${d === world.meta.currentDay ? ' (today)' : ''}`)));
  select.value = day;
  const area = h('textarea', { class: 'day-log-text', rows: 28, value: text, spellcheck: false, readOnly: true });
  const copy = h('button', { class: 'btn primary', disabled: !text, onclick: () => copyText(text, copy) }, 'Copy whole day');
  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `Copy Day ${day}`, factionId ? ` - ${factionName(world, factionId)}` : ' - all factions'), h('div', { class: 'spacer' }), select, copy),
    h('p', { class: 'muted small' }, factionId ? "This faction's day: its Start of Day, then its entries in order." : 'Every faction under its own heading. Pick a faction in the top bar to copy only its day. Edit entries in By Day.'),
    text ? area : h('p', { class: 'muted' }, 'Nothing logged on this day yet.'),
  );
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// A box to add narration at a position in the day (index into the whole
// day's entry list). It belongs to the faction the selector shows.
function narrationAdder(world, day, index, factionId) {
  const text = h('textarea', { rows: 2, placeholder: 'Narration...', 'data-key': `daylog.${day}.narrate.${index}` });
  return h(
    'details',
    { class: 'narration-adder' },
    h('summary', { class: 'muted small' }, '+ Narration here'),
    text,
    h('button', { class: 'btn small', onclick: () => text.value.trim() && dispatch(addDayLogEntry(world, day, newEntry('narration', text.value.trim(), { factionId }), index)) }, 'Add'),
  );
}

// The tag on an entry: "Project roll 2", "Task 1", "Day ended", "Narration".
function entryLabel(entry, i) {
  if (entry.kind === 'narration') return 'Narration';
  if (entry.kind === 'task') return `Task ${i}`;
  if (entry.kind === 'dayEnd') return 'Day ended';
  if (entry.kind === 'transfer') return 'Transfer';
  return `${capitalize(entry.method || 'resolution')} roll ${i}`;
}

// A Player faction's Start of Day record (edited on the Today tab).
function startOfDayBox(world, day, factionId, labelled) {
  const text = startOfDay(world, day, factionId)?.text ?? '';
  if (!text) return null;
  const copy = h('button', { class: 'btn small', onclick: () => copyText(text, copy) }, 'Copy');
  return h(
    'div',
    { class: 'day-log-entry start-of-day' },
    h('div', { class: 'row' }, h('span', { class: 'label-tag stage-tag' }, 'Start of Day'), labelled ? factionChip(world, factionId) : null, h('span', { class: 'muted small' }, 'Edit it on the Today tab (for the current day).'), h('div', { class: 'spacer' }), copy),
    h('pre', { class: 'log-pre' }, text),
  );
}

const factionChip = (world, factionId) => h('span', { class: 'team-chip', style: swatchStyle(factionColor(world, factionId)) }, factionId ? factionName(world, factionId) : 'Every faction');

function entryBox(world, day, entry, i, labelled) {
  const area = h('textarea', { class: 'day-log-text', value: entry.text, spellcheck: false, 'data-key': `daylog.${entry.id}` });
  // Size the box to its text so the day reads like one document.
  area.rows = Math.min(40, entry.text.split('\n').length + 1);
  area.addEventListener('change', () => area.value !== entry.text && dispatch(updateDayLogEntry(world, day, entry.id, area.value)));
  const copy = h('button', { class: 'btn small', onclick: () => copyText(area.value, copy) }, 'Copy');
  return h(
    'div',
    { class: `day-log-entry ${entry.kind}` },
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'label-tag stage-tag' }, entryLabel(entry, i)),
      labelled ? factionChip(world, entry.factionId) : null,
      h('div', { class: 'spacer' }),
      copy,
      h('button', { class: 'btn small danger arbiter-only', title: 'Remove from the Day Log (does not undo the roll itself)', onclick: () => dispatch(removeDayLogEntry(world, day, entry.id)) }, 'x'),
    ),
    area,
  );
}

// The selected faction's day (or every faction's, each entry labelled).
export function dayLog(world, refresh) {
  const factionId = selectedFactionId(world);
  const all = !factionId;
  const { days, day } = dayChoice(world);
  const sodIds = (d) => (all ? Object.keys(world.dayLogs?.[String(d)]?.startOfDays ?? {}) : [factionId]);
  // Entries plus Start of Day records, for the day picker.
  const count = (d) => factionEntries(world, d, factionId).length + sodIds(d).filter((id) => startOfDay(world, d, id)?.text).length;
  const everything = dayEntries(world, day);
  const shown = everything.filter((e) => factionEntries(world, day, factionId).includes(e));
  const sods = sodIds(day).map((id) => startOfDayBox(world, day, id, all)).filter(Boolean);
  const daySelect = h(
    'select',
    { onchange: (e) => ((logView.day = Number(e.target.value)), refresh()) },
    days.map((d) => h('option', { value: d }, `Day ${d}${d === world.meta.currentDay ? ' (today)' : ''} - ${count(d)} entries`)),
  );
  daySelect.value = day;
  const copyDay = h(
    'button',
    { class: 'btn small primary', disabled: !shown.length && !sods.length, title: all ? 'Every faction, each under a heading' : `${factionName(world, factionId)} only`, onclick: () => copyText(dayLogText(world, day, factionId), copyDay) },
    'Copy whole day',
  );

  // Resolution entries and tasks are numbered per method ("project roll 2").
  const counts = {};
  const boxes = shown.map((entry) => {
    const n = entry.kind === 'resolution' || entry.kind === 'task' ? (counts[entry.method] = (counts[entry.method] ?? 0) + 1) : 0;
    return entryBox(world, day, entry, n, all);
  });

  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `Day Log: Day ${day}`, all ? ' - all factions' : ` - ${factionName(world, factionId)}`), h('div', { class: 'spacer' }), daySelect, copyDay),
    h('p', { class: 'muted small' }, 'Every accepted roll, task, transfer and Advance Day summary lands here. Edit any entry, add narration between them, then copy the whole day into your write-up.'),
    sods,
    shown.length || sods.length ? null : h('p', { class: 'muted' }, 'Nothing logged on this day yet.'),
    narrationAdder(world, day, shown.length ? everything.indexOf(shown[0]) : everything.length, factionId),
    boxes.map((box, i) => [box, narrationAdder(world, day, everything.indexOf(shown[i]) + 1, factionId)]),
  );
}

export function actionLog(world) {
  const { actions, redo } = world.log;
  const rows = [...actions].reverse().map((entry) =>
    h(
      'li',
      { class: entry.dayBoundary ? 'log-entry boundary' : 'log-entry' },
      h('span', { class: 'log-day' }, `Day ${entry.day}`),
      h('span', { class: 'muted small' }, new Date(entry.time).toLocaleTimeString()),
      h('span', {}, describeCommand(entry.type, entry.payload)),
    ),
  );
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Action Log'),
    h('p', { class: 'muted' }, `${actions.length} action(s). ${redo.length} undone action(s) can be redone.`),
    rows.length ? h('ol', { class: 'log-list' }, rows) : h('p', { class: 'muted' }, 'Nothing has happened yet.'),
  );
}
