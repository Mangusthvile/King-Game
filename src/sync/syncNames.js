// Pure helpers for world files and their backups: names, revisions and
// when to back up. No browser APIs here, so tests/syncNames.test.js can
// check them.

// The folder next to the world file that holds its backups.
export const BACKUP_FOLDER = 'backups';

// Keeps letters, numbers, spaces, - _ ( ) so a world name is a safe file name.
export function safeFileName(name) {
  return String(name ?? '').replace(/[^a-z0-9-_ ()]/gi, '').trim() || 'world';
}

// The file's save counter. A file without a sync block (an old export) is 0.
export function revisionOf(sync) {
  return Number(sync?.revision) || 0;
}

// True when another computer saved the file since this one last loaded or
// saved it (any different revision counts, even a lower one).
export function fileChangedSince(sync, knownRevision) {
  return revisionOf(sync) !== knownRevision;
}

// The device that has the world open, if it is not this one.
export function openElsewhere(sync, deviceName) {
  const device = sync?.openOn || '';
  return device && device !== deviceName ? device : '';
}

const pad = (n) => String(n).padStart(2, '0');

// "2026-11-02 14-03-22" in local time. Sorts in time order as plain text.
export function stamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function baseName(worldFileName) {
  return worldFileName.replace(/\.json$/i, '');
}

// "Kie World backup 2026-11-02 14-03-22 - before restore.json"
export function backupFileName(worldFileName, date, note = '') {
  const suffix = note ? ` - ${safeFileName(note)}` : '';
  return `${baseName(worldFileName)} backup ${stamp(date)}${suffix}.json`;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// { name, date, note } for a backup of this world file, or null for any
// other file in the backups folder (other worlds can share the folder).
export function parseBackupName(worldFileName, fileName) {
  const pattern = new RegExp(`^${escapeRegExp(baseName(worldFileName))} backup (\\d{4})-(\\d\\d)-(\\d\\d) (\\d\\d)-(\\d\\d)-(\\d\\d)(?: - (.*))?\\.json$`);
  const m = fileName.match(pattern);
  if (!m) return null;
  const [y, mo, d, hh, mm, ss] = m.slice(1, 7).map(Number);
  return { name: fileName, date: new Date(y, mo - 1, d, hh, mm, ss), note: m[7] ?? '' };
}

// This world file's backups, newest first.
export function listBackups(worldFileName, fileNames) {
  return fileNames
    .map((name) => parseBackupName(worldFileName, name))
    .filter(Boolean)
    .sort((a, b) => b.date - a.date || b.name.localeCompare(a.name));
}

// The oldest backups beyond the newest `keep`, to delete.
export function backupsToDelete(worldFileName, fileNames, keep) {
  return listBackups(worldFileName, fileNames)
    .slice(Math.max(0, keep))
    .map((b) => b.name);
}

// Before a save overwrites the file: back up the old file if backups are
// on and either the last backup is older than `minutes`, or the file is
// from another day than the world being saved (so every day is kept).
export function needsBackup({ keep, lastBackupAt, now, minutes, fileDay, worldDay }) {
  if (keep <= 0) return false;
  if (lastBackupAt === null || lastBackupAt === undefined) return true;
  if (fileDay !== undefined && fileDay !== worldDay) return true;
  return now - lastBackupAt >= minutes * 60 * 1000;
}
