// Arbiter controls of the Project Task Card: who takes part, how much
// Stamina each invests (1 Stamina = 1 Work Die), their relevant Skill, any
// overrides, and the dice themselves (rolled, or typed in from physical dice).
// Edits change the draft (view state) and call refresh(); nothing is
// committed until Accept.
import { h } from '../../ui/dom.js';
import { DIE_CHOICES } from '../../rules/projects.js';
import { newParticipant, setStamina, skillChoices, resolveParticipant, rollAll, rollMissing, rerollDie, typeRoll } from './workdayDraft.js';

// '' -> null, otherwise a number (NaN for junk).
export const parseNumber = (value) => (String(value).trim() === '' ? null : Number(value));

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

// A number box that reports a whole number (or null when emptied).
function numberBox(value, key, onValue, { placeholder = '', min = null, width = '' } = {}) {
  return h('input', {
    type: 'number',
    step: 1,
    min,
    value: value ?? '',
    placeholder,
    class: width,
    'data-key': key,
    onchange: (e) => {
      const n = parseNumber(e.target.value);
      if (n === null || Number.isInteger(n)) onValue(n);
      else e.target.value = value ?? '';
    },
  });
}

function textBox(value, key, onValue, placeholder) {
  return h('input', { type: 'text', value, placeholder, 'data-key': key, onchange: (e) => onValue(e.target.value) });
}

// Reminders shown next to a participant: their Conditions (e.g. "-3 to all
// tasks") and gear. The Project Resolution Method only adds the Skill's
// Level bonus and tools to the work, so these change nothing by themselves;
// the gear list helps the Arbiter fill in the tool bonus.
export function conditionReminders(character) {
  return (character?.conditions ?? []).map((c) => [c.name, c.modifier].filter(Boolean).join(': ')).filter(Boolean);
}

function gearReminder(world, character) {
  if (!character) return '';
  const eq = world.definitions.equipment;
  const names = [...(character.weapons ?? []).map((w) => eq[w.equipmentId]?.name), eq[character.armorId]?.name, character.otherGear].filter(Boolean);
  return names.join(', ');
}

