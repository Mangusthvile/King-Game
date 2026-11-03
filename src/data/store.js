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
const changeListeners = new Set();

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

// Redraws the save labels only (the world file sync calls this when its
// status changes).
export function refreshSaveStatus() {
  notify('save');
}

// listener(type) is called after every change to the world data, with the
// command type, or 'undo' / 'redo'. The world file sync uses it to know when
// to autosave.
export function onWorldChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

// Also used to swap in another version of the open world (reloading the
// world file, restoring a backup). That replaces the data as a whole, so it
// is not a command; the replaced version is kept as a backup file first.
export function openWorld(loadedWorld) {
  clearTimeout(saveTimer);
  saveTimer = null;
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

// A command with dayBoundary: true (Advance Day) is a wall for undo.
export function dispatch(command) {
  const day = world.meta.currentDay; // the day the action was taken on
  command.do(world);
  world.log.actions.push({
    id: newId('action'),
    type: command.type,
    payload: command.payload,
    day,
    time: new Date().toISOString(),
    ...(command.dayBoundary ? { dayBoundary: true } : {}),
  });
  world.log.redo = []; // a new change makes old redo entries invalid
  changed(command.type);
}

// Undo only walks back within the current day. Advance Day marks its log
// entry with dayBoundary: true, and undo stops there.
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
  changed('undo');
}

export function redo() {
  if (!canRedo()) return;
  const entry = world.log.redo.pop();
  createCommand(entry.type, entry.payload).do(world);
  world.log.actions.push(entry);
  changed('redo');
}

// Swaps in a whole new version of the open world AS a change (Reverse Day
// restoring a snapshot, data/snapshots.js): it is saved, and the world file
// is told with `type` ('reverseDay' saves the file at once).
export function replaceWorld(newWorld, type) {
  world = newWorld;
  changed(type);
}

// ---- Autosave ----

function changed(type) {
  world.meta.modified = new Date().toISOString();
  saveStatus = 'saving';
  for (const listener of changeListeners) listener(type);
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
