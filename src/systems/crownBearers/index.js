// Crown Bearers system (Stage 6.6, RULES.md Crown Bearers): Crown Bearers
// with their vessels, Crowns, Players and their Connectivity to Crown
// Bearers. Connectivity is a reminder only: nothing is enforced.
// When a vessel dies, its Crown Bearer is left without a vessel (in the same
// undo step) and the Arbiter is asked where the Crown is now; there is no
// automatic recovery.
import { registerDeathHook } from '../characters/death.js';
import { renderCrownBearersTab } from './crownBearersTab.js';
import { bearersInVessel, vesselDeathCommands } from './crownModel.js';
import { askCrownLocation } from './crownDialogs.js';

let orphaned = []; // Crown Bearers whose vessel is dying, between commands() and after()

registerDeathHook({
  commands(world, character, cause, day) {
    orphaned = bearersInVessel(world, character.id).map((b) => b.id);
    return vesselDeathCommands(world, character, cause, day);
  },
  after(world, character) {
    for (const id of orphaned) {
      const bearer = world.crownBearers[id];
      const crown = world.crowns?.[bearer?.crownId];
      if (crown) askCrownLocation(world, crown, `Where is the ${crown.name} now?`, `${character.name}, the vessel of ${bearer.name}, died. ${bearer.name} is now without a vessel.`);
    }
    orphaned = [];
  },
});

export default {
  id: 'crownBearers',
  name: 'Crown Bearers',
  places: ['bearers', 'connectivity', 'vessels'].map((id) => ({ path: `people/crownBearers/${id}`, render: renderCrownBearersTab })),
};
