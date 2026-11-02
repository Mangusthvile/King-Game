// The Projects tab: a form to create a Project, the list of all Projects
// (status, Workload bar, site, assigned characters), and the workday Task
// Card when one is open. The selected Project fills the right-hand panel.
import { h, restoreFocus } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { addRecord } from '../../commands/recordCommands.js';
import { progressBar } from '../../ui/taskCard.js';
import { PROJECT_SIZES, sizeLabel } from '../../rules/projects.js';
import { createProject, STATUSES, statusName, siteBuilding, assignedCharacters } from './projectModel.js';
import { renderProjectPanel } from './projectPanel.js';
import { renderWorkdayCard } from './workdayCard.js';
import { projectsView as view, selectProject } from './state.js';

export function renderProjectsTab(world, { detailPanel }) {
  // The Task Card window is positioned inside the whole center area (.content),
  // so it can be dragged right up to the side panel.
  const root = h('div', { class: 'tab-page wide-page projects-page' });
  // Redraws only this tab for view changes (workday edits, filters).
  // World changes redraw the whole screen anyway.
  const refresh = () => {
    if (view.workday && !world.projects[view.workday.projectId]) view.workday = null; // its Project was deleted or undone
    const showCard = view.workday && view.cardOpen;
    // The Task Card floats over the list as a window.
    root.replaceChildren(newProjectForm(world), projectList(world, refresh), showCard ? renderWorkdayCard(world, refresh) : '');
    // flat: panel sections may return nested lists; filter drops empty parts
    // (replaceChildren would print them as text).
    detailPanel.replaceChildren(...detail(world, refresh).flat(Infinity).filter(Boolean));
    if (root.isConnected) restoreFocus(document.body);
  };
  refresh();
  return root;
}

function detail(world, refresh) {
  const p = world.projects[view.selectedId];
  if (!p) {
    return [h('h2', {}, 'Projects'), h('p', { class: 'muted small' }, 'Create a Project, or click one in the list to edit it and start a workday.')];
  }
  return renderProjectPanel(world, p, refresh);
}

function newProjectForm(world) {
  const name = h('input', { type: 'text', placeholder: 'Project name', 'data-key': 'projects.newName' });
  const size = h(
    'select',
    { 'data-key': 'projects.newSize' },
    PROJECT_SIZES.map((s) => h('option', { value: s.id }, sizeLabel(s))),
  );
  size.value = 'moderate';
  return h(
    'form',
    {
      class: 'frame panel row',
      onsubmit: (e) => {
        e.preventDefault();
        const chosen = PROJECT_SIZES.find((s) => s.id === size.value);
        const p = createProject(world, { name: name.value.trim() || 'New Project', sizeLabel: chosen.name, workloadRequired: chosen.workload });
        selectProject(p.id);
        dispatch(addRecord('projects', p));
      },
    },
    h('strong', {}, 'New Project'),
    name,
    h('span', { class: 'muted small' }, 'Size'),
    size,
    h('button', { class: 'btn small primary', type: 'submit' }, '+ Create'),
    h('span', { class: 'muted small' }, 'The Workload can be changed to any value afterwards.'),
  );
}

const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]));

function projectList(world, refresh) {
  const all = Object.values(world.projects);
  const list = all
    .filter((p) => !view.statusFilter || p.status === view.statusFilter)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));
  const filter = h(
    'select',
    { title: 'Status', onchange: (e) => ((view.statusFilter = e.target.value), refresh()) },
    h('option', { value: '' }, 'All statuses'),
    STATUSES.map((s) => h('option', { value: s.id }, s.name)),
  );
  filter.value = view.statusFilter;

  return h(
    'section',
    { class: 'frame panel' },
    h('div', { class: 'row' }, h('h2', {}, `Projects (${list.length} of ${all.length})`), h('div', { class: 'spacer' }), filter),
    list.length
      ? [
          h('div', { class: 'project-row project-header small muted' }, ['Name', 'Status', 'Workload', 'Site', 'Assigned'].map((t) => h('span', {}, t))),
          list.map((p) => projectRow(world, p, refresh)),
        ]
      : h('p', { class: 'muted small' }, all.length ? 'No Project has this status.' : 'No Projects yet. Create one above.'),
  );
}

function projectRow(world, p, refresh) {
  const building = siteBuilding(world, p);
  const people = assignedCharacters(world, p.id);
  const drafting = view.workday?.projectId === p.id;
  return h(
    'button',
    { class: `project-row${p.id === view.selectedId ? ' selected' : ''}`, onclick: () => (selectProject(p.id), refresh()) },
    h('span', { class: 'roster-name' }, p.name, drafting ? h('span', { class: 'flag-text small' }, ' (workday open)') : null),
    h('span', { class: `status-chip status-${p.status}` }, statusName(p.status)),
    progressBar(p.workloadCurrent, p.workloadRequired),
    h('span', { class: 'small ellipsis' }, building?.name ?? world.containers[p.locationContainerId]?.name ?? '-'),
    h('span', { class: 'small ellipsis', title: people.map((c) => c.name).join(', ') }, people.length ? people.map((c) => c.name).join(', ') : '-'),
  );
}
