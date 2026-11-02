// World file sync: keeps the open world saved to a .json file the Arbiter
// picked (for example in a Google Drive folder), so the same world can be
// used on several computers. IndexedDB stays the local copy and cache.
// The rules (CLAUDE.md > World file sync), in short:
//   - every save of the world bumps the file's sync.revision
//   - before saving, the file is re-read; if its revision is not the one
//     this computer last loaded or saved, another computer saved it: stop
//     and ask the Arbiter (nothing is written until they choose)
//   - sync.openOn names the computer that has the world open (a warning only)
// Linking or opening a file is in syncActions.js, backups in syncBackups.js.
import { getWorld, openWorld, onWorldChange, refreshSaveStatus } from '../data/store.js';
import { saveWorld, getFileLink, putFileLink } from '../data/storage.js';
import { migrateWorld } from '../data/migrations.js';
import { validate } from '../data/exportImport.js';
import { getDeviceSettings } from './deviceSettings.js';
import { revisionOf, fileChangedSince, openElsewhere, backupFileName } from './syncNames.js';
import * as wf from './worldFile.js';
import { askNewerFile, askConflict, askOpenElsewhere, askSaveBeforeClose } from './syncPrompts.js';
// syncActions.js and syncBackups.js import this file too. That is fine:
// none of them uses another while loading, only later when the Arbiter acts.
import { saveMineAsCopy } from './syncActions.js';
import { backupDue, backupText } from './syncBackups.js';

// Changes of day are saved to the file at once (Advance Day and Reverse
// Day come in Stage 6 and must use these command types, or call saveFileNow).
const SAVE_AT_ONCE = new Set(['setCurrentDay', 'advanceDay', 'reverseDay']);

// Statuses: off (no file), unsupported (browser can't), permission (needs a
// click to allow access), synced, pending (changes not in the file yet),
// saving, paused (the file changed elsewhere: waiting for the Arbiter),
// missing (file gone), error.
const CAN_SAVE = ['synced', 'pending', 'error'];

// The open world's sync state. View state: never part of the world.
export const session = {
  link: null, // the fileLinks record (data/storage.js); null = not linked
  status: 'off',
  message: '',
  fileSync: null, // the file's sync block as last read or written
  theirs: null, // a changed file waiting for the Arbiter's choice
  timer: null,
  changes: 0, // counts local changes, to notice edits made during a save
  lastBackupAt: undefined, // undefined = not looked up yet, null = no backups
  seenOpenOn: '', // the "open elsewhere" warning already shown (device + time)
  prompting: false,
};
let busy = Promise.resolve();
let closeHandler = () => {};
const statusListeners = new Set();

const me = () => getDeviceSettings().deviceName;

export function getSyncState() {
  return session;
}

