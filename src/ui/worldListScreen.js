// The first screen: create (empty, or from another world's libraries and
// rules), open, import, export, duplicate, rename and delete worlds, and
// open a synced world file. Each world shows its Day, when and on which
// computer it was last saved, its world file and its size.
import { h, formatDate } from './dom.js';
import { openDialog } from './dialog.js';
import { createWorld } from '../data/schema.js';
import { listWorlds, loadWorld, saveWorld, deleteWorld, listFileLinks, putFileLink, getFileLink } from '../data/storage.js';
import { exportWorld, importWorldFile, checkedWorld } from '../data/exportImport.js';
import { duplicateWorld, templateWorld, renameSavedWorld } from '../data/worldOps.js';
import { fileAccessSupported } from '../sync/worldFile.js';
import { openWorldFile } from '../sync/syncActions.js';
import { formatBytes, storageWarning } from './storagePanel.js';

// onOpen(world) is called when the Arbiter opens a world.
export async function renderWorldList(root, { onOpen }) {
  const message = h('div', { class: 'message' });
  // A WorldFileError lists its problems one per line.
  const showError = (err) => {
    message.classList.add('error');
    const list = err.problems ? h('ul', { class: 'error-list small' }, err.problems.map((p) => h('li', {}, p))) : '';
    message.replaceChildren(h('p', {}, err.intro ?? err.message ?? String(err)), list);
  };
  const showInfo = (text) => {
    message.classList.remove('error');
    message.replaceChildren(h('p', {}, text));
  };

  // ---- New world (empty, or with another world's libraries and rules) ----
  const nameInput = h('input', { type: 'text', placeholder: 'World name', maxLength: 80 });
  const templateSelect = h('select', { title: 'Empty, or a copy of another world\'s libraries and rules (no characters or map)' });
  const createForm = h(
    'form',
    {
      class: 'row',
      onsubmit: async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return showError(new Error('Give the world a name first.'));
        try {
          const source = templateSelect.value ? checkedWorld(await loadWorld(templateSelect.value)) : null;
          const world = source ? templateWorld(source, name) : createWorld(name);
          await saveWorld(world);
          onOpen(world);
        } catch (err) {
          showError(err);
        }
      },
    },
    nameInput,
    templateSelect,
    h('button', { class: 'btn primary', type: 'submit' }, 'Create World'),
  );

  // ---- Import ----
  const fileInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onchange: async () => {
      const file = fileInput.files[0];
      fileInput.value = ''; // allow importing the same file twice
      if (!file) return;
      try {
        const world = await importWorldFile(file);
        showInfo(`Imported "${world.meta.name}".`);
        refreshList();
      } catch (err) {
        showError(err);
      }
    },
  });
  const importButton = h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Import JSON');

  // ---- Open world file (a world synced through a folder, for example Google Drive) ----
  const canSync = fileAccessSupported();
  const openFileButton = h(
    'button',
    {
      class: 'btn',
      disabled: !canSync,
      title: 'Open a world file, for example one in a Google Drive, OneDrive or Dropbox folder. The world stays saved to it.',
      onclick: async () => {
        try {
          const world = await openWorldFile();
          if (world) onOpen(world);
        } catch (err) {
          showError(err);
        }
      },
    },
    'Open world file',
  );
  const syncNote = canSync ? null : h('p', { class: 'message warning' }, "This browser can't open world files (it needs Chrome or Edge). To move a world between computers, use Export and Import JSON.");
  const storageNote = h('div');
  storageWarning().then((text) => text && storageNote.replaceChildren(h('p', { class: 'message error' }, text)));

  // ---- World list ----
  const list = h('div', { class: 'world-list' });

  async function load(id) {
    const raw = await loadWorld(id);
    if (!raw) throw new Error('That world is no longer saved on this computer.');
    return checkedWorld(raw);
  }

  async function openById(id) {
    try {
      onOpen(await load(id));
    } catch (err) {
      showError(err);
    }
  }

  async function refreshList() {
    const worlds = await listWorlds();
    const links = new Map((await listFileLinks()).map((link) => [link.worldId, link]));
    templateSelect.replaceChildren(h('option', { value: '' }, 'Empty world'), ...worlds.map((w) => h('option', { value: w.id }, `Libraries and rules of ${w.name}`)));
    if (worlds.length === 0) {
      list.replaceChildren(h('p', { class: 'muted' }, 'No worlds yet. Create one above, import a backup or open a world file.'));
    } else {
      list.replaceChildren(...worlds.map((summary) => worldCard(summary, links.get(summary.id))));
    }
  }

  // Runs a world list action, then shows its result.
  const act = (fn) => async () => {
    try {
      const text = await fn();
      if (text) showInfo(text);
      await refreshList();
    } catch (err) {
      showError(err);
    }
  };

  const duplicate = (summary) =>
    act(async () => {
      const copy = duplicateWorld(await load(summary.id));
      await saveWorld(copy);
      return `Made "${copy.meta.name}". It is not linked to a world file.`;
    });

  function rename(summary) {
    const input = h('input', { type: 'text', class: 'wide', value: summary.name, maxLength: 80 });
    openDialog({
      title: 'Rename world',
      body: [h('label', {}, 'New name'), input],
      buttons: [
        {
          label: 'Rename',
          primary: true,
          onClick: () => {
            const name = input.value.trim();
            if (!name || name === summary.name) return;
            act(async () => {
              await saveWorld(renameSavedWorld(await load(summary.id), name));
              // A linked world file gets the new name at its next save.
              const link = await getFileLink(summary.id);
              if (link) await putFileLink({ ...link, dirty: true });
              return `Renamed "${summary.name}" to "${name}".`;
            })();
          },
        },
        { label: 'Cancel' },
      ],
    });
  }

  // Asks for the world's name before deleting, so it can't happen by accident.
  function remove(summary, link) {
    const input = h('input', { type: 'text', class: 'wide', placeholder: summary.name });
    const note = h('p', { class: 'message error small' });
    openDialog({
      title: `Delete "${summary.name}"?`,
      body: [
        h('p', {}, 'This deletes the world from this computer. It cannot be undone. Export it first if unsure.'),
        link ? h('p', { class: 'muted small' }, `The world file ${link.fileName} and its backups are not deleted.`) : null,
        h('label', {}, 'Type the world\'s name to confirm'),
        input,
        note,
      ],
      buttons: [
        {
          label: 'Delete',
          onClick: () => {
            if (input.value.trim() !== summary.name) {
              note.textContent = 'The name does not match.';
              return false;
            }
            act(async () => {
              await deleteWorld(summary.id);
              return `Deleted "${summary.name}".`;
            })();
          },
        },
        { label: 'Cancel', primary: true },
      ],
    });
  }

  function worldCard(summary, link) {
    return h(
      'div',
      { class: 'frame world-card' },
      h(
        'div',
        { class: 'world-card-info' },
        h('span', { class: 'label-tag' }, summary.name),
        h(
          'div',
          { class: 'world-card-meta small muted' },
          h('span', {}, `Day ${summary.currentDay}`),
          h('span', {}, `Last saved ${formatDate(summary.modified)}${summary.savedBy ? ` on ${summary.savedBy}` : ''}`),
          h('span', { title: 'Saved to this world file as well as on this computer' }, link ? `World file: ${link.fileName}` : 'No world file'),
          h('span', {}, summary.size ? formatBytes(summary.size) : 'Size: after the next save'),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => openById(summary.id) }, 'Open'),
        h('button', { class: 'btn', title: 'A full copy with its own id, for testing or a "what if" timeline', onclick: duplicate(summary) }, 'Duplicate'),
        h('button', { class: 'btn', onclick: () => rename(summary) }, 'Rename'),
        h('button', { class: 'btn', onclick: act(async () => exportWorld(await load(summary.id))) }, 'Export'),
        h('button', { class: 'btn danger', onclick: () => remove(summary, link) }, 'Delete'),
      ),
    );
  }

  root.replaceChildren(
    h(
      'div',
      { class: 'world-list-screen' },
      h('h1', { class: 'title' }, "King's Game"),
      h('p', { class: 'subtitle' }, "Arbiter's Kingdom Simulator"),
      h(
        'section',
        { class: 'frame panel' },
        h('h2', {}, 'New World'),
        createForm,
        h('p', { class: 'muted small' }, 'A world started from another world copies its libraries and rules (species, Body Types, Skills, Traits, Equipment, resource, place and building types, tile types, factions, rule settings), with no characters, map, Projects or history.'),
        h('div', { class: 'row' }, importButton, fileInput, openFileButton),
        syncNote,
        storageNote,
        message,
      ),
      h('section', { class: 'frame panel' }, h('h2', {}, 'Worlds'), list),
    ),
  );
  nameInput.focus();
  await refreshList();
}
