// A Project's requirements checklist: materials, tools and Skills (RULES.md:
// some Projects need certain materials, Tools or Skills). Each item is free
// text plus an optional link to a library entry, and a "met" tick. Unmet
// items only warn; the Arbiter can start a workday anyway.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField } from '../../commands/recordCommands.js';
import { REQUIREMENT_KINDS, newRequirement } from './projectModel.js';

export function requirementsEditor(world, project) {
  const list = project.requirements;
  const setList = (next) => dispatch(setField(world, 'projects', project.id, 'requirements', next, project.name));
  const update = (i, changes) => setList(list.map((r, j) => (j === i ? { ...r, ...changes } : r)));
  const key = (i, part) => `${project.id}.req.${i}.${part}`;

  const rows = list.map((req, i) => {
    const kind = REQUIREMENT_KINDS.find((k) => k.id === req.kind);
    const entries = kind?.library ? Object.values(world.definitions[kind.library] ?? {}) : [];
    const kindSelect = h(
      'select',
      { 'data-key': key(i, 'kind'), onchange: (e) => update(i, { kind: e.target.value, refId: '' }) },
      REQUIREMENT_KINDS.map((k) => h('option', { value: k.id }, k.name)),
    );
    kindSelect.value = req.kind;
    const linkSelect = kind?.library
      ? h(
          'select',
          { 'data-key': key(i, 'ref'), title: 'Optional link to a library entry', onchange: (e) => update(i, { refId: e.target.value }) },
          h('option', { value: '' }, '(no link)'),
          entries.map((x) => h('option', { value: x.id }, x.name)),
          req.refId && !entries.some((x) => x.id === req.refId) ? h('option', { value: req.refId }, '(deleted)') : null,
        )
      : null;
    if (linkSelect) linkSelect.value = req.refId;
    return h(
      'div',
      { class: req.met ? 'requirement-row' : 'requirement-row unmet' },
      h('input', { type: 'checkbox', checked: req.met, title: 'Met', 'data-key': key(i, 'met'), onchange: (e) => update(i, { met: e.target.checked }) }),
      kindSelect,
      h('input', { type: 'text', value: req.text, placeholder: 'e.g. 20 Stone, a shovel', 'data-key': key(i, 'text'), onchange: (e) => update(i, { text: e.target.value }) }),
      linkSelect,
      h('button', { class: 'btn small danger', title: 'Remove', onclick: () => setList(list.filter((_, j) => j !== i)) }, 'x'),
    );
  });

  return h(
    'div',
    { class: 'requirements' },
    rows.length ? rows : h('p', { class: 'muted small' }, 'No requirements.'),
    h('button', { class: 'btn small', onclick: () => setList([...list, newRequirement()]) }, '+ Requirement'),
  );
}
