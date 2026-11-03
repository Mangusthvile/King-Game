// Local saves in IndexedDB. Three stores:
//   worldIndex: small summaries for the world list
//   worlds:     the full world documents
//   fileLinks:  which world file (sync/fileSync.js) each world is saved to
import { openDB } from 'idb';
import { worldSummary } from './schema.js';
import { getDeviceSettings } from '../sync/deviceSettings.js';

const DB_NAME = 'kings-game-arbiter';
const DB_VERSION = 2;

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      // oldVersion is 0 for a brand new database, so each step runs once.
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('worldIndex', { keyPath: 'id' });
          db.createObjectStore('worlds');
        }
        if (oldVersion < 2) db.createObjectStore('fileLinks', { keyPath: 'worldId' });
      },
    });
  }
  return dbPromise;
}

export async function listWorlds() {
  const db = await getDb();
  const all = await db.getAll('worldIndex');
  // Most recently changed first.
  return all.sort((a, b) => b.modified.localeCompare(a.modified));
}

export async function loadWorld(id) {
  const db = await getDb();
  return db.get('worlds', id);
}

export async function worldExists(id) {
  const db = await getDb();
  return (await db.getKey('worldIndex', id)) !== undefined;
}

// The size of a world as saved, in bytes (about the size of its JSON).
export function worldSize(world) {
  return new Blob([JSON.stringify(world)]).size;
}

export async function saveWorld(world) {
  const db = await getDb();
  const summary = worldSummary(world, { savedBy: getDeviceSettings().deviceName, size: worldSize(world) });
  const tx = db.transaction(['worldIndex', 'worlds'], 'readwrite');
  // structuredClone so later edits in memory can't leak into the saved copy.
  await Promise.all([
    tx.objectStore('worlds').put(structuredClone(world), world.meta.id),
    tx.objectStore('worldIndex').put(summary),
    tx.done,
  ]);
}

// How much this browser lets the app store, and how much is used:
// { usage, quota } in bytes, or null if the browser can't tell.
export async function storageEstimate() {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return Number.isFinite(usage) && Number.isFinite(quota) && quota > 0 ? { usage, quota } : null;
  } catch {
    return null;
  }
}

// Asks the browser to keep the saved worlds even when the disk gets full
// (it may say no). Returns true if storage is now persistent.
export async function requestPersistentStorage() {
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

export async function isStoragePersistent() {
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

// Deletes the local copy only. A linked world file is left untouched.
export async function deleteWorld(id) {
  const db = await getDb();
  const tx = db.transaction(['worldIndex', 'worlds', 'fileLinks'], 'readwrite');
  await Promise.all([
    tx.objectStore('worlds').delete(id),
    tx.objectStore('worldIndex').delete(id),
    tx.objectStore('fileLinks').delete(id),
    tx.done,
  ]);
}

// ---- File links (sync/fileSync.js) ----
// { worldId, fileHandle, dirHandle (the file's folder, for backups; null if
//   the Arbiter skipped choosing it), fileName, knownRevision (the file
//   revision this computer last loaded or saved), dirty (true = local
//   changes that are not in the file yet) }
// File and folder handles can be stored in IndexedDB as they are.

export async function getFileLink(worldId) {
  const db = await getDb();
  return db.get('fileLinks', worldId);
}

export async function listFileLinks() {
  const db = await getDb();
  return db.getAll('fileLinks');
}

export async function putFileLink(link) {
  const db = await getDb();
  await db.put('fileLinks', link);
}

export async function deleteFileLink(worldId) {
  const db = await getDb();
  await db.delete('fileLinks', worldId);
}
