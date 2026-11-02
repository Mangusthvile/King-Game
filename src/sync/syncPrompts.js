// The questions the world file sync asks the Arbiter. Each returns a
// promise of the value of the button pressed (Escape = the last button).
import { h, formatDate } from '../ui/dom.js';
import { openDialog } from '../ui/dialog.js';
import { openElsewhere } from './syncNames.js';
import { getDeviceSettings } from './deviceSettings.js';

function ask(title, body, buttons) {
  return new Promise((resolve) => {
    openDialog({
      title,
      body,
      buttons: buttons.map((b) => ({ label: b.label, primary: b.primary, onClick: () => resolve(b.value) })),
    });
  });
}

const who = (sync) => sync?.lastSavedBy || 'another computer';
const when = (iso) => (iso ? formatDate(iso) : 'an unknown time');
const p = (text, cls = '') => h('p', { class: cls }, text);
const stillOpen = (sync) => (openElsewhere(sync, getDeviceSettings().deviceName) ? p(`It may still be open on ${sync.openOn}. Never edit the same world on two computers at the same time.`, 'message warning') : null);

// The file is newer and this computer has no unsaved changes.
export function askNewerFile(sync) {
  return ask(
    'World file changed',
    [p(`This world was changed on ${who(sync)} at ${when(sync?.lastSavedAt)}. Reload?`), stillOpen(sync), p('Until you choose, this computer does not save to the file.', 'muted small')],
    [
      { label: 'Reload', value: 'reload', primary: true },
      { label: 'Not now', value: 'later' },
    ],
  );
}

// The file is newer AND this computer has changes that are not in it.
export function askConflict(sync) {
  return ask(
    'Save conflict',
    [
      p(`The world file was changed on ${who(sync)} at ${when(sync?.lastSavedAt)}, and this computer has changes that are not in the file.`),
      stillOpen(sync),
      h(
        'ul',
        { class: 'small' },
        h('li', {}, 'Reload theirs: open their version. Your changes are kept as a backup file.'),
        h('li', {}, 'Keep mine: save your version over theirs. Theirs is saved as a backup first.'),
        h('li', {}, 'Save mine as a copy: save your version as a separate world and file. This world takes their version.'),
      ),
    ],
    [
      { label: 'Reload theirs', value: 'reload' },
      { label: 'Keep mine', value: 'keepMine' },
      { label: 'Save mine as a copy', value: 'copy' },
      { label: 'Decide later', value: 'later' },
    ],
  );
}

export function askOpenElsewhere(sync) {
  return ask(
    'World may be open elsewhere',
    [
      p(`This world may be open on ${sync.openOn} (since ${when(sync.openOnAt)}).`),
      p('Never edit the same world on two computers at the same time: one of them will lose work. If that computer is closed or the world is no longer open there, continue.', 'muted small'),
    ],
    [
      { label: 'Continue anyway', value: 'continue', primary: true },
      { label: 'Back to worlds', value: 'close' },
    ],
  );
}

export function askBackupFolder(fileName, error = '') {
  return ask(
    'Backups folder',
    [
      p(`Backups are kept in a "backups" folder next to ${fileName}. The browser needs you to choose that folder: the next window opens in it, so just click "Select Folder".`),
      error ? p(error, 'message error') : null,
    ],
    [
      { label: 'Choose folder', value: 'choose', primary: true },
      { label: 'No backups', value: 'skip' },
    ],
  );
}

export function askReplaceLocal(name) {
  return ask(
    'Replace the copy on this computer?',
    [p(`This computer already has "${name}", with changes that are not in this file. Opening the file replaces them (they are kept as a backup file if you choose the backups folder next).`)],
    [
      { label: 'Replace', value: true, primary: true },
      { label: 'Cancel', value: false },
    ],
  );
}

export function askSaveBeforeClose() {
  return ask(
    'Save to the world file?',
    [p('Autosave is off and this world has changes that are not in its world file. They stay on this computer either way.')],
    [
      { label: 'Save', value: true, primary: true },
      { label: "Don't save", value: false },
    ],
  );
}

export function askRestore(backup) {
  return ask(
    'Restore backup?',
    [p(`Restore the backup from ${backup.date.toLocaleString()}${backup.note ? ` (${backup.note})` : ''}?`), p('The current world file is backed up first, so this can be reversed by restoring that backup.', 'muted small')],
    [
      { label: 'Restore', value: true, primary: true },
      { label: 'Cancel', value: false },
    ],
  );
}
