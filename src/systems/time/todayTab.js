// Realm > Today, in three screens:
//   Overview:    the end-of-day readiness summary (per faction) and every
//                living character of the selected faction (Stamina,
//                assignment, Hunger, Thirst, conditions)
//   Tasks:       Log a task (the Task Card) and what the faction did today
//                (simple tasks, Project workdays, transfers)
//   Advance Day: the Advance Day wizard
// The side panel holds the Player faction's Start of Day record. The time
// controls (Reverse Day, Set Day, snapshots) are in Chronicle > History.
import { h, restoreFocus } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { navigate } from '../../ui/navigation.js';
import { factionEntries } from '../../data/dayLog.js';
import { activeFactionIds, factionName, factionColor } from '../../data/factions.js';
import { swatchStyle } from '../../ui/colors.js';
import { selectedFactionId } from '../../ui/factionSelector.js';
import { selectCharacter } from '../characters/state.js';
import { selectProject } from '../projects/state.js';
import { readiness, livingCharacters, openDrafts } from './readiness.js';
import { newTaskDraft, removeTask } from './taskModel.js';
import { renderTaskWindow } from './taskWindow.js';
import { renderStartOfDay } from './startOfDay.js';
import { createPlan } from './advancePlan.js';
import { renderAdvanceWizard } from './advanceWizard.js';
import { timeView as view } from './state.js';

const onProject = (world, c) => !!world.projects[c.assignmentProjectId];

const FILTERS = {
  all: { label: 'Everyone', test: () => true },
  stamina: { label: 'Has Stamina left', test: (w, c) => (c.staminaRemaining ?? 0) > 0 },
  idle: { label: 'Idle', title: 'No Project and no current assignment', test: (w, c) => !onProject(w, c) && !(c.currentAssignment ?? '').trim() },
  project: { label: 'On a Project', test: (w, c) => onProject(w, c) },
};

// One screen of Realm > Today; path ends in overview, tasks or advanceDay.
export function renderToday(world, { detailPanel, path }) {
  const screen = path.split('/')[2];
  const root = h('div', { class: 'tab-page wide-page today-page' });
  const refresh = () => {
    if (screen === 'advanceDay') root.replaceChildren(view.wizard ? renderAdvanceWizard(world, refresh) : advanceStart(world, refresh));
    else if (screen === 'tasks') root.replaceChildren(header(world, refresh, true), activityPanel(world), view.task && view.cardOpen ? renderTaskWindow(world, refresh) : '');
    else root.replaceChildren(header(world, refresh, false), readinessPanel(world), characterPanel(world, refresh));
    detailPanel.replaceChildren(...renderStartOfDay(world, selectedFactionId(world)).flat(Infinity).filter(Boolean));
    if (root.isConnected) restoreFocus(root);
  };
  refresh();
  return root;
}

function header(world, refresh, withTask) {
  const openTask = () => {
    view.task ??= newTaskDraft(selectedFactionId(world));
    view.cardOpen = true;
    refresh();
  };
  return h(
    'section',
    { class: 'frame panel' },
    h(
      'div',
      { class: 'row' },
      h('h2', {}, `Today: Day ${world.meta.currentDay}`, selectedFactionId(world) ? ` - ${factionName(world, selectedFactionId(world))}` : ' - all factions'),
      h('div', { class: 'spacer' }),
      withTask ? h('button', { class: 'btn', title: 'Stamina spent on something with no Resolution Method yet (searching, teaching, scouting...)', onclick: openTask }, view.task ? 'Resume task' : 'Log a task') : null,
    ),
  );
}

// Advance Day before the wizard is open: one button to start it.
function advanceStart(world, refresh) {
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, `Advance Day: end Day ${world.meta.currentDay}`),
    h('p', { class: 'muted small' }, 'Ends the day for every faction (the Day is shared). Every step is a proposal you can change or skip; nothing changes until Accept.'),
    h('button', { class: 'btn primary arbiter-only', onclick: () => ((view.wizard = createPlan(world)), refresh()) }, `Start Advance Day (Day ${world.meta.currentDay} -> ${world.meta.currentDay + 1})`),
  );
}

// One faction's chips.
function readinessRow(world, r, labelled) {
  const chip = (warn, text, title = '') => h('span', { class: warn ? 'ready-chip warn' : 'ready-chip', title }, text);
  return h(
    'div',
    { class: 'row ready-row' },
    labelled ? h('span', { class: 'team-chip', style: swatchStyle(factionColor(world, r.factionId)) }, factionName(world, r.factionId)) : null,
    chip(r.unspent.length > 0, `${r.unspent.length} with unspent Stamina`, r.unspent.map((c) => `${c.name}: ${c.staminaRemaining}`).join('\n')),
    chip(r.idleProjects.length > 0, `${r.idleProjects.length} active Project(s) with no workday today`, r.idleProjects.map((p) => p.name).join('\n')),
    r.trackNeeds ? chip(r.foodHave < r.foodNeed, `Food ${r.foodHave} available / ${r.foodNeed} needed`) : h('span', { class: 'muted small' }, 'Needs not tracked'),
    r.atRisk.length ? chip(true, `${r.atRisk.length} at Hunger 0`, r.atRisk.map((c) => c.name).join('\n')) : null,
  );
}

