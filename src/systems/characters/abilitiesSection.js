// Skills (with Skill Bonus and the Defense Skill), Theories, and Traits and
// Pacts on the character sheet. Conditions are in stasis (see libraries.js):
// conditionsEditor is kept for the Combat stage but not shown.
import { h } from '../../ui/dom.js';
import { dispatch } from '../../data/store.js';
import { setField } from '../../commands/recordCommands.js';
import { isTheoryComplete, skillBonus, tierUpSource } from '../../rules/skills.js';
import { SKILL_TIERS, isPact, inStasis } from './libraries.js';
import { refOptions } from './libraryEditor.js';
import { listEditor } from './listEditor.js';
import { convertForm, tierUpForm } from './skillHelpers.js';
import { charactersView as view } from './state.js';

export function renderAbilities(world, c, refresh) {
  const lib = world.definitions;
  const openHelper = (kind, index) => ((view.helper = { kind, index }), refresh());
  const closeHelper = () => ((view.helper = null), refresh());
  const helper =
    view.helper?.kind === 'convert' ? convertForm(world, c, view.helper.index, closeHelper) : view.helper?.kind === 'tierUp' ? tierUpForm(world, c, view.helper.index, closeHelper) : null;

  // Tier choices: T1-T5, special tiers used in the library, and the current value.
  const tiers = [...new Set([...SKILL_TIERS, ...Object.values(lib.skills).map((s) => s.tier).filter(Boolean)])];
  const skillTip = (s) => {
    const def = lib.skills[s.skillId];
    return def ? [def.description, def.skillFeature && `Feature: ${def.skillFeature}`, def.limitation && `Limitation: ${def.limitation}`].filter(Boolean).join('\n\n') : '';
  };

  const defenseSelect = h(
    'select',
    { 'data-key': `${c.id}.defenseSkill`, onchange: (e) => dispatch(setField(world, 'characters', c.id, 'defenseSkillId', e.target.value, c.name)) },
    h('option', { value: '' }, '(none)'),
    c.skills.filter((s) => lib.skills[s.skillId]).map((s) => h('option', { value: s.skillId }, lib.skills[s.skillId].name)),
  );
  defenseSelect.value = c.defenseSkillId ?? '';

  return [
    helper,
    h('h3', {}, 'Skills'),
    listEditor(
      world,
      c,
      'skills',
      [
        { key: 'skillId', label: 'Skill', type: 'select', wide: true, options: [{ value: '', label: '(choose)' }, ...refOptions(world, 'skills')] },
        { key: 'tier', label: 'Tier', type: 'select', options: tiers.map((t) => ({ value: t, label: t })) },
        { key: 'level', label: 'Lv', type: 'number' },
      ],
      {
        newItem: () => ({ skillId: '', tier: 'T1', level: 1 }),
        addLabel: '+ Skill',
        extras: (s, i) => [
          // Display only: RULES.md Level bonus (+0 at Lv1, +1 per Level).
          h('span', { class: 'bonus-chip', title: `Skill Bonus = Level - 1${skillTip(s) ? `\n\n${skillTip(s)}` : ''}` }, `Bonus +${skillBonus(s.level)}`),
          s.skillId && s.skillId === c.defenseSkillId ? h('span', { class: 'label-tag stage-tag' }, 'Defense') : null,
          tierUpSource(s.tier) ? h('button', { class: 'btn small', onclick: () => openHelper('tierUp', i) }, 'Tier up') : null,
        ],
      },
    ),
    h('div', { class: 'field-grid' }, h('label', {}, 'Defense Skill'), defenseSelect),
    h('h3', { title: 'Theories give no automatic numerical bonus.' }, 'Theories ', h('span', { class: 'muted small' }, '(no automatic bonus)')),
    listEditor(world, c, 'theories', [{ key: 'name', label: 'Theory', wide: true }, { key: 'percent', label: '%', type: 'number' }], {
      newItem: () => ({ name: 'Theory of ', percent: 0 }),
      addLabel: '+ Theory',
      extras: (t, i) => (isTheoryComplete(t) ? h('button', { class: 'btn small primary', title: 'This Theory is at 100%', onclick: () => openHelper('convert', i) }, 'Make Skill') : null),
    }),
    h('h3', {}, 'Traits and Pacts'),
    listEditor(
      world,
      c,
      'traits',
      [
        {
          key: 'traitId',
          label: 'Trait or Pact',
          type: 'select',
          wide: true,
          options: [{ value: '', label: '(choose)' }, ...Object.values(lib.traits).map((t) => ({ value: t.id, label: isPact(t) ? `${t.name} (Pact)` : t.name }))],
        },
        { key: 'note', label: 'Note', wide: true },
      ],
      {
        newItem: () => ({ traitId: '', note: '' }),
        addLabel: '+ Trait or Pact',
        extras: (t) => {
          const def = lib.traits[t.traitId];
          const tip = def ? [def.description, def.mechanicalFeature && `Mechanical: ${def.mechanicalFeature}`].filter(Boolean).join('\n\n') : '';
          return [isPact(def) ? h('span', { class: 'pact-chip' }, 'Pact') : null, tip ? h('span', { class: 'info-chip', title: tip }, 'i') : null];
        },
      },
    ),
    inStasis('conditions') ? null : conditionsEditor(world, c),
  ];
}

function conditionsEditor(world, c) {
  return [
    h('h3', {}, 'Conditions'),
    listEditor(
      world,
      c,
      'conditions',
      [
        { key: 'conditionId', label: 'Condition', type: 'select', wide: true, options: [{ value: '', label: '(one-off)' }, ...refOptions(world, 'conditions')] },
        { key: 'name', label: 'One-off name', wide: true, placeholder: 'if not from the library' },
        { key: 'modifier', label: 'Modifier', placeholder: '-3 to all tasks' },
        { key: 'durationDays', label: 'Days', type: 'number' },
        { key: 'note', label: 'Note', wide: true },
      ],
      // RULE NEEDED: condition durations and healing are open rules; these are plain fields.
      { newItem: () => ({ conditionId: '', name: '', modifier: '', durationDays: '', note: '' }), addLabel: '+ Condition' },
    ),
  ];
}

