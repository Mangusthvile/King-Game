// "Import seed data": loads references/body-types.json and
// references/test-characters.json (or two files the Arbiter picks), shows
// what would be added, then imports it all as one undo step.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { buildImportPlan, importCommand, IMPORT_ORDER } from './seedImport.js';
import { library } from './libraries.js';
import { charactersView as view } from './state.js';
import { navigate } from '../../ui/navigation.js';

// Vite finds the seed files at build time; if they are missing the button
// says so and the file pickers are used instead.
const seedFiles = import.meta.glob(['/references/body-types.json', '/references/test-characters.json'], { import: 'default' });

async function loadSeedFiles() {
  const load = (name) => seedFiles[`/references/${name}`]?.();
  return { body: await load('body-types.json'), chars: await load('test-characters.json') };
}

const STATUS = { new: 'New', existing: 'Already in library (kept)', created: 'Created (flagged)' };

export function renderSeedImport(world, refresh) {
  const message = h('p', { class: 'message error small' });
  const picked = { body: null, chars: null };
  const pick = (which) => {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      try {
        picked[which] = JSON.parse(await input.files[0].text());
      } catch {
        message.textContent = 'That file is not valid JSON.';
      }
    });
    return input;
  };

  const loadBundled = async () => {
    const { body, chars } = await loadSeedFiles();
    if (!body || !chars) return (message.textContent = 'The seed files were not found in references/. Choose them below instead.');
    view.importPlan = buildImportPlan(world, body, chars);
    refresh();
  };
  const loadPicked = () => {
    if (!picked.body || !picked.chars) return (message.textContent = 'Choose both files first.');
    view.importPlan = buildImportPlan(world, picked.body, picked.chars);
    refresh();
  };

  return h(
    'div',
    { class: 'import-page' },
    h(
      'section',
      { class: 'frame panel' },
      h('h2', {}, 'Import seed data'),
      h('p', { class: 'muted small' }, 'Loads the Body Types and the test characters with their Skills, Traits, Pacts, Conditions and Equipment. Libraries first, then characters, linked by name. Nothing is saved until you press Import.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: loadBundled }, 'Load references/ seed files')),
      h('p', { class: 'small muted' }, 'Or choose the two files:'),
      h('div', { class: 'row' }, h('span', { class: 'small' }, 'Body Types'), pick('body'), h('span', { class: 'small' }, 'Characters'), pick('chars'), h('button', { class: 'btn small', onclick: loadPicked }, 'Read files')),
      message,
    ),
    view.importPlan ? preview(world, view.importPlan, refresh) : null,
  );
}

function preview(world, plan, refresh) {
  const libraryRows = IMPORT_ORDER.flatMap((key) =>
    plan.entries[key].map((p) =>
      h('tr', { class: p.status }, h('td', {}, library(key).label), h('td', {}, p.name), h('td', { class: 'small' }, STATUS[p.status]), h('td', { class: 'small flag-text' }, p.flag ?? '')),
    ),
  );
  const characterRows = plan.characters.map((p) => {
    const c = p.character;
    const name = (key, id) => plan.entries[key].find((e) => e.entry.id === id)?.name ?? world.definitions[key]?.[id]?.name ?? '-';
    return h(
      'tr',
      { class: p.flags.length ? 'flagged' : '' },
      h('td', {}, h('input', { type: 'checkbox', checked: p.include, onchange: (e) => (p.include = e.target.checked) })),
      h('td', {}, c.name),
      h('td', {}, name('species', c.speciesId)),
      h('td', {}, `${name('bodyTypes', c.bodyTypeId)} ${c.bodyTypeLevel}`),
      h('td', { class: 'nowrap' }, `${c.STR} / ${c.SPD} / ${c.TOU}`),
      h('td', {}, c.health.max ?? '-'),
      h('td', { class: 'small' }, c.skills.map((s) => `${name('skills', s.skillId)} ${s.tier} Lv${s.level}`).join(', ')),
      h('td', { class: 'small flag-text' }, p.flags.join('; ')),
    );
  });
  const newCount = Object.values(plan.entries).flat().filter((p) => p.status !== 'existing').length;
  const flagged = Object.values(plan.entries).flat().filter((p) => p.status === 'created').length;
  const included = plan.characters.filter((p) => p.include).length;

  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, 'Preview'),
    h('p', { class: 'small' }, `${newCount} new library entries${flagged ? `, ${flagged} of them created from names nothing defined (flagged)` : ''}. ${plan.characters.length} characters.`),
    plan.fileNotes.length ? h('details', {}, h('summary', { class: 'small muted' }, 'Notes from the Body Types file'), h('ul', { class: 'small' }, plan.fileNotes.map((n) => h('li', {}, n)))) : null,
    h('h3', {}, 'Characters'),
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'building-table import-table small' },
        h('thead', {}, h('tr', {}, ['', 'Name', 'Species', 'Body Type', 'STR / SPD / TOU', 'Health', 'Skills', 'Flags'].map((t) => h('th', {}, t)))),
        h('tbody', {}, characterRows),
      ),
    ),
    h('details', {}, h('summary', { class: 'small' }, `Library entries (${Object.values(plan.entries).flat().length})`), h('div', { class: 'table-scroll' }, h('table', { class: 'building-table import-table small' }, h('thead', {}, h('tr', {}, ['Library', 'Name', 'Status', 'Flag'].map((t) => h('th', {}, t)))), h('tbody', {}, libraryRows)))),
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'btn primary',
          onclick: () => {
            const command = importCommand(plan);
            view.importPlan = null;
            dispatch(command);
            navigate({ main: 'people', sub: 'roster', subsub: 'living' }); // see who came in
          },
        },
        `Import (${newCount} library entries, ${included} characters)`,
      ),
      h('button', { class: 'btn small', onclick: () => ((view.importPlan = null), refresh()) }, 'Discard preview'),
    ),
  );
}
