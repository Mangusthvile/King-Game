// End-of-day snapshots and Reverse Day (src/data/snapshots.js).
import { describe, it, expect } from 'vitest';
import { takeSnapshot, restoreSnapshot, pruneSnapshots, latestDayEnd, beforeRestoreSnapshot, restoreLosses } from '../src/data/snapshots.js';

function world() {
  return {
    meta: { currentDay: 8, settings: { snapshotsKept: 30 } },
    value: 'day 8',
    log: { actions: [{ id: 'a1', day: 8 }], redo: [], snapshots: [] },
  };
}

// Pretend to advance the day (what the advanceDay command does).
function advance(w, value) {
  w.log.actions.push({ id: `adv${w.meta.currentDay}`, day: w.meta.currentDay, dayBoundary: true });
  w.meta.currentDay += 1;
  w.value = value;
}

describe('snapshots', () => {
  it('saves the world without its log', () => {
    const w = world();
    const s = takeSnapshot(w);
    expect(s).toMatchObject({ kind: 'dayEnd', day: 8, actionCount: 1, label: 'Day 8, before Advance Day' });
    expect(s.world.log).toBeUndefined();
    expect(s.world.value).toBe('day 8');
  });

  it('keeps only the newest N', () => {
    const list = [1, 2, 3, 4].map((day) => ({ id: `s${day}`, kind: 'dayEnd', day }));
    expect(pruneSnapshots(list, 2).map((s) => s.day)).toEqual([3, 4]);
    expect(pruneSnapshots([...list, { id: 'b', kind: 'beforeRestore' }], 1).map((s) => s.id)).toEqual(['s4', 'b']);
  });

  it('Reverse Day goes back to the day before Advance Day, and can be taken back', () => {
    const w = world();
    takeSnapshot(w);
    advance(w, 'day 9');
    w.log.actions.push({ id: 'a2', day: 9 });

    const s = latestDayEnd(w);
    expect(restoreLosses(w, s)).toMatchObject({ actions: 2, days: [8, 9], fromDay: 9, toDay: 8 });

    const back = restoreSnapshot(w, s.id);
    expect(back.meta.currentDay).toBe(8);
    expect(back.value).toBe('day 8');
    expect(back.log.actions.map((a) => a.id)).toEqual(['a1']); // day 8's own action can be undone again
    expect(latestDayEnd(back)).toBeNull();

    const undo = beforeRestoreSnapshot(back);
    expect(undo.label).toBe('Day 9, before Reverse Day');
    const again = restoreSnapshot(back, undo.id);
    expect(again.meta.currentDay).toBe(9);
    expect(again.value).toBe('day 9');
    expect(again.log.actions.map((a) => a.id)).toEqual(['a1', 'adv8', 'a2']);
    expect(latestDayEnd(again).day).toBe(8); // the snapshot list comes back too
  });

  it('going back several days drops the newer snapshots', () => {
    const w = world();
    takeSnapshot(w);
    advance(w, 'day 9');
    takeSnapshot(w);
    advance(w, 'day 10');
    const first = w.log.snapshots[0];
    const back = restoreSnapshot(w, first.id);
    expect(back.meta.currentDay).toBe(8);
    expect(back.log.snapshots.map((s) => s.kind)).toEqual(['beforeRestore']);
  });
});

describe('what Reverse Day loses', () => {
  it('names the Advance Day apart from the other actions', () => {
    const w = world();
    takeSnapshot(w);
    advance(w, 'day 9');
    w.log.actions.push({ id: 'a2', day: 9 }, { id: 'a3', day: 9 });
    expect(restoreLosses(w, latestDayEnd(w))).toMatchObject({ advances: [8], others: 2, otherDays: [9] });
  });
});
