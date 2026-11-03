// Codex > Rules: read-only views of what the rules engine uses, so the
// Arbiter can check a number without opening the code:
//   Rule Tables:   every rules table (JSON files in */tables/). Change a
//                  value by editing its file; no code changes. The
//                  Connectivity text is editable in People > Crown Bearers.
//   Log Templates: every Resolution Log template (*/templates/*.txt), plus
//                  the Resolution Log options
//   Open Rules:    the Open Rules list from CLAUDE.md (ask the Arbiter, do
//                  not invent)
import { h } from '../../ui/dom.js';
import { logOptionsPanel } from '../../ui/settingsTab.js';

const tables = import.meta.glob('/src/**/tables/*.json', { eager: true, import: 'default' });
const templates = import.meta.glob('/src/**/templates/*.txt', { eager: true, query: '?raw', import: 'default' });
const claudeMd = Object.values(import.meta.glob('/CLAUDE.md', { eager: true, query: '?raw', import: 'default' }))[0] ?? '';

// "/src/rules/tables/projects.json" -> "projects.json (src/rules/tables)"
function fileLabel(path) {
  const parts = path.replace(/^\//, '').split('/');
  const name = parts.pop();
  return `${name} (${parts.join('/')})`;
}

function filesSection(title, intro, files, show) {
  const rows = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => {
      const about = typeof content?.description === 'string' ? h('span', { class: 'muted small' }, ` - ${content.description.slice(0, 90)}...`) : null;
      return h('details', { class: 'rule-file' }, h('summary', {}, fileLabel(path), about), h('pre', { class: 'log-pre small' }, show(content)));
    });
  return h('section', { class: 'frame panel' }, h('h2', {}, title), h('p', { class: 'muted small' }, intro), rows);
}

// The "- " items under "## Open Rules" in CLAUDE.md.
export function openRules(text) {
  const start = text.indexOf('## Open Rules');
  if (start < 0) return [];
  return text
    .slice(start)
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
}

function page(build) {
  return (world, { detailPanel }) => {
    detailPanel.replaceChildren(h('h2', {}, 'Rules'), h('p', { class: 'muted small' }, 'The rules come from RULES.md. Anything missing stays a manual, editable field until you decide the rule.'));
    return h('div', { class: 'tab-page' }, build(world));
  };
}

const TABLES_INTRO = 'Read-only here. Edit a JSON file to change a number; no code changes are needed.';
const TEMPLATES_INTRO = "Read-only here. Edit a template file to change a log's wording ({{value}}, {{#list}}, {{^empty}}, {{@stop}}; see src/rules/logTemplate.js).";

function openRulesSection() {
  const items = openRules(claudeMd);
  return h(
    'section',
    { class: 'frame panel' },
    h('h2', {}, `Open Rules (${items.length})`),
    h('p', { class: 'muted small' }, 'From CLAUDE.md. Each one stays manual in the app until you decide it.'),
    h('ul', { class: 'wizard-list' }, items.map((t) => h('li', { class: 'small' }, t))),
  );
}

export default {
  id: 'codex',
  name: 'Codex',
  places: [
    { path: 'codex/rules/tables', render: page(() => filesSection('Rule Tables', TABLES_INTRO, tables, (c) => JSON.stringify(c, null, 2))) },
    { path: 'codex/rules/templates', render: page((world) => [logOptionsPanel(world), filesSection('Log Templates', TEMPLATES_INTRO, templates, (c) => c)]) },
    { path: 'codex/rules/openRules', render: page(openRulesSection) },
  ],
};
