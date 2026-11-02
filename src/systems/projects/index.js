// Projects system (Stage 5): the Project Resolution Method from RULES.md.
// Projects with a size and Workload, an optional building site whose
// construction progress they drive, requirements, assigned characters, and
// workdays resolved on a Task Card (Work Dice per relevant Skill Tier, the
// Level bonus, the d20 Project Event). Each accepted workday writes a
// Resolution Log to the Day Log.
import { renderProjectsTab } from './projectsTab.js';
import { registerProjectLinks } from './links.js';
import { registerBuildingPrompt } from './buildingPrompt.js';

registerProjectLinks();
registerBuildingPrompt(); // placing a building offers to create its Project

export default {
  id: 'projects',
  name: 'Projects',
  tabs: [{ id: 'projects', label: 'Projects', render: renderProjectsTab }],
};
