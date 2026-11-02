// What the Arbiter does with world files: save the world as a file, open a
// world file, choose the backups folder, stop syncing.
// The ongoing sync (checks, autosave, conflicts) is in fileSync.js, backups
// and Restore in syncBackups.js.
import { getWorld, openWorld } from '../data/store.js';
import { saveWorld, loadWorld, getFileLink, putFileLink, deleteFileLink } from '../data/storage.js';
import { migrateWorld } from '../data/migrations.js';
import { validate } from '../data/exportImport.js';
import { newId } from '../data/ids.js';
import { revisionOf, safeFileName } from './syncNames.js';
import * as wf from './worldFile.js';
import { session, run, setStatus, updateLink, saveToFile, attachFileSync, writeMarker } from './fileSync.js';
import { backupText } from './syncBackups.js';
import { askBackupFolder, askReplaceLocal } from './syncPrompts.js';

// Asks for the world file's folder (for backups). Returns it, or null if
// the Arbiter chose "No backups".
async function askForFolder(fileHandle) {
  let error = '';
  for (;;) {
    if ((await askBackupFolder(fileHandle.name, error)) !== 'choose') return null;
    const picked = await wf.pickFolderOf(fileHandle);
    if (picked?.dir) return picked.dir;
    error = picked?.error ?? 'No folder was chosen.';
  }
}

// Settings > Save world as file: links the open world to a new file and saves it.
export async function saveWorldAsFile() {
  const world = getWorld();
  const handle = await wf.pickSaveFile(`${safeFileName(world.meta.name)}.json`);
  if (!handle) return;
  const dir = await askForFolder(handle);
  await run(async () => {
    clearTimeout(session.timer);
    // The Arbiter chose to replace whatever this file held, so its current
    // revision counts as seen (it is backed up first if there is a folder).
    const existing = await wf.readWorldFile(handle).catch(() => null);
    session.link = { worldId: world.meta.id, fileHandle: handle, dirHandle: dir, fileName: handle.name, knownRevision: revisionOf(existing?.sync), dirty: true };
    Object.assign(session, { theirs: null, seenOpenOn: '', lastBackupAt: undefined });
    await putFileLink(session.link);
    setStatus('pending');
    await saveToFile();
  });
}

// World list > Open world file. Returns the world (saved as the local copy
// and linked to the file), or null if cancelled. The caller opens it, which
// checks the "open on" marker.
export async function openWorldFile() {
  const handle = await wf.pickOpenFile();
  if (!handle) return null;
  const file = await wf.readWorldFile(handle);
  if (!file.world) throw new Error(`${handle.name} is empty or is not a world file.`);
  validate(file.world);
  const world = migrateWorld(file.world);

  const local = await loadWorld(world.meta.id);
  const oldLink = await getFileLink(world.meta.id);
  // A local copy with changes that never reached a file: ask before replacing.
  const unsaved = local && (!oldLink || oldLink.dirty);
  if (unsaved && !(await askReplaceLocal(local.meta.name))) return null;

  const dir = await askForFolder(handle);
  if (unsaved && dir) {
    session.link = { fileName: handle.name, dirHandle: dir }; // just for backupText
    await backupText(wf.worldFileText(local, null), 'local copy replaced');
    session.link = null;
  }
  await saveWorld(world);
  await putFileLink({ worldId: world.meta.id, fileHandle: handle, dirHandle: dir, fileName: handle.name, knownRevision: revisionOf(file.sync), dirty: false });
  return world;
}

// "Save mine as a copy" in a conflict: this computer's version becomes a
// new world with its own file; the original world takes their version.
// Runs inside run() already, so it must not call run().
export async function saveMineAsCopy(theirs) {
  const mine = getWorld();
  const handle = await wf.pickSaveFile(`${safeFileName(mine.meta.name)} (copy).json`);
  if (!handle) return; // stays paused

  const copy = structuredClone(mine);
  copy.meta.id = newId('world');
  copy.meta.name = `${mine.meta.name} (copy)`;
  copy.containers[copy.meta.rootContainerId].name = copy.meta.name;
  await saveWorld(copy);

  // The original world's local copy becomes theirs.
  try {
    validate(theirs.world);
    const original = migrateWorld(theirs.world);
    if (original.meta.id === mine.meta.id) {
      await saveWorld(original);
      await updateLink({ knownRevision: revisionOf(theirs.sync), dirty: false });
    }
  } catch (err) {
    console.warn('Could not load their version as the original world', err);
  }

  const dir = await askForFolder(handle);
  session.link = { worldId: copy.meta.id, fileHandle: handle, dirHandle: dir, fileName: handle.name, knownRevision: 0, dirty: true };
  Object.assign(session, { theirs: null, seenOpenOn: '', lastBackupAt: undefined });
  await putFileLink(session.link);
  openWorld(copy);
  setStatus('pending');
  await saveToFile();
}

// Settings > Choose backups folder (for a file linked without one).
export async function chooseBackupFolder() {
  const link = session.link;
  if (!link) return;
  const picked = await wf.pickFolderOf(link.fileHandle);
  if (picked?.error) return setStatus(session.status, picked.error);
  if (picked?.dir) await run(() => updateLink({ dirHandle: picked.dir }));
  setStatus(session.status);
}

// Settings > Stop syncing: forgets the file (the file itself is kept).
export async function stopSyncing() {
  const world = getWorld();
  await run(async () => {
    if (!session.link) return;
    if (['synced', 'pending'].includes(session.status)) await writeMarker('');
    await deleteFileLink(session.link.worldId);
  });
  await attachFileSync(world); // now unlinked: status off
}
