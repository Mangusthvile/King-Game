// Local saves in IndexedDB. Two stores:
//   worldIndex: small summaries for the world list
//   worlds:     the full world documents
import { openDB } from 'idb';
import { worldSummary } from './schema.js';

const DB_NAME = 'kings-game-arbiter';
const DB_VERSION = 1;

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('worldIndex', { keyPath: 'id' });
        db.createObjectStore('worlds');
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

export async function saveWorld(world) {
  const db = await getDb();
  const tx = db.transaction(['worldIndex', 'worlds'], 'readwrite');
  // structuredClone so later edits in memory can't leak into the saved copy.
  await Promise.all([
    tx.objectStore('worlds').put(structuredClone(world), world.meta.id),
    tx.objectStore('worldIndex').put(worldSummary(world)),
    tx.done,
  ]);
}

export async function deleteWorld(id) {
  const db = await getDb();
  const tx = db.transaction(['worldIndex', 'worlds'], 'readwrite');
  await Promise.all([
    tx.objectStore('worlds').delete(id),
    tx.objectStore('worldIndex').delete(id),
    tx.done,
  ]);
}
