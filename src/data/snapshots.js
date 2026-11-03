// End-of-day snapshots (CLAUDE.md, Commands, undo and time). Advance Day
// saves one just before the day changes; Reverse Day restores one.
//
// world.log.snapshots: [snapshot], oldest first
//   { id, kind: 'dayEnd' | 'beforeRestore', day, takenAt, label,
//     actionCount,   how long log.actions was when it was taken
//     world }        the whole world except its log
// A 'beforeRestore' snapshot (at most one) is the world as it was just
// before the last Reverse Day, so a Reverse Day can be taken back. It also
// keeps what the restore dropped: extraActions (the action log after
// actionCount) and snapshots (the snapshot list at that time).
//
// The action log is not copied into dayEnd snapshots: actions before a day
// boundary are never undone, so restoring cuts log.actions back to
// actionCount and the restored day's own actions can still be undone.
//
// Snapshots are save bookkeeping, like log.actions: taking one is not a
// command. Restoring one replaces the whole world (store.replaceWorld).
import { newId } from './ids.js';
import { DEFAULT_SNAPSHOTS_KEPT } from './schema.js';

// The world without its log, as a plain copy.
function worldWithoutLog(world) {
  const { log, ...rest } = world;
  return structuredClone(rest);
}

export function snapshotsKept(world) {
  const n = Number(world.meta.settings?.snapshotsKept);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_SNAPSHOTS_KEPT;
}

const dayEndSnapshots = (world) => (world.log.snapshots ?? []).filter((s) => s.kind === 'dayEnd');

// Keeps the newest `keep` dayEnd snapshots (and the beforeRestore one).
export function pruneSnapshots(snapshots, keep) {
  const dayEnds = snapshots.filter((s) => s.kind === 'dayEnd');
  const drop = new Set(dayEnds.slice(0, Math.max(0, dayEnds.length - keep)).map((s) => s.id));
  return snapshots.filter((s) => !drop.has(s.id));
}

// Saves the world as it is now: "Day N, before Advance Day". Changes
// world.log.snapshots in place and returns the new snapshot.
export function takeSnapshot(world, takenAt = new Date().toISOString()) {
  const day = world.meta.currentDay;
  const snapshot = {
    id: newId('snapshot'),
    kind: 'dayEnd',
    day,
    takenAt,
    label: `Day ${day}, before Advance Day`,
    actionCount: world.log.actions.length,
    world: worldWithoutLog(world),
  };
  world.log.snapshots = pruneSnapshots([...(world.log.snapshots ?? []), snapshot], snapshotsKept(world));
  return snapshot;
}

// The snapshot Reverse Day goes back to: the newest dayEnd one.
export function latestDayEnd(world) {
  return dayEndSnapshots(world).at(-1) ?? null;
}

export function beforeRestoreSnapshot(world) {
  return (world.log.snapshots ?? []).find((s) => s.kind === 'beforeRestore') ?? null;
}

// What restoring a snapshot throws away, for the confirmation:
//   { actions: count of actions after it, days: [days they were taken on],
//     advances: [days that were ended with Advance Day],
//     others: count of the other actions, otherDays: [their days] }
export function restoreLosses(world, snapshot) {
  const lost = world.log.actions.slice(snapshot.actionCount);
  const daysOf = (list) => [...new Set(list.map((a) => a.day))].sort((a, b) => a - b);
  const others = lost.filter((a) => !a.dayBoundary);
  return {
    actions: lost.length,
    days: daysOf(lost),
    advances: lost.filter((a) => a.dayBoundary).map((a) => a.day),
    others: others.length,
    otherDays: daysOf(others),
    fromDay: world.meta.currentDay,
    toDay: snapshot.day,
  };
}

// A new world: the snapshot's world with the right log. Does not change
// `world`. The current world becomes the (only) beforeRestore snapshot.
export function restoreSnapshot(world, snapshotId, takenAt = new Date().toISOString()) {
  const snapshot = world.log.snapshots.find((s) => s.id === snapshotId);
  if (!snapshot) throw new Error('That snapshot no longer exists.');
  const actions = world.log.actions;
  const keepCount = Math.min(snapshot.actionCount, actions.length);

  const before = {
    id: newId('snapshot'),
    kind: 'beforeRestore',
    day: world.meta.currentDay,
    takenAt,
    label: `Day ${world.meta.currentDay}, before Reverse Day`,
    actionCount: keepCount,
    extraActions: structuredClone(actions.slice(keepCount)),
    snapshots: dayEndSnapshots(world),
    world: worldWithoutLog(world),
  };

  let snapshots;
  if (snapshot.kind === 'beforeRestore') {
    // Taking back a Reverse Day: its snapshot list comes back too.
    snapshots = [...snapshot.snapshots, before];
  } else {
    // Snapshots from this one on belong to the days that are being undone.
    const index = world.log.snapshots.indexOf(snapshot);
    snapshots = [...world.log.snapshots.slice(0, index).filter((s) => s.kind === 'dayEnd'), before];
  }

  const restored = structuredClone(snapshot.world);
  restored.log = {
    actions: [...structuredClone(actions.slice(0, keepCount)), ...structuredClone(snapshot.extraActions ?? [])],
    redo: [],
    snapshots,
  };
  return restored;
}
