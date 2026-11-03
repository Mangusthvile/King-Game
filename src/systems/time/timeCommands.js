// The Advance Day command. One step that applies every accepted change of
// the end of the day (meal, Hunger, Thirst, Conditions, Stamina, the "Day N
// ended" Day Log entry) and then moves to the next day. Its log entry is a
// day boundary, so undo stops there: going back is Reverse Day
// (data/snapshots.js). The type name 'advanceDay' makes the world file save
// at once (sync/fileSync.js).
import { registerCommand, createCommand } from '../../commands/registry.js';

registerCommand('advanceDay', {
  label: (p) => `Advanced from Day ${p.oldDay} to Day ${p.newDay}`,
  doFn: (world, p) => {
    for (const c of p.commands) createCommand(c.type, c.payload).do(world);
    world.meta.currentDay = p.newDay;
  },
  undoFn: (world, p) => {
    world.meta.currentDay = p.oldDay;
    for (const c of [...p.commands].reverse()) createCommand(c.type, c.payload).undo(world);
  },
});

// commands: the day's changes, built before this runs (nulls are skipped).
// Like batch, two of them must not change the same field.
export function advanceDay(world, commands) {
  const steps = commands.filter(Boolean).map((c) => ({ type: c.type, payload: c.payload }));
  const command = createCommand('advanceDay', { oldDay: world.meta.currentDay, newDay: world.meta.currentDay + 1, commands: steps });
  command.dayBoundary = true;
  return command;
}
