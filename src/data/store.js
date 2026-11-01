// The world store: holds the open world and is the ONLY place that applies
// commands to it. UI code calls dispatch(command), never edits the world itself.
import { createCommand } from '../commands/registry.js';
import { newId } from './ids.js';
import { saveWorld } from './storage.js';

const SAVE_DELAY_MS = 300; // wait briefly so rapid edits become one save

let world = null;
let saveStatus = 'saved'; // 'saved' | 'saving' | 'error'
let saveTimer = null;
const listeners = new Set();

export function getWorld() {
  return world;
}

export function getSaveStatus() {
  return saveStatus;
}

// listener(kind) is called with 'world' when the world changes (redraw the
// screen) or 'save' when only the save status changes (update the label only,
// so a background save never resets what the Arbiter is typing).
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(kind) {
  for (const listener of listeners) listener(kind);
}

export function openWorld(loadedWorld) {
  world = loadedWorld;
  saveStatus = 'saved';
  notify('world');
}

export async function closeWorld() {
  await flushSave();
  world = null;
  notify('world');
}

// ---- Commands, undo, redo ----

export function dispatch(command) {
  const day = world.meta.currentDay; // the day the action was taken on
  command.do(world);
  world.log.actions.push({
    id: newId('action'),
    type: command.type,
    payload: command.payload,
    day,
    time: new Date().toISOString(),
  });
  world.log.redo = []; // a new change makes old redo entries invalid
  changed();
}

// Undo only walks back within the current day. Advance Day (Stage 6) will mark
// its log entry with dayBoundary: true, and undo stops there.
export function canUndo() {
  const actions = world?.log.actions;
  return !!actions?.length && !actions[actions.length - 1].dayBoundary;
}

export function canRedo() {
  return !!world?.log.redo.length;
}

export function undo() {
  if (!canUndo()) return;
  const entry = world.log.actions.pop();
  createCommand(entry.type, entry.payload).undo(world);
  world.log.redo.push(entry);
  changed();
}

export function redo() {
  if (!canRedo()) return;
  const entry = world.log.redo.pop();
  createCommand(entry.type, entry.payload).do(world);
  world.log.actions.push(entry);
  changed();
}

// ---- Autosave ----

function changed() {
  world.meta.modified = new Date().toISOString();
  saveStatus = 'saving';
  notify('world');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(runSave, SAVE_DELAY_MS);
}

async function runSave() {
  saveTimer = null;
  if (!world) return;
  try {
    await saveWorld(world);
    saveStatus = 'saved';
  } catch (err) {
    console.error('Save failed', err);
    saveStatus = 'error';
  }
  notify('save');
}

// Save right now if a save is waiting (used before leaving a world).
export async function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    await runSave();
  }
}
