// "Log a task" as a Task Card (CLAUDE.md, Task Cards): "Task: [description]".
// The Info pane holds the questions (who, how much Stamina, where, what
// happened); the Log pane shows the log it will write, editable. Nothing is
// spent until Accept.
import { h } from '../../ui/dom.js';
import { isPlayerView } from '../../ui/factionSelector.js';
import { dispatch } from '../../data/store.js';
import { placeOptions } from '../../data/places.js';
import { factionOptions } from '../../data/factions.js';
import { dayLogText } from '../../data/dayLog.js';
import { renderTaskCard, copyText } from '../../ui/taskCard.js';
import { resolveTask, taskLogText, taskBlocker, acceptTask } from './taskModel.js';
import { timeView as view } from './state.js';

export const SIMPLE_TASK_TYPE = { label: 'Task', icon: '✎' };

const factionColor = (world, c) => world.definitions.factions?.[c?.factionId]?.color ?? '';

function participantRows(world, draft, resolved, refresh) {
  return resolved.rows.map((r, i) =>
    h(
      'div',
      { class: r.overspend ? 'setup-row warn' : 'setup-row' },
      h(
        'div',
        { class: 'setup-line' },
        h('span', { class: 'setup-name' }, r.name),
        h('span', { class: 'muted small' }, `${r.remaining ?? '-'} left`),
        h('input', {
          type: 'number',
          class: 'tiny-input',
          min: 0,
          step: 1,
          value: r.p.stamina,
          title: 'Stamina spent on this task',
          'data-key': `task.stamina.${r.p.characterId}`,
          onchange: (e) => ((r.p.stamina = Math.max(0, Math.round(Number(e.target.value) || 0))), refresh()),
        }),
        h('span', { class: 'small' }, 'Stamina'),
        h('button', { class: 'btn tiny', title: 'Remove', onclick: () => (draft.participants.splice(i, 1), refresh()) }, 'x'),
      ),
    ),
  );
}

function setupForm(world, draft, resolved, refresh) {
  const taken = new Set(draft.participants.map((p) => p.characterId));
  const living = Object.values(world.characters).filter((c) => c.alive && !taken.has(c.id));
  const addSelect = h(
    'select',
    {
      'data-key': 'task.add',
      onchange: (e) => {
        const c = world.characters[e.target.value];
        if (c) draft.participants.push({ characterId: c.id, stamina: Math.min(1, c.staminaRemaining ?? 1) });
        if (c && !draft.ownerFactionId) draft.ownerFactionId = c.factionId ?? '';
        if (c && !draft.locationContainerId) draft.locationContainerId = c.locationContainerId || '';
        refresh();
      },
    },
    h('option', { value: '' }, '+ Add a character...'),
    living.map((c) => h('option', { value: c.id }, `${c.name} (${c.staminaRemaining ?? '-'}/${c.staminaMax ?? '-'} Stamina)`)),
  );
  const text = (field, placeholder, multiline = false) => {
    const input = multiline ? h('textarea', { rows: 2, value: draft[field], placeholder, 'data-key': `task.${field}` }) : h('input', { type: 'text', class: 'wide', value: draft[field], placeholder, 'data-key': `task.${field}` });
    input.addEventListener('change', () => ((draft[field] = input.value), refresh()));
    return input;
  };
  const place = h(
    'select',
    { class: 'wide', 'data-key': 'task.place', onchange: (e) => ((draft.locationContainerId = e.target.value), refresh()) },
    h('option', { value: '' }, 'No location'),
    placeOptions(world).map((o) => h('option', { value: o.value }, o.label)),
  );
  place.value = draft.locationContainerId;
  const owner = h(
    'select',
    { class: 'wide', 'data-key': 'task.owner', title: "Whose task it is: its log goes to that faction's Day Log", onchange: (e) => ((draft.ownerFactionId = e.target.value), refresh()) },
    h('option', { value: '' }, 'No faction'),
    factionOptions(world).map((o) => h('option', { value: o.value }, o.label)),
  );
  owner.value = draft.ownerFactionId ?? '';
  return [
    h('label', { class: 'small' }, 'For faction'),
    owner,
    h('label', { class: 'small' }, 'What is being done?'),
    text('description', 'e.g. Search for vines on the forest edge'),
    h('div', { class: 'task-pane-sub' }, `Who (${resolved.rows.length})`),
    participantRows(world, draft, resolved, refresh),
    addSelect,
    h('label', { class: 'small' }, 'Where?'),
    place,
    h('label', { class: 'small' }, 'Result'),
    text('result', 'e.g. Obito found no vines.', true),
    h('label', { class: 'small' }, 'Notes (optional)'),
    text('notes', 'Arbiter notes'),
    resolved.overspend.length
      ? h(
          'label',
          { class: 'check-label flag-text small' },
          h('input', { type: 'checkbox', checked: draft.staminaOverride, onchange: (e) => ((draft.staminaOverride = e.target.checked), refresh()) }),
          ` Override: let ${resolved.overspend.map((r) => r.name).join(', ')} spend more Stamina than they have left`,
        )
      : null,
  ];
}

export function renderTaskWindow(world, refresh) {
  const draft = view.task;
  // Characters that died or were removed since the task was opened drop out.
  draft.participants = draft.participants.filter((p) => world.characters[p.characterId]?.alive);
  const resolved = resolveTask(world, draft);
  const generated = taskLogText(world, draft, resolved);
  const log = draft.logText ?? generated;
  const blocker = taskBlocker(draft, resolved);
  const day = world.meta.currentDay;

  const accept = () => {
    view.task = null;
    dispatch(acceptTask(world, draft, resolved, log));
  };

  return renderTaskCard({
    type: SIMPLE_TASK_TYPE,
    name: draft.description.trim() || 'New task',
    members: resolved.rows.map((r) => ({ name: r.name, color: factionColor(world, r.character) })),
    bannerText: `Day ${day}`,
    infoBody: setupForm(world, draft, resolved, refresh),
    log: {
      title: `Log: Day ${day}`,
      text: log,
      readOnly: view.playerView,
      edited: draft.logText !== null,
      onEdit: (text) => ((draft.logText = text === generated ? null : text), refresh()),
      onReset: draft.logText !== null ? () => ((draft.logText = null), refresh()) : null,
      onCopyDay: (button) => copyText([dayLogText(world, day), log].filter(Boolean).join('\n\n'), button),
    },
    controls: h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn primary', disabled: !!blocker, title: blocker || 'Spend the Stamina and add the log to the Day Log (Ctrl+Z undoes it)', onclick: accept }, 'Accept'),
      h('button', { class: 'btn danger', onclick: () => confirm('Throw away this task? Nothing has been committed.') && ((view.task = null), refresh()) }, 'Cancel task'),
      blocker ? h('span', { class: 'muted small' }, blocker) : null,
    ),
    position: view.cardPos,
    onMove: (pos) => (view.cardPos = pos),
    playerView: view.playerView || isPlayerView(world), // the card's own toggle, or the top bar's
    onTogglePlayerView: () => ((view.playerView = !view.playerView), refresh()),
    onClose: () => ((view.cardOpen = false), refresh()),
  });
}
