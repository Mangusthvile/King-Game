// Resources system (minimal, Stage 6): the kingdom stockpile and stockpiles
// at places, with resource names, tags and Food values, so the Advance Day
// meal has something to eat. A full Resources stage comes later.
import { renderResourcesTab } from './resourcesTab.js';

export default {
  id: 'resources',
  name: 'Resources',
  places: [
    { path: 'realm/resources/stockpiles', render: renderResourcesTab },
    { path: 'realm/resources/transfers', render: renderResourcesTab },
  ],
};
