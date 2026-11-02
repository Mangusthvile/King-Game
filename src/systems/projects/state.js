// View state for the Projects tab: which Project is selected and the open
// workday (the Task Card's uncommitted proposal). Not world data: it is not
// saved and not undone. Nothing in a workday reaches the world until Accept.
export const projectsView = {
  selectedId: null,
  statusFilter: '', // '' = all statuses
  workday: null, // the workday draft in progress, see workdayDraft.js
  cardOpen: false, // the Task Card is shown (closing it keeps the draft)
  cardPos: { x: 16, y: 16 }, // where the Task Card window was dragged to
  editOpen: false, // "Edit details" is unfolded
  playerView: false, // the Task Card hides Arbiter controls (for screenshots)
};

// Opens a Project in the Projects tab (used from other panels).
export function selectProject(id) {
  projectsView.selectedId = id;
  projectsView.cardOpen = false;
}
