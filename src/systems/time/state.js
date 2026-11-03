// View state for the Today tab: filters, the open simple task (its Task
// Card's uncommitted draft) and the Advance Day wizard's proposal. Not
// world data: not saved and not undone. Nothing reaches the world until
// Accept.
export const timeView = {
  filter: 'all', // see FILTERS in todayTab.js
  task: null, // the simple task draft, see taskModel.js
  cardOpen: false,
  cardPos: { x: 16, y: 16 },
  playerView: false,
  wizard: null, // the Advance Day plan, see advancePlan.js
};
