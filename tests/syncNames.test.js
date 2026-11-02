import { describe, it, expect } from 'vitest';
import { backupFileName, parseBackupName, backupsToDelete, listBackups, needsBackup, fileChangedSince, openElsewhere, revisionOf, safeFileName } from '../src/sync/syncNames.js';

describe('world file names', () => {
  it('makes a safe file name', () => {
    expect(safeFileName("Kie's Grove: Day 8")).toBe('Kies Grove Day 8');
    expect(safeFileName('???')).toBe('world');
  });

  it('round-trips a backup name', () => {
    const date = new Date(2026, 10, 2, 14, 3, 22);
    const name = backupFileName('Kings World.json', date, 'before restore');
    expect(name).toBe('Kings World backup 2026-11-02 14-03-22 - before restore.json');
    const parsed = parseBackupName('Kings World.json', name);
    expect(parsed.date.getTime()).toBe(date.getTime());
    expect(parsed.note).toBe('before restore');
  });

  it("ignores other worlds' backups and other files", () => {
    expect(parseBackupName('A.json', 'B backup 2026-11-02 14-03-22.json')).toBeNull();
    expect(parseBackupName('A.json', 'A.json')).toBeNull();
  });

  it('keeps the newest backups and deletes the rest', () => {
    const names = [1, 2, 3, 4, 5].map((d) => backupFileName('A.json', new Date(2026, 10, d)));
    names.push('notes.txt');
    expect(listBackups('A.json', names)[0].name).toBe(names[4]);
    expect(backupsToDelete('A.json', names, 3)).toEqual([names[1], names[0]]);
    expect(backupsToDelete('A.json', names, 10)).toEqual([]);
  });
});

describe('sync checks', () => {
  it('compares revisions', () => {
    expect(revisionOf(null)).toBe(0);
    expect(fileChangedSince({ revision: 4 }, 4)).toBe(false);
    expect(fileChangedSince({ revision: 5 }, 4)).toBe(true);
    expect(fileChangedSince({ revision: 3 }, 4)).toBe(true);
    expect(fileChangedSince(null, 0)).toBe(false);
  });

  it('spots a world open on another device', () => {
    expect(openElsewhere({ openOn: 'Laptop' }, 'Desktop')).toBe('Laptop');
    expect(openElsewhere({ openOn: 'Desktop' }, 'Desktop')).toBe('');
    expect(openElsewhere({ openOn: '' }, 'Desktop')).toBe('');
  });

  it('decides when to back up', () => {
    const base = { keep: 10, now: 20 * 60000, minutes: 10, fileDay: 8, worldDay: 8 };
    expect(needsBackup({ ...base, lastBackupAt: null })).toBe(true);
    expect(needsBackup({ ...base, lastBackupAt: 15 * 60000 })).toBe(false);
    expect(needsBackup({ ...base, lastBackupAt: 10 * 60000 })).toBe(true);
    expect(needsBackup({ ...base, lastBackupAt: 15 * 60000, worldDay: 9 })).toBe(true);
    expect(needsBackup({ ...base, keep: 0, lastBackupAt: null })).toBe(false);
  });
});
