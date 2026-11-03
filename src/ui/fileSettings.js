// The world file (sync) screens of System > Worlds (Save File, Backups) and
// this computer's settings in System > Preferences (Device Name, Autosave).
// The world file panel redraws itself when the sync status changes.
import { h, formatDate } from './dom.js';
import { fileAccessSupported } from '../sync/worldFile.js';
import { getSyncState, onSyncStatus, setStatus, saveFileNow, checkNow } from '../sync/fileSync.js';
import { saveWorldAsFile, chooseBackupFolder, stopSyncing } from '../sync/syncActions.js';
import { listWorldBackups, restoreBackup } from '../sync/syncBackups.js';
import { getDeviceSettings, setDeviceSetting } from '../sync/deviceSettings.js';

const STATUS_TEXT = {
  off: 'This world is only saved on this computer.',
  unsupported: "This browser can't use world files.",
  permission: 'The app needs your permission to use the world file: click Allow access.',
  synced: 'Saved to the world file.',
  pending: 'Changes waiting to be saved to the world file.',
  saving: 'Saving to the world file...',
  paused: 'Paused: the world file was changed on another computer. Nothing is saved to it until you choose (Check for changes).',
  missing: 'The world file was not found.',
  error: 'Saving to the world file failed.',
};
const WARN = ['permission', 'paused', 'missing', 'error', 'unsupported'];


// Runs a sync action; an error shows in the status line.
const act = (fn) => async () => {
  try {
    await fn();
  } catch (err) {
    setStatus(getSyncState().status, err.message || String(err));
  }
};

export function worldFilePanel() {
  const panel = h('section', { class: 'frame panel' });
  const draw = () => panel.replaceChildren(...worldFileContent());
  const stop = onSyncStatus(() => (panel.isConnected ? draw() : stop()));
  draw();
  return panel;
}

function worldFileContent() {
  const head = h('h2', {}, 'World file (sync)');
  const intro = h(
    'p',
    { class: 'muted small' },
    'Save this world as a .json file in a folder that Google Drive, OneDrive or Dropbox keeps in sync, then use Open world file on your other computers. Never edit the same world on two computers at the same time.',
  );
  if (!fileAccessSupported()) {
    return [head, h('p', { class: 'message warning' }, "This browser can't save worlds to files (that needs Chrome or Edge). To move this world to another computer, use Export JSON below, then Import JSON on the other computer.")];
  }

  const sync = getSyncState();
  const link = sync.link;
  const status = h('p', { class: WARN.includes(sync.status) ? 'message warning' : 'message' }, STATUS_TEXT[sync.status] ?? sync.status, sync.message ? ` ${sync.message}` : '');
  const canSave = ['synced', 'pending', 'error'].includes(sync.status);

  const info = link
    ? h(
        'dl',
        { class: 'info' },
        h('dt', {}, 'File'),
        h('dd', {}, link.fileName),
        h('dt', {}, 'Backups'),
        h('dd', {}, link.dirHandle ? `"backups" folder in ${link.dirHandle.name}` : 'Off (no folder chosen)'),
        h('dt', {}, 'Revision'),
        h('dd', {}, link.knownRevision),
        h('dt', {}, 'Last saved'),
        h('dd', {}, sync.fileSync?.lastSavedAt ? `${formatDate(sync.fileSync.lastSavedAt)} on ${sync.fileSync.lastSavedBy}` : '-'),
        h('dt', {}, 'Open on'),
        h('dd', {}, sync.fileSync?.openOn || '-'),
      )
    : null;

  const buttons = h(
    'div',
    { class: 'row' },
    h('button', { class: link ? 'btn' : 'btn primary', onclick: act(saveWorldAsFile) }, link ? 'Save as another file...' : 'Save world as file...'),
    link && h('button', { class: 'btn', disabled: !canSave, onclick: act(saveFileNow) }, 'Save to file now'),
    link && sync.status === 'permission' && h('button', { class: 'btn primary', onclick: act(() => checkNow(true)) }, 'Allow access'),
    link && sync.status !== 'permission' && h('button', { class: 'btn', onclick: act(() => checkNow(true)) }, 'Check for changes'),
    link && !link.dirHandle && h('button', { class: 'btn', onclick: act(chooseBackupFolder) }, 'Choose backups folder'),
    link &&
      h(
        'button',
        {
          class: 'btn danger',
          onclick: act(async () => {
            if (confirm(`Stop saving this world to ${link.fileName}?\n\nThe file is kept. The world stays on this computer.`)) await stopSyncing();
          }),
        },
        'Stop syncing',
      ),
  );

  return [head, intro, status, info, buttons];
}

