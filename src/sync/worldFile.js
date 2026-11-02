// The File System Access API (Chrome and Edge only): picking, reading and
// writing a world file, and the backups folder next to it.
//
// A world file is the world JSON with one extra top-level block, `sync`
// (save bookkeeping, not world data, so it is never in the world itself):
//   { revision (goes up by 1 on every save), lastSavedAt, lastSavedBy
//     (device name), openOn (device that has the world open, '' = none),
//     openOnAt }
import { BACKUP_FOLDER } from './syncNames.js';

export function fileAccessSupported() {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window && 'showDirectoryPicker' in window;
}

const JSON_TYPES = [{ description: "King's Game world", accept: { 'application/json': ['.json'] } }];

// The pickers return null when the Arbiter cancels.
async function cancelToNull(promise) {
  try {
    return await promise;
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export async function pickOpenFile() {
  const handles = await cancelToNull(window.showOpenFilePicker({ types: JSON_TYPES, id: 'kg-world' }));
  return handles?.[0] ?? null;
}

export function pickSaveFile(suggestedName) {
  return cancelToNull(window.showSaveFilePicker({ suggestedName, types: JSON_TYPES, id: 'kg-world' }));
}

// The browser can't find a file's folder by itself, so the Arbiter picks it.
// The picker opens in the file's own folder, so they only have to confirm.
// Returns { dir } or { error } (the folder does not hold the file), or null.
export async function pickFolderOf(fileHandle) {
  const dir = await cancelToNull(window.showDirectoryPicker({ startIn: fileHandle, mode: 'readwrite' }));
  if (!dir) return null;
  const path = await dir.resolve(fileHandle); // ['World.json'] when the file is directly inside
  if (path?.length !== 1) return { error: `That folder does not hold ${fileHandle.name}. Choose the folder the file is in.` };
  return { dir };
}

// Read and write access. request = true may show the browser's question,
// which only works right after a click.
export async function hasAccess(handle, request) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (!request) return false;
  try {
    return (await handle.requestPermission(opts)) === 'granted';
  } catch {
    return false; // no recent click to allow the question
  }
}

// { text, sync, world }: world is the world without its sync block, or null
// when the file is empty or not JSON. Throws NotFoundError if the file is gone.
export async function readWorldFile(fileHandle) {
  const text = await (await fileHandle.getFile()).text();
  if (!text.trim()) return { text, sync: null, world: null };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { text, sync: null, world: null };
  }
  const { sync = null, ...world } = data;
  return { text, sync, world };
}

export function worldFileText(world, sync) {
  return JSON.stringify({ sync, ...world }, null, 2);
}

// The browser writes to a temporary file and swaps it in on close(), so a
// half-written world file is never left behind.
export async function writeText(fileHandle, text) {
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

// ---- Backups (in the "backups" folder next to the world file) ----

async function backupsFolder(dir, create) {
  try {
    return await dir.getDirectoryHandle(BACKUP_FOLDER, { create });
  } catch (err) {
    if (err.name === 'NotFoundError') return null;
    throw err;
  }
}

export async function writeBackup(dir, name, text) {
  const folder = await backupsFolder(dir, true);
  await writeText(await folder.getFileHandle(name, { create: true }), text);
}

export async function listBackupFiles(dir) {
  const folder = await backupsFolder(dir, false);
  const names = [];
  if (!folder) return names;
  for await (const [name, handle] of folder.entries()) if (handle.kind === 'file') names.push(name);
  return names;
}

export async function readBackup(dir, name) {
  const folder = await backupsFolder(dir, false);
  if (!folder) throw new Error('The backups folder is gone.');
  return (await (await folder.getFileHandle(name)).getFile()).text();
}

export async function deleteBackups(dir, names) {
  const folder = await backupsFolder(dir, false);
  for (const name of names) await folder?.removeEntry(name);
}

// When there is no backups folder: a normal browser download instead.
export function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
