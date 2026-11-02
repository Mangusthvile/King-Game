// Where Projects show up outside their own tab:
//   Area panel:      "Projects here" (Projects located in that Area)
//   building panel:  the building's Project, with Open
//   character sheet: the Project the character is assigned to (active ones)
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { navigate } from '../../ui/navigation.js';
import { registerInfoSection } from '../../ui/infoSections.js';
import { progressBar } from '../../ui/taskCard.js';
import { statusName, assignToProject } from './projectModel.js';
import { selectProject } from './state.js';

const open = (id) => {
  selectProject(id);
  navigate({ tab: 'projects' });
};

function projectChip(p) {
  return h('button', { class: 'chip chip-button', title: 'Open in the Projects tab', onclick: () => open(p.id) }, p.name, h('span', { class: 'muted' }, ` ${p.workloadCurrent}/${p.workloadRequired} ${statusName(p.status)}`));
}

export function registerProjectLinks() {
  registerInfoSection('area', (world, area) => {
    const here = Object.values(world.projects).filter((p) => p.locationContainerId === area.id);
    return [
      h('label', {}, `Projects here (${here.length})`),
      here.length ? h('div', { class: 'chip-list' }, here.map(projectChip)) : h('p', { class: 'muted small' }, 'No Projects located here.'),
    ];
  });

  registerInfoSection('building', (world, b) => {
    const p = world.projects[b.projectId];
    return [
      h('label', {}, 'Project'),
      p
        ? h('div', {}, h('div', { class: 'row' }, projectChip(p)), progressBar(p.workloadCurrent, p.workloadRequired), p.driveBuilding ? h('p', { class: 'muted small' }, 'Its progress sets this building\'s construction progress.') : null)
        : h('p', { class: 'muted small' }, 'None. Link one from the Projects tab (Building site).'),
    ];
  });

  // "Current assignment" links to an active Project. The current link is
  // always shown, even if that Project is no longer active.
  registerInfoSection('character', (world, c) => {
    const current = world.projects[c.assignmentProjectId];
    const options = Object.values(world.projects).filter((p) => p.status === 'active' || p.id === c.assignmentProjectId);
    const select = h(
      'select',
      { class: 'wide', 'data-key': `${c.id}.assignmentProject`, onchange: (e) => dispatch(assignToProject(world, c, e.target.value)) },
      h('option', { value: '' }, '(no Project)'),
      options.map((p) => h('option', { value: p.id }, `${p.name}${p.status === 'active' ? '' : ` (${statusName(p.status)})`}`)),
      c.assignmentProjectId && !current ? h('option', { value: c.assignmentProjectId }, '(deleted Project)') : null,
    );
    select.value = c.assignmentProjectId ?? '';
    return [
      h('label', {}, 'Assigned Project (active Projects)'),
      h('div', { class: 'row' }, select, current ? h('button', { class: 'btn small', onclick: () => open(current.id) }, 'Open') : null),
    ];
  });
}
