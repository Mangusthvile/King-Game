// The selected Project in the right-hand panel: every field editable, the
// building site link, assigned characters, requirements, the workday
// history, and Start workday.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { textField, selectField, checkboxField, fieldSetter } from '../../ui/fields.js';
import { renderCustomFields } from '../../ui/customFieldsEditor.js';
import { progressBar, copyText } from '../../ui/taskCard.js';
import { enterContainer } from '../../ui/navigation.js';
import { rememberSelection } from '../../map/mapView.js';
import { placeOptions } from '../../data/places.js';
import { PROJECT_SIZES, sizeLabel, isWorkloadReached } from '../../rules/projects.js';
import { stageName, shownStage } from '../buildings/stages.js';
import { STATUSES, setWorkload, setSize, setDriveBuilding, linkBuilding, markComplete, deleteProject, assignToProject, assignedCharacters, siteBuilding, unmetRequirements } from './projectModel.js';
import { requirementsEditor } from './requirementsEditor.js';
import { newDraft } from './workdayDraft.js';
import { projectsView as view } from './state.js';

function workloadFields(world, p) {
  const box = (field) =>
    h('input', {
      type: 'number',
      step: 1,
      min: 0,
      value: p[field],
      class: 'short-input',
      'data-key': `${p.id}.${field}`,
      onchange: (e) => {
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isInteger(n) && n >= 0) {
          if (n !== p[field]) dispatch(setWorkload(world, p, field, n));
        } else e.target.value = p[field];
      },
    });
  const size = PROJECT_SIZES.find((s) => s.name === p.sizeLabel);
  const sizeSelect = h(
    'select',
    {
      class: 'wide',
      'data-key': `${p.id}.size`,
      onchange: (e) => {
        const chosen = PROJECT_SIZES.find((s) => s.id === e.target.value);
        if (chosen) dispatch(setSize(world, p, chosen));
      },
    },
    !size ? h('option', { value: '' }, p.sizeLabel ? `${p.sizeLabel} (custom)` : '(not set)') : null,
    PROJECT_SIZES.map((s) => h('option', { value: s.id }, sizeLabel(s))),
  );
  sizeSelect.value = size?.id ?? '';
  const between = size && size.workload !== p.workloadRequired && !(size.orMore && p.workloadRequired > size.workload);

  return [
    h('label', {}, 'Project Size'),
    sizeSelect,
    between ? h('p', { class: 'muted small' }, `Workload set by hand (${size.name} is ${size.workload}).`) : null,
    h('label', {}, 'Current Workload / Workload required'),
    h('div', { class: 'row' }, box('workloadCurrent'), h('span', { class: 'muted' }, '/'), box('workloadRequired')),
    progressBar(p.workloadCurrent, p.workloadRequired),
    isWorkloadReached(p.workloadCurrent, p.workloadRequired) && p.status !== 'complete'
      ? h(
          'div',
          { class: 'helper-box' },
          h('p', { class: 'ok-text' }, 'The Workload is reached.'),
          h('p', { class: 'small muted' }, siteBuilding(world, p) && p.driveBuilding ? 'Mark the Project complete and its building Completed?' : 'Mark the Project complete?'),
          h('button', { class: 'btn small primary', onclick: () => dispatch(markComplete(world, p)) }, 'Mark complete'),
        )
      : null,
  ];
}

function siteFields(world, p) {
  const objects = Object.values(world.placedObjects).filter((o) => o.kind === 'building' && world.buildings[o.refId]);
  const options = objects.map((o) => {
    const b = world.buildings[o.refId];
    const where = [world.containers[o.containerId]?.name, world.containers[b.areaId]?.name].filter(Boolean).join(' / ');
    const taken = b.projectId && b.projectId !== p.id ? ` [${world.projects[b.projectId]?.name ?? 'other Project'}]` : '';
    return { value: b.id, label: `${b.name} (${where})${taken}` };
  });
  const building = siteBuilding(world, p);
  const obj = building ? objects.find((o) => o.refId === building.id) : null;
  const type = building ? world.definitions.buildingTypes[building.buildingTypeId] : null;

  return [
    h('h3', {}, 'Building site'),
    ...selectField('Site', p.siteBuildingId, [{ value: '', label: '(none)' }, ...options], (id) => dispatch(linkBuilding(world, p, id)), {
      key: `${p.id}.site`,
      missingLabel: () => '(removed building)',
    }),
    building
      ? [
          ...checkboxField('Project progress drives the building', p.driveBuilding, (on) => dispatch(setDriveBuilding(world, p, on)), {
            key: `${p.id}.drive`,
            title: "Sets the building's construction progress to Current / Required Workload. Untick to set it by hand.",
          }),
          h(
            'div',
            { class: 'row small' },
            h('span', {}, `${building.constructionProgress}%`),
            h('span', { class: 'label-tag stage-tag' }, stageName(shownStage(building, type))),
            building.forcedStage ? h('span', { class: 'muted' }, '(forced)') : null,
            obj ? h('button', { class: 'btn small', onclick: () => (rememberSelection(obj.containerId, obj.id), enterContainer(world, obj.containerId)) }, 'Show on map') : null,
          ),
        ]
      : h('p', { class: 'muted small' }, 'Link a building placed on a Biome Map to show this Project as its construction.'),
    ...selectField('Location', p.locationContainerId, [{ value: '', label: '(not set)' }, ...placeOptions(world)], fieldSetter(world, 'projects', p.id, 'locationContainerId'), {
      key: `${p.id}.location`,
      missingLabel: () => '(removed place)',
    }),
  ];
}

