// Time system (Stage 6): the Today tab (readiness, characters, what was done
// today, the Start of Day record), simple tasks ("Log a task"), the Advance
// Day wizard (meal, needs, conditions, Stamina, summary), Reverse Day with
// end-of-day snapshots, and Set Day.
import './timeCommands.js'; // registers advanceDay
import { renderToday } from './todayTab.js';

export default {
  id: 'time',
  name: 'Time',
  places: ['overview', 'tasks', 'advanceDay'].map((id) => ({ path: `realm/today/${id}`, render: renderToday })),
};
