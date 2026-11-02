// Characters system (Stage 4): followers, enemies and NPCs. The stat sheet
// (identity, Body, Speed, needs, Skills, Theories, Traits and Pacts,
// Conditions, Equipment, a manual combat profile), the libraries those draw
// from, the Theory and Skill helpers, death and the Death Log, the seed
// data import, and where characters are shown on the maps.
// The combat system is not implemented: combat values are plain fields.
import { renderCharactersTab } from './rosterTab.js';
import { registerCharacterLocations } from './locationSections.js';

registerCharacterLocations();

export default {
  id: 'characters',
  name: 'Characters',
  tabs: [{ id: 'characters', label: 'Characters', render: renderCharactersTab }],
};