function assignedFields(world, p) {
  const people = assignedCharacters(world, p.id);
  const others = Object.values(world.characters).filter((c) => c.alive && c.assignmentProjectId !== p.id);
  const select = h(
    'select',
    { 'data-key': `${p.id}.assign` },
    h('option', { value: '' }, 'Choose a character...'),
    others.map((c) => h('option', { value: c.id }, `${c.name}${c.assignmentProjectId ? ` (now on ${world.projects[c.assignmentProjectId]?.name ?? 'another Project'})` : ''}`)),
  );
  return [
    h('label', {}, `Assigned characters (${people.length})`),
    h(
      'div',
      { class: 'chip-list' },
      people.length
        ? people.map((c) => h('span', { class: 'chip' }, c.name, h('button', { class: 'chip-x', title: 'Unassign', onclick: () => dispatch(assignToProject(world, c, '')) }, 'x')))
        : h('span', { class: 'muted small' }, 'Nobody assigned.'),
    ),
    h('div', { class: 'row chip-add' }, select, h('button', { class: 'btn small', onclick: () => select.value && dispatch(assignToProject(world, world.characters[select.value], p.id)) }, 'Assign')),
  ];
}

function startWorkday(world, p, refresh) {
  if (view.workday && view.workday.projectId !== p.id) {
    const other = world.projects[view.workday.projectId];
    if (!confirm(`A workday on "${other?.name}" is still open. Throw it away and start one here?`)) return;
  }
  if (view.workday?.projectId !== p.id) view.workday = newDraft(world, p);
  view.cardOpen = true;
  refresh();
}

function workdayButton(world, p, refresh) {
  const unmet = unmetRequirements(p);
  const open = view.workday?.projectId === p.id;
  return [
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => startWorkday(world, p, refresh) }, open ? 'Resume workday' : `Start workday (Day ${world.meta.currentDay})`),
    ),
    unmet.length ? h('p', { class: 'small flag-text' }, `${unmet.length} requirement(s) not met. You can start anyway.`) : null,
  ];
}

function history(world, p) {
  if (!p.workdays.length) return h('p', { class: 'muted small' }, 'No workdays yet.');
  return [...p.workdays].reverse().map((w) => {
    const copy = h('button', { class: 'btn small', onclick: () => copyText(w.log, copy) }, 'Copy log');
    return h(
      'details',
      { class: 'workday-entry' },
      h(
        'summary',
        { class: 'small' },
        `Day ${w.day}: +${w.total} work, ${w.eventName} (${w.eventRoll ?? '-'}), ${w.workloadBefore} → ${w.workloadAfter}`,
      ),
      h('p', { class: 'muted small' }, w.participants.map((x) => `${x.name} ${x.stamina}d${x.die}: ${x.rolls.map((r) => `(${r})`).join('')}`).join('; ')),
      w.effect ? h('p', { class: 'small' }, `Effect: ${w.effect}`) : null,
      h('pre', { class: 'log-pre small' }, w.log),
      copy,
    );
  });
}

export function renderProjectPanel(world, p, refresh) {
  const set = (field) => fieldSetter(world, 'projects', p.id, field);
  const key = (part) => `${p.id}.${part}`;
  return [
    h('h2', {}, 'Project'),
    ...workdayButton(world, p, refresh),
    ...textField('Name', p.name, (v) => v.trim() && set('name')(v.trim()), { key: key('name') }),
    ...selectField('Status', p.status, STATUSES.map((s) => ({ value: s.id, label: s.name })), set('status'), { key: key('status') }),
    ...workloadFields(world, p),
    ...siteFields(world, p),
    ...assignedFields(world, p),
    h('h3', {}, 'Requirements'),
    requirementsEditor(world, p),
    h('h3', {}, `Workday history (${p.workdays.length})`),
    history(world, p),
    ...textField('Notes', p.notes, set('notes'), { key: key('notes'), multiline: true }),
    renderCustomFields(world, 'projects', p.id),
    h(
      'div',
      { class: 'row actions' },
      h(
        'button',
        {
          class: 'btn small danger',
          onclick: () => confirm(`Delete the Project "${p.name}"? Ctrl+Z undoes it.`) && dispatch(deleteProject(world, p)),
        },
        'Delete Project',
      ),
    ),
  ];
}
