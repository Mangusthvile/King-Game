// Log tab: the Day Log (each day's Resolution Logs and the Arbiter's
// narration, in order, ready to copy into the day's write-up) and the
// Action Log (every command applied to the world, newest first).
import { h, restoreFocus } from './dom.js';
import { dispatch } from '../data/store.js';
import { describeCommand } from '../commands/registry.js';
import { dayEntries, loggedDays, dayLogText, newEntry, addDayLogEntry, updateDayLogEntry, removeDayLogEntry } from '../data/dayLog.js';
import { copyText } from './taskCard.js';

// View state: which part of the tab and which day is shown (not saved).
const logView = { mode: 'day', day: null };

export function renderLogTab(world) {
  const root = h('div', { class: 'tab-page' });
  const refresh = () => {
    root.replaceChildren(toolbar(refresh), logView.mode === 'day' ? dayLog(world, refresh) : actionLog(world));
    if (root.isConnected) restoreFocus(root);
  };
  refresh();
  return root;
}

function toolbar(refresh) {
  const button = (mode, label) => h('button', { class: logView.mode === mode ? 'btn small active' : 'btn small', onclick: () => ((logView.mode = mode), refresh()) }, label);
  return h('div', { class: 'row' }, button('day', 'Day Log'), button('actions', 'Action Log'));
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// A box to add narration at a position in the day.
function narrationAdder(world, day, index) {
  const text = h('textarea', { rows: 2, placeholder: 'Narration...', 'data-key': `daylog.${day}.narrate.${index}` });
  return h(
    'details',
    { class: 'narration-adder' },
    h('summary', { class: 'muted small' }, '+ Narration here'),
    text,
    h('button', { class: 'btn small', onclick: () => text.value.trim() && dispatch(addDayLogEntry(world, day, newEntry('narration', text.value.trim()), index)) }, 'Add'),
  );
}

function entryBox(world, day, entry, i) {
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
      h('span', { class: 'label-tag stage-tag' }, entry.kind === 'narration' ? 'Narration' : `${capitalize(entry.method || 'resolution')} roll ${i}`),
      h('div', { class: 'spacer' }),
      copy,
      h('button', { class: 'btn small danger', title: 'Remove from the Day Log (does not undo the roll itself)', onclick: () => dispatch(removeDayLogEntry(world, day, entry.id)) }, 'x'),
    ),
    area,
  );
}

function dayLog(world, refresh) {
  const days = [...new Set([...loggedDays(world), world.meta.currentDay])].sort((a, b) => a - b);
  const day = days.includes(logView.day) ? logView.day : world.meta.currentDay;
  const entries = dayEntries(world, day);
  const daySelect = h(
    'select',
    { onchange: (e) => ((logView.day = Number(e.target.value)), refresh()) },
    days.map((d) => h('option', { value: d }, `Day ${d}${d === world.meta.currentDay ? ' (today)' : ''} - ${dayEntries(world, d).length} entries`)),
  );
  daySelect.value = day;
  const copyDay = h('button', { class: 'btn small primary', disabled: !entries.length, onclick: () => copyText(dayLogText(world, day), copyDay) }, 'Copy whole day');

  // Resolution entries are numbered per method ("project roll 2").
  const counts = {};
  const boxes = entries.map((entry) => {
    const n = entry.kind === 'resolution' ? (counts[entry.method] = (counts[entry.method] ?? 0) + 1) : 0;
    return entryBox(world, day, entry, n);
  });

  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `Day Log: Day ${day}`), h('div', { class: 'spacer' }), daySelect, copyDay),
    h('p', { class: 'muted small' }, 'Every accepted roll lands here. Edit any entry, add narration between them, then copy the whole day into your write-up.'),
    entries.length ? null : h('p', { class: 'muted' }, 'Nothing logged on this day yet.'),
    narrationAdder(world, day, 0),
    boxes.map((box, i) => [box, narrationAdder(world, day, i + 1)]),
  );
}

function actionLog(world) {
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
