// Characters system (Stage 4): followers, enemies and NPCs. The stat sheet
// (identity, Body, Speed, needs, Skills, Theories, Traits and Pacts,
// Conditions, Equipment, a manual combat profile), the libraries those draw
// from, the Theory and Skill helpers, death and the Death Log, the seed
// data import, and where characters are shown on the maps.
// The combat system is not implemented: combat values are plain fields.
import { h } from '../../ui/dom.js';
import { registerPinKind } from '../../ui/quickBar.js';
import { navigate } from '../../ui/navigation.js';
import { renderCharactersTab } from './rosterTab.js';
import { renderLibraries } from './libraryEditor.js';
import { renderProgression } from './progressionView.js';
import { registerCharacterLocations } from './locationSections.js';
import { selectCharacter } from './state.js';

registerCharacterLocations();

registerPinKind('character', {
  label: 'A character',
  icon: '☺',
  options: (world) => Object.values(world.characters).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: `${c.alive ? '' : '✝ '}${c.name}` })),
  name: (world, id) => world.characters[id]?.name ?? null,
  open: (world, id) => {
    selectCharacter(id);
    navigate({ main: 'people', sub: 'roster', subsub: world.characters[id]?.alive === false ? 'deathLog' : 'living' });
  },
});

// Codex > Library > <key>: one library's editor, redrawn in place for view
// changes (search, opening an entry).
function libraryPage(key) {
  return (world, { detailPanel }) => {
    detailPanel.replaceChildren(h('h2', {}, 'Library'), h('p', { class: 'muted small' }, 'Definitions the stat sheets draw from. Every change can be undone.'));
    const root = h('div', { class: 'tab-page wide-page' });
    const refresh = () => root.replaceChildren(renderLibraries(world, refresh, key));
    refresh();
    return root;
  };
}

const LIBRARY_SCREENS = ['species', 'bodyTypes', 'skills', 'traits', 'conditions', 'equipment', 'resourceTypes'];

export default {
  id: 'characters',
  name: 'Characters',
  places: [
    { path: 'people/roster/living', render: renderCharactersTab },
    { path: 'people/roster/deathLog', render: renderCharactersTab },
    { path: 'people/progression/theoriesSkills', render: renderProgression },
    ...LIBRARY_SCREENS.map((key) => ({ path: `codex/library/${key}`, render: libraryPage(key) })),
  ],
};
