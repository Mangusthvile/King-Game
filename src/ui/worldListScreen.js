// The first screen: create, open, import, export and delete worlds, and
// open a synced world file.
import { h, formatDate } from './dom.js';
import { createWorld } from '../data/schema.js';
import { listWorlds, loadWorld, saveWorld, deleteWorld, listFileLinks } from '../data/storage.js';
import { exportWorld, importWorldFile } from '../data/exportImport.js';
import { fileAccessSupported } from '../sync/worldFile.js';
import { openWorldFile } from '../sync/syncActions.js';
import { migrateWorld } from '../data/migrations.js';

// onOpen(world) is called when the Arbiter opens a world.
export async function renderWorldList(root, { onOpen }) {
  const message = h('p', { class: 'message' });
  const showError = (err) => {
    message.textContent = err.message || String(err);
    message.classList.add('error');
  };

  // ---- New world ----
  const nameInput = h('input', {
    type: 'text',
    placeholder: 'World name',
    maxLength: 80,
  });
  const createForm = h(
    'form',
    {
      class: 'row',
      onsubmit: async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return showError(new Error('Give the world a name first.'));
        const world = createWorld(name);
        await saveWorld(world);
        onOpen(world);
      },
    },
    nameInput,
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
        message.classList.remove('error');
        message.textContent = `Imported "${world.meta.name}".`;
        refreshList();
      } catch (err) {
        showError(err);
      }
    },
  });
  const importButton = h(
    'button',
    { class: 'btn', onclick: () => fileInput.click() },
    'Import JSON',
  );

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
  const syncNote = canSync
    ? null
    : h('p', { class: 'message warning' }, "This browser can't open world files (it needs Chrome or Edge). To move a world between computers, use Export and Import JSON.");

  // ---- World list ----
  const list = h('div', { class: 'world-list' });

  async function openById(id) {
    try {
      onOpen(migrateWorld(await loadWorld(id)));
    } catch (err) {
      showError(err);
    }
  }

  async function refreshList() {
    const worlds = await listWorlds();
    const links = new Map((await listFileLinks()).map((link) => [link.worldId, link]));
    if (worlds.length === 0) {
      list.replaceChildren(h('p', { class: 'muted' }, 'No worlds yet. Create one above, import a backup or open a world file.'));
    } else {
      list.replaceChildren(...worlds.map((summary) => worldCard(summary, links.get(summary.id))));
    }
  }

  function worldCard(summary, link) {
    return h(
      'div',
      { class: 'frame world-card' },
      h(
        'div',
        { class: 'world-card-info' },
        h('span', { class: 'label-tag' }, summary.name),
        h('span', { class: 'muted' }, `Day ${summary.currentDay}`),
        h('span', { class: 'muted small' }, `Last saved ${formatDate(summary.modified)}`),
        link ? h('span', { class: 'muted small', title: 'Saved to this world file as well as on this computer' }, `World file: ${link.fileName}`) : null,
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => openById(summary.id) }, 'Open'),
        h(
          'button',
          {
            class: 'btn',
            onclick: async () => exportWorld(await loadWorld(summary.id)),
          },
          'Export',
        ),
        h(
          'button',
          {
            class: 'btn danger',
            onclick: async () => {
              const ok = confirm(
                `Delete "${summary.name}" permanently from this computer?\n\nThis cannot be undone. Export a backup first if unsure.${link ? `\n\nThe world file ${link.fileName} is not deleted.` : ''}`,
              );
              if (!ok) return;
              await deleteWorld(summary.id);
              refreshList();
            },
          },
          'Delete',
        ),
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
        h('div', { class: 'row' }, importButton, fileInput, openFileButton),
        syncNote,
        message,
      ),
      h('section', { class: 'frame panel' }, h('h2', {}, 'Worlds'), list),
    ),
  );
  nameInput.focus();
  await refreshList();
}
