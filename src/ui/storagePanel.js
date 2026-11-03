// System > Worlds > Storage and Backups (Stage 7, data safety):
//   storagePanel:  how much of this browser's storage the saved worlds use,
//                  each world's size, a warning when storage is getting
//                  full, and asking the browser to keep the data
//   restorePanel:  the world's day snapshots, each with a preview and
//                  Restore (the world file backups are listed below it,
//                  ui/fileSettings.js)
import { h, formatDate } from './dom.js';
import { listWorlds, storageEstimate, requestPersistentStorage, isStoragePersistent } from '../data/storage.js';
import { worldPreview } from '../data/worldPreview.js';
import { askRestoreSnapshot } from '../systems/time/timeControls.js';

// Warn above this share of the browser's storage quota.
export const STORAGE_WARN_SHARE = 0.8;

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '?';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

// A warning line when storage is getting full, or null.
export async function storageWarning() {
  const est = await storageEstimate();
  if (!est || est.usage / est.quota < STORAGE_WARN_SHARE) return null;
  return `Browser storage is ${Math.round((est.usage / est.quota) * 100)}% full (${formatBytes(est.usage)} of ${formatBytes(est.quota)}). Export or delete old worlds, or keep fewer snapshots (System > Preferences > Snapshots), before saves start failing.`;
}

export function storagePanel() {
  const panel = h('section', { class: 'frame panel' }, h('h2', {}, 'Storage'), h('p', { class: 'muted small' }, 'Measuring...'));
  (async () => {
    const [est, worlds, persistent] = await Promise.all([storageEstimate(), listWorlds(), isStoragePersistent()]);
    const share = est ? est.usage / est.quota : 0;
    const bar = est ? h('div', { class: share >= STORAGE_WARN_SHARE ? 'storage-bar warn' : 'storage-bar', style: `--fill: ${Math.min(100, share * 100).toFixed(1)}%` }, h('span')) : null;
    const persist = h(
      'button',
      {
        class: 'btn small',
        disabled: persistent,
        title: 'Without this, the browser may clear saved worlds when the disk is nearly full.',
        onclick: async () => {
          persist.disabled = true;
          persist.textContent = (await requestPersistentStorage()) ? 'The browser will keep the data' : 'The browser said no (export backups instead)';
        },
      },
      persistent ? 'The browser will keep the data' : 'Ask the browser to keep the data',
    );
    const parts = [
      h('h2', {}, 'Storage'),
      est ? h('p', {}, `${formatBytes(est.usage)} used of ${formatBytes(est.quota)} this browser allows (${(share * 100).toFixed(1)}%).`) : h('p', { class: 'muted' }, "This browser doesn't say how much storage is used."),
      bar,
      share >= STORAGE_WARN_SHARE ? h('p', { class: 'message error' }, await storageWarning()) : null,
      h('div', { class: 'row' }, persist),
      h('h3', {}, 'Worlds on this computer'),
      h(
        'table',
        { class: 'building-table' },
        h('tr', {}, h('th', {}, 'World'), h('th', {}, 'Day'), h('th', {}, 'Size'), h('th', {}, 'Last saved')),
        worlds.map((w) => h('tr', {}, h('td', {}, w.name), h('td', {}, w.currentDay), h('td', {}, w.size ? formatBytes(w.size) : '-'), h('td', { class: 'small' }, formatDate(w.modified)))),
      ),
      h('p', { class: 'muted small' }, 'A world grows with its end-of-day snapshots (one whole copy per day kept) and its action log. Sizes show after the next save.'),
    ];
    panel.replaceChildren(...parts.filter(Boolean)); // replaceChildren would print "null"

  })();
  return panel;
}

// The day snapshots, newest first, each with what it holds and Restore.
export function restorePanel(world) {
  const snapshots = [...(world.log.snapshots ?? [])].reverse();
  const row = (s) =>
    h(
      'details',
      { class: 'snapshot-row' },
      h('summary', { class: 'small' }, `${s.label} - ${new Date(s.takenAt).toLocaleString()}`),
      h('ul', { class: 'preview-list small' }, worldPreview(s.world).map((line) => h('li', {}, line))),
      h('button', { class: 'btn small arbiter-only', onclick: () => askRestoreSnapshot(world, s) }, s.kind === 'beforeRestore' ? 'Undo Reverse Day' : 'Restore this snapshot...'),
    );
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, `Day snapshots (${snapshots.length})`),
    h('p', { class: 'muted small' }, 'Advance Day saves the whole world just before the day changes. Open one to see what it holds; restoring it is the same as Reverse Day (Chronicle > History).'),
    snapshots.length ? snapshots.map(row) : h('p', { class: 'muted small' }, 'No snapshots yet: one is saved at every Advance Day.'),
  );
}
