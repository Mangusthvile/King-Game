// The first step of a workday: the party, shrunk into the Task Card's Info
// pane. One compact row per participant (Stamina, relevant Skill, tools),
// then Confirm starts the log. Everything here can still be
// changed later under "Edit details".
import { h } from '../../ui/dom.js';
import { openDialog } from '../../ui/dialog.js';
import { DIE_CHOICES } from '../../rules/projects.js';
import { requirementText, unmetRequirements } from './projectModel.js';
import { newParticipant, setStamina, skillChoices, resolveParticipant } from './workdayDraft.js';
import { conditionReminders, parseNumber } from './workdayParticipants.js';

function smallNumber(value, key, title, onValue, placeholder = '') {
  return h('input', {
    type: 'number',
    step: 1,
    class: 'tiny-input',
    title,
    placeholder,
    value: value ?? '',
    'data-key': key,
    onchange: (e) => {
      const n = parseNumber(e.target.value);
      if (n === null || Number.isInteger(n)) onValue(n);
      else e.target.value = value ?? '';
    },
  });
}

function compactRow(world, draft, index, refresh) {
  const p = draft.participants[index];
  const r = resolveParticipant(world, p);
  const key = (part) => `setup.${p.characterId}.${part}`;
  const update = (fn) => (fn(), refresh());
  const skill = h(
    'select',
    { class: 'setup-skill', 'data-key': key('skill'), title: 'Relevant Skill (its Tier gives the Work Die)', onchange: (e) => update(() => ((p.skillId = e.target.value), (p.dieOverride = null), (p.bonusOverride = null))) },
    h('option', { value: '' }, 'No Skill · d4'),
    skillChoices(world, r.character).map((s) => h('option', { value: s.skillId }, `${s.name} ${s.tier} Lv${s.level} · ${s.die ? `d${s.die}` : 'd?'}${s.bonus ? ` +${s.bonus}` : ''}`)),
  );
  skill.value = p.skillId;
  // A special-tier Skill has no die in the table: the Arbiter picks one.
  const die = !r.die
    ? h(
        'select',
        { class: 'flag-input', 'data-key': key('die'), title: 'Pick the Work Die (RULE NEEDED for special tiers)', onchange: (e) => update(() => (p.dieOverride = e.target.value ? Number(e.target.value) : null)) },
        h('option', { value: '' }, 'd?'),
        DIE_CHOICES.map((d) => h('option', { value: d }, `d${d}`)),
      )
    : null;
  const conditions = conditionReminders(r.character);

  // Short lines: who and how much Stamina, the relevant Skill (its Level
  // bonus goes on every die), the tools they use, then their Conditions.
  return h(
    'div',
    { class: r.overspend ? 'setup-row warn' : 'setup-row' },
    h(
      'div',
      { class: 'setup-line' },
      h('strong', { class: 'setup-who ellipsis', title: `Stamina ${r.remaining ?? '-'} left of ${r.character?.staminaMax ?? '-'}` }, r.name, h('span', { class: 'muted' }, ` ${r.remaining ?? '-'}/${r.character?.staminaMax ?? '-'}`)),
      h('span', { class: 'spacer' }),
      smallNumber(p.stamina, key('stamina'), 'Stamina invested (1 Stamina = 1 Work Die)', (n) => update(() => setStamina(p, Math.max(0, n ?? 0)))),
      h('button', { class: 'btn tiny', title: 'Remove', onclick: () => update(() => draft.participants.splice(index, 1)) }, 'x'),
    ),
    h('div', { class: 'setup-line' }, skill, die),
    h(
      'div',
      { class: 'setup-line' },
      h('span', { class: 'muted', title: 'Tools that make the task easier add work for the day. A tool the Project requires is the baseline and adds nothing.' }, 'Tools'),
      smallNumber(p.toolBonus || null, key('tool'), 'Work the tools add for the day (your call)', (n) => update(() => (p.toolBonus = n ?? 0)), '+0'),
      h('input', { type: 'text', class: 'setup-tool', value: p.toolNote, placeholder: 'which tools (optional)', 'data-key': key('toolNote'), onchange: (e) => update(() => (p.toolNote = e.target.value)) }),
    ),
    conditions.length ? h('div', { class: 'small flag-text ellipsis', title: conditions.join('; ') }, `⚠ ${conditions.join('; ')}`) : null,
  );
}

// Confirm: checks the party, asks about overspent Stamina, then starts the log.
function confirmParty(world, draft, refresh) {
  const people = draft.participants.map((p) => resolveParticipant(world, p));
  const working = people.filter((r) => r.p.stamina > 0);
  if (!working.length) return alert('Give at least one participant some Stamina to invest.');
  if (working.some((r) => !r.die)) return alert('Pick a Work Die for the special-tier Skill (d?).');
  const start = () => {
    draft.phase = 'run';
    refresh();
  };
  const over = working.filter((r) => r.overspend);
  if (!over.length) return start();
  openDialog({
    title: 'Not enough Stamina',
    body: over.map((r) => h('p', {}, r.remaining === null ? `${r.name} has no Stamina set.` : `${r.name} is spending ${r.p.stamina} Stamina but has ${r.remaining} left.`)),
    buttons: [
      { label: 'Allow it', primary: true, onClick: () => ((draft.staminaOverride = true), start()) },
      { label: 'Go back' },
    ],
  });
}

export function renderSetup(world, draft, refresh) {
  const project = world.projects[draft.projectId];
  const inDraft = new Set(draft.participants.map((p) => p.characterId));
  const available = Object.values(world.characters).filter((c) => c.alive && !inDraft.has(c.id));
  const add = h(
    'select',
    {
      'data-key': 'setup.add',
      onchange: (e) => {
        const c = world.characters[e.target.value];
        if (c) draft.participants.push(newParticipant(c.id, (c.staminaRemaining ?? 0) >= 1 ? 1 : 0));
        refresh();
      },
    },
    h('option', { value: '' }, '+ Add participant...'),
    available.map((c) => h('option', { value: c.id }, `${c.name} (Stamina ${c.staminaRemaining ?? '-'})`)),
  );
  const unmet = unmetRequirements(project);
  const requiredTools = project.requirements.filter((r) => r.kind === 'tool');

  return [
    h('div', { class: 'task-pane-sub' }, 'Party: Stamina, relevant Skill, tools'),
    draft.participants.length ? draft.participants.map((_, i) => compactRow(world, draft, i, refresh)) : h('p', { class: 'muted small' }, 'Nobody yet.'),
    add,
    requiredTools.length ? h('p', { class: 'muted small' }, `Required tools are the baseline (no bonus): ${requiredTools.map((r) => requirementText(world, r)).join(', ')}`) : null,
    unmet.length ? h('p', { class: 'small flag-text' }, `Unmet: ${unmet.map((r) => requirementText(world, r)).join(', ')} (you can start anyway)`) : null,
    h('div', { class: 'row setup-confirm' }, h('button', { class: 'btn primary', onclick: () => confirmParty(world, draft, refresh) }, 'Confirm party')),
  ];
}
