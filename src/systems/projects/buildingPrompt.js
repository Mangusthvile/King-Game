// When the Arbiter places a building, offer to create its Project right
// away (name, Project Size, Workload), already linked to the building.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { onPlaced } from '../../map/objectKinds.js';
import { openDialog } from '../../ui/dialog.js';
import { PROJECT_SIZES, sizeLabel } from '../../rules/projects.js';
import { createProjectForBuilding } from './projectModel.js';
import { selectProject } from './state.js';

function promptForBuilding(world, obj) {
  const b = world.buildings[obj?.refId];
  if (!b || b.projectId) return;
  const name = h('input', { type: 'text', class: 'wide', value: `Build ${b.name}` });
  const size = h('select', { class: 'wide' }, PROJECT_SIZES.map((s) => h('option', { value: s.id }, sizeLabel(s))));
  size.value = 'moderate';
  const workload = h('input', { type: 'number', min: 0, step: 1, class: 'short-input', value: 100 });
  size.addEventListener('change', () => (workload.value = PROJECT_SIZES.find((s) => s.id === size.value).workload));
  const message = h('p', { class: 'message error small' });

  openDialog({
    title: 'Create a Project?',
    body: [
      h('p', {}, `Also create a Project to build ${b.name}?`),
      h('label', {}, 'Project name'),
      name,
      h('label', {}, 'Project Size'),
      size,
      h('label', {}, 'Workload (any value)'),
      workload,
      message,
    ],
    buttons: [
      {
        label: 'Create Project',
        primary: true,
        onClick: () => {
          const n = Number(workload.value);
          if (!Number.isInteger(n) || n < 0) {
            message.textContent = 'The Workload must be a whole number.';
            return false;
          }
          const chosen = PROJECT_SIZES.find((s) => s.id === size.value);
          const { project, command } = createProjectForBuilding(world, b.id, { name: name.value.trim() || `Build ${b.name}`, sizeLabel: chosen.name, workloadRequired: n });
          selectProject(project.id);
          dispatch(command);
        },
      },
      { label: 'No thanks' },
    ],
  });
}

export function registerBuildingPrompt() {
  onPlaced('building', promptForBuilding);
}
