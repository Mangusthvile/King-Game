// Time controls on the Today tab: Set Day, Reverse Day, and the list of
// end-of-day snapshots (data/snapshots.js). Reverse Day replaces the whole
// world with a snapshot after a confirmation; the world as it was just
// before is kept as a snapshot, so "Undo Reverse Day" can take it back.
import { h } from '../../ui/dom.js';
import { dispatch, replaceWorld } from '../../data/store.js';
import { openDialog } from '../../ui/dialog.js';
import { setCurrentDay } from '../../commands/worldCommands.js';
import { migrateWorld } from '../../data/migrations.js';
import { latestDayEnd, beforeRestoreSnapshot, restoreLosses, restoreSnapshot, snapshotsKept } from '../../data/snapshots.js';
import { timeView } from './state.js';

function lossText(world, snapshot) {
  const loss = restoreLosses(world, snapshot);
  const lost = [
    ...loss.advances.map((day) => `the Advance Day that ended Day ${day}`),
    loss.others ? `${loss.others} other action(s) taken on Day ${loss.otherDays.join(', Day ')} (Stamina spent, workdays, tasks, Day Log entries and edits)` : null,
  ].filter(Boolean);
  return [
    `The world goes back to: ${snapshot.label} (saved ${new Date(snapshot.takenAt).toLocaleString()}).`,
    `Current day: Day ${loss.fromDay} -> Day ${snapshot.day}.`,
    lost.length ? `Lost: ${lost.join('; ')}.` : 'Nothing was done since this snapshot.',
  ];
}

function restore(world, snapshot) {
  const isUndo = snapshot.kind === 'beforeRestore';
  openDialog({
    title: isUndo ? 'Undo Reverse Day?' : `Reverse to Day ${snapshot.day}?`,
    body: [
      ...lossText(world, snapshot).map((t) => h('p', {}, t)),
      h('p', { class: 'muted small' }, 'The world as it is now is kept as a snapshot, so you can take this back with "Undo Reverse Day". Ctrl+Z cannot undo it.'),
    ],
    buttons: [
      {
        label: isUndo ? 'Undo Reverse Day' : 'Reverse Day',
        primary: true,
        onClick: () => {
          timeView.task = null;
          timeView.wizard = null;
          replaceWorld(migrateWorld(restoreSnapshot(world, snapshot.id)), 'reverseDay');
        },
      },
      { label: 'Cancel' },
    ],
  });
}

function setDayForm(world) {
  const input = h('input', { type: 'number', class: 'short-input', step: 1, value: world.meta.currentDay });
  return h(
    'form',
    {
      class: 'row',
      onsubmit: (e) => {
        e.preventDefault();
        const day = Number(input.value);
        if (Number.isInteger(day) && day !== world.meta.currentDay) dispatch(setCurrentDay(world, day));
      },
    },
    h('span', { class: 'small' }, 'Set Day'),
    input,
    h('button', { class: 'btn small', type: 'submit', title: 'Change the day number only (nothing else changes; Ctrl+Z undoes it)' }, 'Set'),
  );
}

export function renderTimeControls(world) {
  const latest = latestDayEnd(world);
  const undoSnapshot = beforeRestoreSnapshot(world);
  const dayEnds = world.log.snapshots.filter((s) => s.kind === 'dayEnd').reverse();
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Time'),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn', disabled: !latest, title: latest ? `Go back to ${latest.label}` : 'No snapshot yet: one is saved at every Advance Day', onclick: () => restore(world, latest) }, latest ? `Reverse Day (to Day ${latest.day})` : 'Reverse Day'),
      undoSnapshot ? h('button', { class: 'btn', title: `Go back to ${undoSnapshot.label}`, onclick: () => restore(world, undoSnapshot) }, 'Undo Reverse Day') : null,
      h('div', { class: 'spacer' }),
      setDayForm(world),
    ),
    h('p', { class: 'muted small' }, `Undo and redo work within the day. A snapshot is saved at every Advance Day; the newest ${snapshotsKept(world)} are kept (change it in Settings).`),
    dayEnds.length
      ? h(
          'details',
          {},
          h('summary', { class: 'small' }, `Snapshots (${dayEnds.length})`),
          h('ul', { class: 'wizard-list' }, dayEnds.map((s) => h('li', { class: 'row' }, h('span', { class: 'small' }, `${s.label} - ${new Date(s.takenAt).toLocaleString()}`), h('button', { class: 'btn tiny', onclick: () => restore(world, s) }, 'Go back here')))),
        )
      : null,
  );
}