// Per faction: the selected one, or every faction with living characters.
function readinessPanel(world) {
  const selected = selectedFactionId(world);
  const list = (selected ? [selected] : activeFactionIds(world)).map((fid) => readiness(world, fid));
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'End of day readiness'),
    list.map((r) => readinessRow(world, r, !selected)),
    list.flatMap((r) => r.idleProjects).length ? h('p', { class: 'muted small' }, `No workday today: ${list.flatMap((r) => r.idleProjects).map((p) => p.name).join(', ')}`) : null,
    openDrafts(world).map((t) => h('p', { class: 'flag-text small' }, t)),
  );
}

function conditionBadges(c) {
  return h(
    'span',
    { class: 'roster-conditions' },
    (c.conditions ?? []).map((cond) =>
      h(
        'span',
        { class: 'condition-badge', title: [cond.name, cond.modifier, cond.durationDays ? `${cond.durationDays} day(s) left` : '', cond.note].filter(Boolean).join('\n') },
        (cond.name || '?').slice(0, 2),
      ),
    ),
  );
}

function assignmentText(world, c) {
  const project = world.projects[c.assignmentProjectId];
  if (project) return `Project: ${project.name}`;
  return (c.currentAssignment ?? '').trim() || 'Idle';
}

function characterRow(world, c) {
  const pair = (v) => `${v?.current ?? '-'}/${v?.max ?? '-'}`;
  const color = factionColor(world, c.factionId);
  return h(
    'div',
    { class: 'today-row' },
    h('button', { class: 'link-button roster-name', title: `Open the stat sheet (${factionName(world, c.factionId)})`, style: color ? `--swatch: ${color}` : null, onclick: () => (selectCharacter(c.id), navigate({ tab: 'characters' })) }, c.name),
    h('span', { class: (c.staminaRemaining ?? 0) > 0 ? 'meter speed' : 'meter speed spent', title: 'Stamina remaining / max' }, `${c.staminaRemaining ?? '-'}/${c.staminaMax ?? '-'}`),
    h('span', { class: 'small ellipsis', title: assignmentText(world, c) }, assignmentText(world, c)),
    h('span', { class: c.hunger?.current === 0 ? 'meter hunger warn' : 'meter hunger', title: 'Hunger current / max' }, `H ${pair(c.hunger)}`),
    h('span', { class: 'meter thirst', title: 'Thirst current / max' }, `T ${pair(c.thirst)}`),
    conditionBadges(c),
  );
}

function characterPanel(world, refresh) {
  const living = livingCharacters(world, selectedFactionId(world));
  const filter = FILTERS[view.filter] ?? FILTERS.all;
  const list = living.filter((c) => filter.test(world, c));
  return h(
    'section',
    { class: 'frame panel' },
    h(
      'div',
      { class: 'row' },
      h('h2', {}, `Characters (${list.length} of ${living.length} living)`),
      h('div', { class: 'spacer' }),
      Object.entries(FILTERS).map(([id, f]) => h('button', { class: view.filter === id ? 'btn small active' : 'btn small', title: f.title ?? '', onclick: () => ((view.filter = id), refresh()) }, f.label)),
    ),
    list.length
      ? [h('div', { class: 'today-row today-header muted small' }, ['Name', 'Stamina', 'Assignment', 'Hunger', 'Thirst', 'Conditions'].map((t) => h('span', {}, t))), list.map((c) => characterRow(world, c))]
      : h('p', { class: 'muted small' }, living.length ? 'Nobody matches this filter.' : 'No living characters.'),
  );
}

// Today's simple tasks and Resolution Logs (Project workdays...), from the
// Day Log, in order.
function activityPanel(world) {
  const day = world.meta.currentDay;
  const entries = factionEntries(world, day, selectedFactionId(world)).filter((e) => ['resolution', 'task', 'transfer'].includes(e.kind));
  const rows = entries.map((e) => {
    const task = e.kind === 'task' ? world.tasks?.[e.refId] : null;
    const project = e.method === 'project' ? world.projects[e.refId] : null;
    const title = e.text.split('\n').find((l) => /[a-z0-9]/i.test(l)) ?? ''; // skips "=====" lines
    return h(
      'div',
      { class: 'activity-row' },
      h('span', { class: 'label-tag stage-tag' }, task ? 'Task' : e.kind === 'transfer' ? 'Transfer' : e.method || 'Roll'),
      h('span', { class: 'small ellipsis', title: e.text }, title),
      task ? h('span', { class: 'muted small' }, task.participants.map((p) => `${p.name} ${p.stamina}`).join(', ')) : null,
      project ? h('button', { class: 'btn tiny', onclick: () => (selectProject(project.id), navigate({ tab: 'projects' })) }, 'Open Project') : null,
      task ? h('button', { class: 'btn tiny danger', title: 'Delete the task, give its Stamina back and remove its log (Ctrl+Z undoes it)', onclick: () => dispatch(removeTask(world, task)) }, 'Remove') : null,
    );
  });
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, `Done today (${rows.length})`),
    rows.length ? rows : h('p', { class: 'muted small' }, 'Nothing yet. Project workdays and logged tasks appear here.'),
  );
}
