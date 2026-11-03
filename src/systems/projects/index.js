// Projects system (Stage 5): the Project Resolution Method from RULES.md.
// Projects with a size and Workload, an optional building site whose
// construction progress they drive, requirements, assigned characters, and
// workdays resolved on a Task Card (Work Dice per relevant Skill Tier, the
// Level bonus, the d20 Project Event). Each accepted workday writes a
// Resolution Log to the Day Log.
import { renderProjectsTab } from './projectsTab.js';
import { registerProjectLinks } from './links.js';
import { registerBuildingPrompt } from './buildingPrompt.js';
import { registerPinKind } from '../../ui/quickBar.js';
import { navigate } from '../../ui/navigation.js';
import { selectProject } from './state.js';

// Where a Project of each status is listed (Realm > Projects).
const SCREEN_OF_STATUS = { active: 'active', paused: 'active', planned: 'planned', complete: 'completed' };

registerPinKind('project', {
  label: 'A Project',
  icon: '⚒',
  options: (world) => Object.values(world.projects).map((p) => ({ value: p.id, label: p.name })),
  name: (world, id) => world.projects[id]?.name ?? null,
  open: (world, id) => {
    selectProject(id);
    navigate({ main: 'realm', sub: 'projects', subsub: SCREEN_OF_STATUS[world.projects[id]?.status] ?? 'active' });
  },
});

registerProjectLinks();
registerBuildingPrompt(); // placing a building offers to create its Project

export default {
  id: 'projects',
  name: 'Projects',
  places: ['active', 'planned', 'completed'].map((id) => ({ path: `realm/projects/${id}`, render: renderProjectsTab })),
};