// listener() is called when the status changes. Returns an unsubscribe function.
export function onSyncStatus(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

// "Back to worlds" in the "open elsewhere" warning. Set by main.js.
export function setSyncCloseHandler(fn) {
  closeHandler = fn;
}

export function setStatus(status, message = '') {
  session.status = status;
  session.message = message;
  refreshSaveStatus();
  for (const listener of statusListeners) listener();
}

// File operations run one at a time, in order.
export function run(task) {
  busy = busy.then(task).catch((err) => {
    console.error('World file sync failed', err);
    setStatus('error', err.message || String(err));
  });
  return busy;
}

function resetSession() {
  clearTimeout(session.timer);
  Object.assign(session, { link: null, status: 'off', message: '', fileSync: null, theirs: null, timer: null, changes: 0, lastBackupAt: undefined, seenOpenOn: '', prompting: false });
}

export async function updateLink(changes) {
  Object.assign(session.link, changes);
  await putFileLink(session.link);
}

// Wraps a prompt so focus checks don't stack a second dialog on top.
async function prompt(fn) {
  session.prompting = true;
  try {
    return await fn();
  } finally {
    session.prompting = false;
  }
}

// ---- Opening and closing a world ----

// Called after a world opens: finds its file link, gets access, checks the file.
export async function attachFileSync(world) {
  resetSession();
  const link = await getFileLink(world.meta.id);
  if (getWorld() !== world) return;
  session.link = link ?? null;
  if (!link) return setStatus('off');
  if (!wf.fileAccessSupported()) return setStatus('unsupported', 'This browser cannot open world files. Use Chrome or Edge.');
  await run(() => connect(true, true));
}

// Gets access to the file (asking only right after a click), then checks it.
async function connect(opening, request) {
  if (!(await hasAccess(request))) return setStatus('permission', 'Click to allow the app to use the world file.');
  await checkFile(opening);
}

async function hasAccess(request) {
  const { dirHandle, fileHandle } = session.link;
  // Access to the folder covers the file inside it.
  if (dirHandle && !(await wf.hasAccess(dirHandle, request))) return false;
  return wf.hasAccess(fileHandle, request);
}

// Before closing: save waiting changes, then clear the "open on" marker.
export async function closeFileSync() {
  await run(async () => {
    if (!session.link || !CAN_SAVE.includes(session.status)) return;
    if (session.link.dirty) {
      const save = getDeviceSettings().autosave || (await prompt(askSaveBeforeClose));
      if (save) await saveToFile();
    }
    if (CAN_SAVE.includes(session.status)) await writeMarker('');
  });
  resetSession();
}

export async function readOrReport() {
  try {
    const file = await wf.readWorldFile(session.link.fileHandle);
    return file;
  } catch (err) {
    if (err.name === 'NotFoundError') setStatus('missing', `${session.link.fileName} was not found. It may have been moved, renamed or deleted. Save the world as a file again in Settings.`);
    else if (err.name === 'NotAllowedError') setStatus('permission', 'Click to allow the app to use the world file.');
    else setStatus('error', err.message);
    return null;
  }
}

// ---- Checking the file (on open, and when the Arbiter returns to the tab) ----

async function checkFile(opening) {
  const file = await readOrReport();
  if (!file) return;
  session.fileSync = file.sync;

  const device = openElsewhere(file.sync, me());
  const seenKey = `${device}|${file.sync?.openOnAt}`;
  const changed = fileChangedSince(file.sync, session.link.knownRevision);
  // A changed file gets one question (Reload, or the conflict choices) that
  // also says where it is open, instead of two dialogs in a row.
  if (device && seenKey !== session.seenOpenOn && !changed) {
    session.seenOpenOn = seenKey;
    if ((await prompt(() => askOpenElsewhere(file.sync))) === 'close') {
      resetSession(); // unlinked for now, so the other computer's marker is left alone
      setTimeout(closeHandler);
      return;
    }
  }

  if (changed) {
    session.seenOpenOn = seenKey;
    session.theirs = file;
    setStatus('paused', 'The world file was changed on another computer.');
    await resolveTheirs();
    return;
  }
  if (opening) await writeMarker(me(), file);
  setStatus(session.link.dirty ? 'pending' : 'synced');
  if (session.link.dirty) scheduleSave();
}

// Asks what to do about a changed file and does it.
async function resolveTheirs() {
  const theirs = session.theirs;
  if (!theirs) return;
  const choice = await prompt(() => (session.link.dirty ? askConflict(theirs.sync) : askNewerFile(theirs.sync)));
  if (choice === 'reload') await reloadTheirs(theirs);
  else if (choice === 'keepMine') await keepMine(theirs);
  else if (choice === 'copy') await saveMineAsCopy(theirs);
  // 'later': stays paused; the file button in the top bar asks again.
}

// Turns the file's world into the open world (and the local copy).
export async function reloadTheirs(theirs) {
  const mine = getWorld();
  let world;
  try {
    validate(theirs.world);
    world = migrateWorld(theirs.world);
  } catch (err) {
    return setStatus('error', `The world file can't be loaded: ${err.message}`);
  }
  if (world.meta.id !== mine.meta.id) {
    return setStatus('error', `The file now holds another world ("${world.meta.name}"). Save this world as a file again in Settings.`);
  }
  if (session.link.dirty) await backupText(wf.worldFileText(mine, null), 'changes not saved here');
  await saveWorld(world);
  await updateLink({ knownRevision: revisionOf(theirs.sync), dirty: false });
  session.theirs = null;
  session.changes++;
  openWorld(world);
  await writeMarker(me(), theirs);
  setStatus('synced');
}

async function keepMine(theirs) {
  // Theirs is kept first: in the backups folder, or as a download.
  if (!(await backupText(theirs.text, `from ${theirs.sync?.lastSavedBy || 'other computer'}`))) {
    wf.downloadText(backupFileName(session.link.fileName, new Date(), 'theirs'), theirs.text);
  }
  await updateLink({ knownRevision: revisionOf(theirs.sync) });
  session.theirs = null;
  setStatus('pending');
  await saveToFile();
}

// The top bar's file button and Settings > Check for changes.
export function checkNow(request = false) {
  if (!session.link || session.prompting) return;
  return run(async () => {
    if (!session.link) return;
    if (session.status === 'paused') {
      const file = await readOrReport();
      if (!file) return;
      session.theirs = fileChangedSince(file.sync, session.link.knownRevision) ? file : null;
      if (session.theirs) return resolveTheirs();
      setStatus(session.link.dirty ? 'pending' : 'synced');
      return;
    }
    await connect(false, request);
  });
}

// ---- Saving ----

// Saves the open world to its file, unless the file changed elsewhere.
export async function saveToFile() {
  clearTimeout(session.timer);
  session.timer = null;
  const world = getWorld();
  if (!session.link || !world || session.link.worldId !== world.meta.id) return;
  if (!CAN_SAVE.includes(session.status) && session.status !== 'saving') return;
  if (!(await hasAccess(false))) return setStatus('permission', 'Click to allow the app to use the world file.');
  setStatus('saving');
  const file = await readOrReport();
  if (!file) return;
  if (fileChangedSince(file.sync, session.link.knownRevision)) {
    session.theirs = file;
    setStatus('paused', 'The world file was changed on another computer.');
    return resolveTheirs();
  }
  if (file.text.trim() && (await backupDue(file, world))) await backupText(file.text);

  const now = new Date().toISOString();
  const sync = { revision: revisionOf(file.sync) + 1, lastSavedAt: now, lastSavedBy: me(), openOn: me(), openOnAt: now };
  const changesAtStart = session.changes;
  const text = wf.worldFileText(world, sync); // the world as it is right now
  await wf.writeText(session.link.fileHandle, text);
  session.fileSync = sync;
  await updateLink({ knownRevision: sync.revision, dirty: session.changes !== changesAtStart });
  setStatus(session.link.dirty ? 'pending' : 'synced');
  if (session.link.dirty) scheduleSave();
}

export function saveFileNow() {
  return run(saveToFile);
}

function scheduleSave(delayMs = getDeviceSettings().autosaveSeconds * 1000) {
  if (!getDeviceSettings().autosave || !CAN_SAVE.includes(session.status)) return;
  clearTimeout(session.timer);
  session.timer = setTimeout(() => run(saveToFile), Math.max(0, delayMs));
}

// Writes only the "open on" marker, keeping the file's own world as it is
// (so it never saves local changes and does not bump the revision).
export async function writeMarker(openOn, file = null) {
  file ??= await readOrReport();
  if (!file?.world || fileChangedSince(file.sync, session.link.knownRevision)) return;
  const current = file.sync?.openOn || '';
  if (!openOn && current && current !== me()) return; // another computer's marker
  if (current === openOn && openOn === '') return;
  const sync = { ...(file.sync ?? {}), revision: revisionOf(file.sync), openOn, openOnAt: new Date().toISOString() };
  await wf.writeText(session.link.fileHandle, wf.worldFileText(file.world, sync));
  session.fileSync = sync;
}

// ---- Watching for changes ----

onWorldChange((type) => {
  if (!session.link) return;
  session.changes++;
  if (!session.link.dirty) updateLink({ dirty: true }).catch((err) => console.error(err));
  if (session.status === 'synced') setStatus('pending');
  scheduleSave(SAVE_AT_ONCE.has(type) ? 0 : undefined);
});

// Returning to the tab checks the file; leaving it saves waiting changes.
let lastCheck = 0;
function onReturn() {
  if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 2000) return;
  lastCheck = Date.now();
  if (['synced', 'pending'].includes(session.status)) checkNow();
}
window.addEventListener('focus', onReturn);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') return onReturn();
  if (session.link?.dirty && session.timer && getDeviceSettings().autosave) run(saveToFile);
});
// Closing the tab: a last try at saving (the browser may not wait for it;
// the local copy remembers the changes and saves them next time).
window.addEventListener('pagehide', () => {
  if (!session.link || !CAN_SAVE.includes(session.status)) return;
  if (session.link.dirty && getDeviceSettings().autosave) run(saveToFile);
  else run(() => writeMarker(''));
});