// The backups next to the world file, with Restore (System > Worlds > Backups).
export function backupsPanel() {
  const panel = h('section', { class: 'frame panel' });
  const draw = () => {
    const sync = getSyncState();
    const ready = sync.link?.dirHandle && sync.status !== 'permission';
    panel.replaceChildren(...(ready ? [h('h2', {}, 'Backups'), backupsSection()] : [h('h2', {}, 'Backups'), h('p', { class: 'muted small' }, sync.link ? 'Allow access to the world file first (System > Worlds > Save File).' : 'Backups are made next to the world file. Save this world as a file first (System > Worlds > Save File).')]));
  };
  const stop = onSyncStatus(() => (panel.isConnected ? draw() : stop()));
  draw();
  return panel;
}

function backupsSection() {
  const { backupsKept, backupMinutes } = getDeviceSettings();
  const list = h('div', {}, h('p', { class: 'muted small' }, 'Loading backups...'));
  listWorldBackups()
    .then((backups) => {
      list.replaceChildren(
        ...(backups.length
          ? backups.map((b) =>
              h(
                'div',
                { class: 'row list-row' },
                h('span', {}, b.date.toLocaleString()),
                b.note ? h('span', { class: 'muted small' }, b.note) : null,
                h('div', { class: 'spacer' }),
                h('button', { class: 'btn small', onclick: act(() => restoreBackup(b)) }, 'Restore'),
              ),
            )
          : [h('p', { class: 'muted small' }, 'No backups yet.')]),
      );
    })
    .catch((err) => list.replaceChildren(h('p', { class: 'message error' }, err.message)));
  return h(
    'div',
    {},
    h('p', { class: 'muted small' }, `Before the file is overwritten, the old version is copied to the backups folder: at most every ${backupMinutes} minutes, plus whenever the day changes. The newest ${backupsKept} are kept.`),
    list,
  );
}

// ---- This computer ----

function numberSetting(label, key, min) {
  const input = h('input', {
    type: 'number',
    step: 1,
    min,
    value: getDeviceSettings()[key],
    onchange: () => {
      const n = Math.round(Number(input.value));
      if (Number.isFinite(n) && n >= min) setDeviceSetting(key, n);
      input.value = getDeviceSettings()[key];
    },
  });
  return [h('label', {}, label), input];
}

// Device Name: what other computers see in "open on" warnings and backups.
export function deviceNamePanel() {
  const nameInput = h('input', {
    type: 'text',
    class: 'wide',
    maxLength: 40,
    value: getDeviceSettings().deviceName,
    onchange: () => {
      const name = nameInput.value.trim();
      if (name) setDeviceSetting('deviceName', name);
      nameInput.value = getDeviceSettings().deviceName;
    },
  });
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Device name'),
    h('p', { class: 'muted small' }, "This computer's settings belong to the computer, not the world. Give each computer its own name."),
    h('label', {}, 'Device name'),
    nameInput,
  );
}

// Autosave to the world file, and how often backups are made.
export function autosavePanel() {
  const autosave = h('input', {
    type: 'checkbox',
    checked: getDeviceSettings().autosave,
    onchange: () => {
      setDeviceSetting('autosave', autosave.checked);
      if (autosave.checked && getSyncState().status === 'pending') saveFileNow();
    },
  });
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Autosave'),
    h('p', { class: 'muted small' }, 'For this computer. Every change is always saved on this computer at once; these are about the world file.'),
    h('label', { class: 'check-label' }, autosave, ' Autosave to the world file'),
    ...numberSetting('Autosave delay (seconds without changes)', 'autosaveSeconds', 1),
    ...numberSetting('Backups kept (0 = no backups)', 'backupsKept', 0),
    ...numberSetting('Minutes between backups', 'backupMinutes', 0),
  );
}
