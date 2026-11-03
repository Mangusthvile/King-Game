// Factions system (Stage 6.5): the Factions tab (factions, relations,
// players), transfers between factions (transfers.js) and the owner review
// after the migration to factions (migrationReview.js). The faction model
// itself is shared by every system: src/data/factions.js.
import { renderFactionsTab } from './factionsTab.js';

export default {
  id: 'factions',
  name: 'Factions',
  places: [
    { path: 'realm/factions/factions', render: renderFactionsTab },
    { path: 'realm/factions/relations', render: renderFactionsTab },
  ],
};