function participantRow(world, draft, index, refresh) {
  const p = draft.participants[index];
  const r = resolveParticipant(world, p);
  const key = (part) => `workday.${p.characterId}.${part}`;
  const update = (fn) => (fn(), refresh());
  const choices = skillChoices(world, r.character);
  const conditions = conditionReminders(r.character);
  const gear = gearReminder(world, r.character);

  const skillSelect = h(
    'select',
    { 'data-key': key('skill'), onchange: (e) => update(() => ((p.skillId = e.target.value), (p.dieOverride = null), (p.bonusOverride = null))) },
    h('option', { value: '' }, 'None (d4)'),
    choices.map((s) => h('option', { value: s.skillId }, `${s.name} (${s.tier} Lv${s.level}): ${s.die ? `d${s.die}` : 'pick a die'}${s.bonus ? ` +${s.bonus}` : ''}`)),
  );
  skillSelect.value = p.skillId;

  const dieSelect = h(
    'select',
    { 'data-key': key('die'), title: 'Work Die', onchange: (e) => update(() => (p.dieOverride = e.target.value ? Number(e.target.value) : null)) },
    h('option', { value: '' }, r.dieAuto ? `Auto (d${r.dieAuto})` : 'Pick a die'),
    DIE_CHOICES.map((d) => h('option', { value: d }, `d${d}`)),
  );
  dieSelect.value = p.dieOverride ?? '';

  const dice = p.rolls.map((roll, i) =>
    h(
      'span',
      { class: p.edited[i] ? 'die-box edited' : 'die-box', title: p.edited[i] ? 'Edited by hand' : '' },
      numberBox(roll, key(`roll${i}`), (n) => {
        if (typeRoll(world, p, i, n)) refresh();
        else alert(r.die ? `A d${r.die} result is a whole number from 1 to ${r.die}.` : 'Pick a Work Die first.');
      }, { placeholder: r.die ? `d${r.die}` : '?', min: 1, width: 'die-input' }),
      h('button', { class: 'btn tiny', title: 'Reroll this die', onclick: () => update(() => rerollDie(world, p, i)) }, '↻'),
    ),
  );

  return h(
    'div',
    { class: r.overspend ? 'participant-row warn' : 'participant-row' },
    h(
      'div',
      { class: 'row participant-head' },
      h('strong', {}, r.name),
      h('span', { class: 'meter speed', title: 'Stamina remaining today / Stamina max' }, `Stamina ${r.remaining ?? '-'}/${r.character?.staminaMax ?? '-'}`),
      r.overspend ? h('span', { class: 'flag-text' }, r.remaining === null ? 'Stamina not set' : `Over by ${p.stamina - r.remaining}`) : null,
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn small danger', title: 'Remove from this workday', onclick: () => update(() => draft.participants.splice(index, 1)) }, 'x'),
    ),
    h(
      'div',
      { class: 'participant-grid' },
      h('label', {}, 'Stamina'),
      numberBox(p.stamina, key('stamina'), (n) => update(() => setStamina(p, Math.max(0, n ?? 0))), { min: 0, width: 'short-input' }),
      h('label', {}, 'Relevant Skill'),
      skillSelect,
      h('label', {}, 'Work Die'),
      dieSelect,
      h('label', { title: 'Skill Level - 1, up to +9, added to every Work Die' }, 'Level bonus'),
      h(
        'span',
        { class: 'row inline' },
        numberBox(p.bonusOverride ?? r.bonusAuto, key('bonus'), (n) => update(() => (p.bonusOverride = n === null || n === r.bonusAuto ? null : n)), { width: 'short-input' }),
        h('span', { class: 'muted small' }, p.bonusOverride === null ? 'per die (auto)' : `per die (edited, auto ${signed(r.bonusAuto)})`),
      ),
      h('label', { title: 'Tools that make the task easier add work for the day (your call how much). A tool the Project requires is the baseline and adds nothing.' }, 'Tools'),
      h('span', { class: 'row inline' }, numberBox(p.toolBonus || null, key('tool'), (n) => update(() => (p.toolBonus = n ?? 0)), { placeholder: '+0', width: 'short-input' }), textBox(p.toolNote, key('toolNote'), (v) => update(() => (p.toolNote = v)), 'which tools')),
    ),
    conditions.length ? h('p', { class: 'small flag-text' }, `Conditions: ${conditions.join('; ')}`) : null,
    gear ? h('p', { class: 'muted small' }, `Gear: ${gear}`) : null,
    p.stamina > 0
      ? h('div', { class: 'row dice-row' }, h('span', { class: 'muted small' }, `${p.stamina}d${r.die ?? '?'}${r.bonus ? ` +${r.bonus} each` : ''}:`), dice, h('span', {}, `= ${r.work ?? '?'}`))
      : h('p', { class: 'muted small' }, 'Invests no Stamina: rolls no dice.'),
  );
}

export function renderParticipants(world, draft, refresh) {
  const inDraft = new Set(draft.participants.map((p) => p.characterId));
  const available = Object.values(world.characters).filter((c) => c.alive && !inDraft.has(c.id));
  const addSelect = h('select', { 'data-key': 'workday.add' }, h('option', { value: '' }, 'Add a participant...'), available.map((c) => h('option', { value: c.id }, `${c.name} (Stamina ${c.staminaRemaining ?? '-'})`)));
  const add = () => {
    if (!addSelect.value) return;
    const c = world.characters[addSelect.value];
    draft.participants.push(newParticipant(c.id, (c.staminaRemaining ?? 0) >= 1 ? 1 : 0));
    refresh();
  };

  return [
    h('h3', {}, 'Participants and Work Dice'),
    h('p', { class: 'muted small' }, 'Each Stamina invested = 1 Work Die. Press Roll, or type the results of physical dice into the boxes. Change any die before accepting.'),
    draft.participants.map((_, i) => participantRow(world, draft, i, refresh)),
    h('div', { class: 'row' }, addSelect, h('button', { class: 'btn small', onclick: add }, 'Add')),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => (rollAll(world, draft), refresh()) }, 'Roll all dice'),
      h('button', { class: 'btn small', title: 'Roll only the dice with no result yet', onclick: () => (rollMissing(world, draft), refresh()) }, 'Roll empty dice'),
      h(
        'button',
        {
          class: 'btn small',
          title: 'Empty every die (to type in physical rolls)',
          onclick: () => {
            for (const p of draft.participants) setStamina(Object.assign(p, { rolls: [], edited: [] }), p.stamina);
            refresh();
          },
        },
        'Clear dice',
      ),
    ),
  ];
}
