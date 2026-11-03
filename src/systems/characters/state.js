// View state for the Characters tab: what is selected, open, searched and
// filtered. Not world data, so it is not saved and not undone.
export const charactersView = {
  selectedId: null,
  search: '',
  sort: 'name', // see SORTS in rosterTab.js
  filters: { speciesId: '', bodyTypeId: '', locationId: '', status: 'alive' },
  libraryKey: 'species',
  librarySearch: '',
  helper: null, // open helper in the panel: { kind: 'convert' | 'tierUp' | 'levelUp' | 'death', index }
  importPlan: null, // the seed import preview
};

// Opens a character in the Characters tab (used from the Biome and Area panels).
export function selectCharacter(id) {
  charactersView.selectedId = id;
  charactersView.helper = null;
}
