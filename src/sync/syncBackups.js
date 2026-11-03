// World file backups: copies of the world file in the "backups" folder next
// to it. Written before a save overwrites the file (at most every few
// minutes, plus when the day changes) and before Keep mine, Reload theirs
// and Restore. The newest N are kept (Settings > This computer).
import { getWorld, openWorld } from '../data/store.js';
import { saveWorld } from '../data/storage.js';
import { checkedWorld } from '../data/exportImport.js';
import { getDeviceSettings } from './deviceSettings.js';
import { revisionOf, needsBackup, backupFileName, backupsToDelete, listBackups } from './syncNames.js';
import * as wf from './worldFile.js';
import { session, run, setStatus, updateLink, readOrReport } from './fileSync.js';
import { worldPreview } from '../data/worldPreview.js';
import { askRestore } from './syncPrompts.js';

// Before a save: is a backup of the file (about to be overwritten) due?
export async function backupDue(file, world) {
  const { backupsKept, backupMinutes } = getDeviceSettings();
  if (!session.link.dirHandle || backupsKept <= 0) return false;
  if (session.lastBackupAt === undefined) {
    const newest = listBackups(session.link.fileName, await wf.listBackupFiles(session.link.dirHandle))[0];
    session.lastBackupAt = newest ? newest.date.getTime() : null;
  }
  return needsBackup({ keep: backupsKept, lastBackupAt: session.lastBackupAt, now: Date.now(), minutes: backupMinutes, fileDay: file.world?.meta?.currentDay, worldDay: world.meta.currentDay });
}

// Writes a backup and deletes the oldest beyond the number kept.
// Returns false when there is no backups folder or it failed.
export async function backupText(text, note = '') {
  const dir = session.link?.dirHandle;
  if (!dir || !text) return false;
  try {
    const now = new Date();
    await wf.writeBackup(dir, backupFileName(session.link.fileName, now, note), text);
    session.lastBackupAt = now.getTime();
    const keep = Math.max(1, getDeviceSettings().backupsKept);
    await wf.deleteBackups(dir, backupsToDelete(session.link.fileName, await wf.listBackupFiles(dir), keep));
    return true;
  } catch (err) {
    console.warn('Backup failed', err);
    return false;
  }
}

// This world file's backups, newest first: [{ name, date, note }].
export async function listWorldBackups() {
  const link = session.link;
  if (!link?.dirHandle || !(await wf.hasAccess(link.dirHandle, false))) return [];
  return listBackups(link.fileName, await wf.listBackupFiles(link.dirHandle));
}

// Settings > Backups > Restore: the backup becomes the world and the file.
// It replaces the world as a whole (not a command); the current file is
// backed up first, so restoring that backup reverses it.
export async function restoreBackup(backup) {
  // Read and check it first, so the question can show what it holds.
  let restored;
  try {
    restored = checkedWorld(JSON.parse(await wf.readBackup(session.link.dirHandle, backup.name)));
  } catch (err) {
    alert(`That backup cannot be restored.

${err.message}`);
    return;
  }
  if (restored.meta.id !== getWorld().meta.id) return alert('That backup is of another world.');
  if (!(await askRestore(backup, worldPreview(restored)))) return;
  await run(async () => {
    const world = getWorld();

    const file = await readOrReport();
    if (!file) return;
    await backupText(file.text, 'before restore');
    if (session.link.dirty) await backupText(wf.worldFileText(world, null), 'changes not saved here');

    const now = new Date().toISOString();
    const me = getDeviceSettings().deviceName;
    const sync = { revision: revisionOf(file.sync) + 1, lastSavedAt: now, lastSavedBy: me, openOn: me, openOnAt: now };
    await wf.writeText(session.link.fileHandle, wf.worldFileText(restored, sync));
    session.fileSync = sync;
    session.theirs = null;
    session.changes++;
    await saveWorld(restored);
    await updateLink({ knownRevision: sync.revision, dirty: false });
    openWorld(restored);
    setStatus('synced', `Restored the backup from ${backup.date.toLocaleString()}.`);
  });
}
