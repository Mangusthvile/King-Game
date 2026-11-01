// Log tab: every command applied to the world, newest first.
import { h } from './dom.js';
import { describeCommand } from '../commands/registry.js';

export function renderLogTab(world) {
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
    'div',
    { class: 'tab-page' },
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, 'Action Log'),
      h(
        'p',
        { class: 'muted' },
        `${actions.length} action(s). ${redo.length} undone action(s) can be redone.`,
      ),
      rows.length ? h('ol', { class: 'log-list' }, rows) : h('p', { class: 'muted' }, 'Nothing has happened yet.'),
    ),
  );
}
